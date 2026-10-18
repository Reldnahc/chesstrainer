"""Removed lessons: the release migration keeps old cards' scheduling and history."""

from lesson_fixtures import archived_lesson_rows, seed_lesson
from sqlalchemy import select
from trainer.models import SRSState
from trainer.scheduling import FSRSScheduler


def test_lesson_release_migration_preserves_scheduling_and_history(settings, sessions):
    import json

    from alembic import command
    from alembic.config import Config
    from trainer.db import database
    from trainer.exercises import manual_exercise
    from trainer.models import now

    with sessions() as db:
        seed_lesson(db, settings, count=3)
        states = db.scalars(select(SRSState)).all()
        states[0].retired_at = now()
        states[0].retired_interval_days = 101
        retired_id = states[0].exercise_id
        unrelated = manual_exercise(
            db,
            FSRSScheduler(settings),
            fen="4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
            moves=["e2e4"],
            orientation="white",
        )
        db.commit()
        db.get(SRSState, unrelated.id).eligible = False
        db.commit()
        unrelated_id = unrelated.id
    engine, _ = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        config.attributes["connection"] = connection
        command.downgrade(config, "c42d1738a9bf")
        connection.commit()
    with engine.begin() as connection:
        lesson_cards = [
            row[0]
            for row in connection.exec_driver_sql("SELECT exercise_id FROM srs_states")
            if row[0] != unrelated_id
        ]
        archived_lesson_rows(connection, lesson_cards)

    def snapshot(connection):
        tables = [
            r[0]
            for r in connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version'"
            )
        ]
        return {
            table: [
                dict(row)
                for row in connection.exec_driver_sql(
                    f'SELECT * FROM "{table}" ORDER BY rowid'
                ).mappings()
            ]
            for table in tables
        }

    with engine.connect() as connection:
        before = snapshot(connection)
    expected = json.loads(json.dumps(before))
    released = []
    for row in expected["srs_states"]:
        if row["exercise_id"] not in {retired_id, unrelated_id}:
            assert row["eligible"] == 0
            row["eligible"] = 1
            released.append(row["exercise_id"])
    assert released
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "d17b63e02a48")
    with engine.connect() as connection:
        assert snapshot(connection) == expected
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "d17b63e02a48")  # Reapplying this migration is idempotent.
    with engine.connect() as connection:
        assert snapshot(connection) == expected
    engine.dispose()
