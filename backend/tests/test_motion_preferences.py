from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from trainer.api import create_app
from trainer.contracts.preferences import CoachPreferences, MotionPreferences
from trainer.db import database, migrate
from trainer.models import UserPreferences
from trainer.preferences import (
    coach_preferences,
    motion_preferences,
    save_coach_preferences,
    save_motion_preferences,
)

PATH = "/api/preferences/motion"


@pytest.mark.parametrize("motion", ["system", "natural", "still"])
def test_motion_restart_and_independent_coach_updates(settings, motion):
    coach = {"coach_id": "cat-black", "motion": "still"}
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == {"motion": "system"}
        with client.app.state.sessions() as db:
            assert db.scalar(select(UserPreferences)) is None
        assert client.put(PATH, json={"motion": motion}).json() == {"motion": motion}
        assert client.put("/api/preferences/coach", json=coach).json() == coach
        assert client.get(PATH).json() == {"motion": motion}
        for invalid in ({"motion": "subtle"}, {"motion": "flash"}, {"user_id": "other"}):
            assert client.put(PATH, json=invalid).status_code == 422
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == {"motion": motion}
        assert client.put(PATH, json={"motion": "natural"}).status_code == 200
        assert client.get("/api/preferences/coach").json() == coach


def test_motion_is_account_owned_and_requires_csrf(settings):
    settings.public_origin = "http://testserver"
    settings.accounts_enabled = True
    settings.session_secure = False
    origin = {"Origin": settings.public_origin}
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).status_code == 401
        alice = client.post(
            "/api/auth/signup",
            json={"username": "alice", "password": "testing-password"},
            headers=origin,
        ).json()
        assert client.put(PATH, json={"motion": "natural"}, headers=origin).status_code == 403
        assert (
            client.put(
                PATH, json={"motion": "natural"}, headers=origin | {"X-CSRF-Token": alice["csrf"]}
            ).status_code
            == 200
        )
        bob = client.post(
            "/api/auth/signup",
            json={"username": "bobby", "password": "testing-password"},
            headers=origin,
        ).json()
        assert client.get(PATH).json() == {"motion": "system"}
        assert (
            client.put(
                PATH, json={"motion": "still"}, headers=origin | {"X-CSRF-Token": bob["csrf"]}
            ).status_code
            == 200
        )
        client.post(
            "/api/auth/login",
            json={"username": "alice", "password": "testing-password"},
            headers=origin,
        ).raise_for_status()
        assert client.get(PATH).json() == {"motion": "natural"}


def test_unknown_motion_falls_back_without_overwriting(sessions):
    with sessions() as db:
        db.add(UserPreferences(interface_motion="future-motion"))
        db.commit()
        assert motion_preferences(db).motion == "system"
        assert db.scalar(select(UserPreferences)).interface_motion == "future-motion"


def test_concurrent_first_save_preserves_both_preferences(sessions):
    def save(coach):
        with sessions() as db:
            if coach:
                save_coach_preferences(db, CoachPreferences(coach_id="dog-collie", motion="still"))
            else:
                save_motion_preferences(db, MotionPreferences(motion="natural"))

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(save, (True, False)))
    with sessions() as db:
        assert len(db.scalars(select(UserPreferences)).all()) == 1
        assert motion_preferences(db).motion == "natural"
        assert coach_preferences(db).model_dump() == {"coach_id": "dog-collie", "motion": "still"}


def test_migration_defaults_to_device_without_changing_saved_coach(settings):
    from alembic import command
    from alembic.config import Config

    engine, sessions = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "c904b1d63f72")
        connection.execute(
            text(
                "INSERT INTO user_preferences (user_id, coach_id, coach_motion) "
                "VALUES ('local', 'cat-black', 'still')"
            )
        )
    migrate(engine)
    with sessions() as db:
        assert motion_preferences(db).motion == "system"
        assert coach_preferences(db).model_dump() == {"coach_id": "cat-black", "motion": "still"}
    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
        assert connection.exec_driver_sql("PRAGMA integrity_check").scalar() == "ok"
    engine.dispose()
