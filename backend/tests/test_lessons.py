"""Archived lesson compatibility and safe removal from the live product."""

from fastapi.testclient import TestClient
from lesson_fixtures import seed_lesson
from sqlalchemy import select
from trainer.api import create_app
from trainer.curriculum import build_course
from trainer.models import LessonItem, ReviewSession, SRSState


def test_lesson_routes_and_old_attempts_are_archived(settings):
    settings.stockfish_path = "missing-test"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            seed_lesson(db, settings, count=3)
            item = db.scalar(select(LessonItem))
            session = ReviewSession(exercise_id=item.exercise_id, lesson_item_id=item.id)
            db.add(session)
            db.commit()
            session_id, exercise_id = session.id, item.exercise_id
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
            assert not db.get(ReviewSession, session_id).completed
            assert db.get(SRSState, exercise_id).card == before
        # An ordinary review of the same position is a separate usable session.
        position = client.post(f"/api/review/{exercise_id}/start").json()
        assert position["session_id"] != session_id
        assert (
            client.post(f"/api/review/sessions/{position['session_id']}/reveal").status_code == 200
        )


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
        db.get(SRSState, unrelated.id).eligible = False
        db.commit()
        unrelated_id = unrelated.id
    engine, _ = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "c42d1738a9bf")

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


def test_course_enrollment_does_not_hide_reviewed_or_open_cards(settings):

    settings.stockfish_path = "missing-test"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            seed_lesson(db, settings, count=3)
            states = db.scalars(select(SRSState)).all()
            for state in states:
                state.eligible = True
            # Rebuild a new sequence as if classification arrived after review had begun.

            db.query(LessonItem).delete()
            db.commit()
        queue = client.get("/api/review/queue").json()
        opened = client.post(f"/api/review/{queue[0]['exercise_id']}/start").json()
        reviewed = client.post(f"/api/review/{queue[1]['exercise_id']}/start").json()
        client.post(f"/api/review/sessions/{reviewed['session_id']}/reveal")
        with app.state.sessions() as db:
            original = db.get(SRSState, queue[1]["exercise_id"]).card
            build_course(db, settings)
            assert db.get(SRSState, queue[0]["exercise_id"]).eligible
            assert db.get(SRSState, queue[1]["exercise_id"]).eligible
            assert db.get(SRSState, queue[1]["exercise_id"]).card == original
        assert client.get("/api/review/queue").json()[0]["exercise_id"] == queue[0]["exercise_id"]
        assert (
            client.post(f"/api/review/{queue[0]['exercise_id']}/start").json()["session_id"]
            == opened["session_id"]
        )


def test_legacy_unit_cannot_displace_stable_group(settings, sessions):
    from trainer.models import CourseUnit

    with sessions() as db:
        course = seed_lesson(db, settings, count=3)
        unit = db.scalar(select(CourseUnit))
        original_id = unit.id
        unit.ordinal = 3
        db.add(
            CourseUnit(
                course_id=course.id,
                skill_id="development",
                title="Legacy",
                rationale="",
                ordinal=0,
                provisional=False,
                group_key="",
            )
        )
        db.commit()
        build_course(db, settings)
        assert db.scalar(select(CourseUnit).where(CourseUnit.active.is_(True))).id == original_id
