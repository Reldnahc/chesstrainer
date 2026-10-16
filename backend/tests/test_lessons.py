"""Removed lessons: their routes answer 410 and old attempts stay archived."""

import pytest
from fastapi.testclient import TestClient
from lesson_fixtures import archived_lesson_rows, seed_lesson
from sqlalchemy import select
from trainer.api import create_app
from trainer.errors import Gone
from trainer.models import ReviewSession, SRSState
from trainer.reviews import reveal, submit_move
from trainer.scheduling import FSRSScheduler


@pytest.mark.parametrize("completed", [False, True])
def test_lesson_routes_and_old_attempts_are_archived(settings, completed):
    settings.stockfish_path = "missing-test"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            seed_lesson(db, settings, count=3)
            exercise_id = db.scalar(select(SRSState.exercise_id))
            # An attempt saved by the removed lessons.
            session = ReviewSession(exercise_id=exercise_id, mode="lesson", completed=completed)
            db.add(session)
            db.commit()
            session_id = session.id
            before = db.get(SRSState, exercise_id).card
        for method, path in [
            ("get", "/api/course"),
            ("get", "/api/course/revisions"),
            ("post", "/api/course/rebuild"),
            ("post", "/api/course/units/old/next"),
            ("post", "/api/course/units/old/extend"),
            ("post", "/api/lessons/old/complete"),
            ("post", "/api/lesson-items/old/acknowledge"),
        ]:
            assert getattr(client, method)(path).status_code == 410
        assert client.post(f"/api/review/sessions/{session_id}/reveal").status_code == 410
        assert (
            client.post(
                f"/api/review/sessions/{session_id}/move",
                json={"from_square": "e1", "to_square": "d1"},
            ).status_code
            == 410
        )
        with app.state.sessions() as db:
            assert db.get(ReviewSession, session_id).completed == completed
            assert db.get(SRSState, exercise_id).card == before
            # Offline/domain callers cannot bypass the HTTP archive guard either.
            with pytest.raises(Gone, match="archived"):
                reveal(db, session_id, FSRSScheduler(settings), settings)
                db.commit()
            with pytest.raises(Gone, match="archived"):
                submit_move(db, session_id, "e1d1", None, FSRSScheduler(settings), settings)
                db.commit()
        # An ordinary review of the same position is a separate usable session.
        position = client.post(f"/api/review/{exercise_id}/start").json()
        assert position["session_id"] != session_id
        assert (
            client.post(f"/api/review/sessions/{position['session_id']}/reveal").status_code == 200
        )


def test_teaching_routes_are_gone_and_old_lesson_cards_review_normally(settings):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            seed_lesson(db, settings, count=3)
            exercise_id = db.scalar(select(SRSState.exercise_id))
        cold = client.post(f"/api/review/{exercise_id}/start").json()
        response = client.post(f"/api/review/sessions/{cold['session_id']}/reveal")
        assert response.status_code == 200
        assert "lesson_result" not in response.json()
        assert client.get("/api/weaknesses").status_code == 200
        assert client.post("/api/course/teaching").status_code == 410
        assert client.get("/api/teaching-runs/old").status_code == 410
        assert client.post("/api/teaching-runs/old/reject").status_code == 410
        with app.state.sessions() as db:
            assert db.get(SRSState, exercise_id).reviews == 1


def test_lesson_release_migration_preserves_scheduling_and_history(settings, sessions):
    import json

    from alembic import command
    from alembic.config import Config
    from trainer.db import database
    from trainer.exercises import manual_exercise
    from trainer.models import now
    from trainer.scheduling import FSRSScheduler

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
