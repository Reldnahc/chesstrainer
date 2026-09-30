from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select, text
from trainer.api import create_app
from trainer.contracts.preferences import AudioPreferences, CoachPreferences, MotionPreferences
from trainer.db import database, migrate
from trainer.models import UserPreferences
from trainer.ownership import account_sessions
from trainer.preferences import (
    audio_preferences,
    coach_preferences,
    motion_preferences,
    save_audio_preferences,
    save_coach_preferences,
    save_motion_preferences,
)

PATH = "/api/preferences/audio"
DEFAULT = {"enabled": True, "volume": 0.35, "board": True, "practice": True, "review": False}
SAVED = {"enabled": False, "volume": 0.6, "board": False, "practice": False, "review": True}


def test_audio_defaults_restart_and_independent_preference_updates(settings):
    coach = {"coach_id": "cat-black", "motion": "still"}
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == DEFAULT
        with client.app.state.sessions() as db:
            assert db.scalar(select(UserPreferences)) is None
        assert client.put(PATH, json=SAVED).json() == SAVED
        assert client.put("/api/preferences/coach", json=coach).json() == coach
        assert client.put("/api/preferences/motion", json={"motion": "natural"}).status_code == 200
        assert client.get(PATH).json() == SAVED
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == SAVED
        assert client.put(PATH, json=DEFAULT).json() == DEFAULT
        assert client.get("/api/preferences/coach").json() == coach
        assert client.get("/api/preferences/motion").json() == {"motion": "natural"}
        with client.app.state.sessions() as db:
            assert len(db.scalars(select(UserPreferences)).all()) == 1


def test_audio_validation_volume_boundaries_and_missing_field_defaults(settings):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        for volume in (0, 1):
            expected = DEFAULT | {"volume": volume}
            response = client.put(PATH, json={"volume": volume})
            assert response.status_code == 200
            assert response.json() == expected
            assert client.get(PATH).json() == expected
        assert client.put(PATH, json=SAVED).status_code == 200
        for invalid in (
            {"volume": -0.01},
            {"volume": 1.01},
            {"volume": None},
            {"volume": "0.5"},
            {"volume": True},
            {"enabled": "false"},
            {"board": 1},
            {"practice": None},
            {"review": "yes"},
            {"user_id": "other"},
        ):
            assert client.put(PATH, json=invalid).status_code == 422
            assert client.get(PATH).json() == SAVED
        assert client.put(PATH, json={}).json() == DEFAULT


@pytest.mark.parametrize("volume", [float("nan"), float("inf"), float("-inf")])
def test_audio_rejects_nonfinite_volume(volume):
    with pytest.raises(ValidationError):
        AudioPreferences(volume=volume)


def test_audio_account_isolation_csrf_and_second_device(settings):
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
        assert client.put(PATH, json=SAVED, headers=origin).status_code == 403
        response = client.put(PATH, json=SAVED, headers=origin | {"X-CSRF-Token": alice["csrf"]})
        assert response.status_code == 200
        assert response.json() == SAVED
        bob = client.post(
            "/api/auth/signup",
            json={"username": "bobby", "password": "testing-password"},
            headers=origin,
        ).json()
        assert client.get(PATH).json() == DEFAULT
        bob_saved = DEFAULT | {"volume": 0.2}
        assert (
            client.put(PATH, json=bob_saved, headers=origin | {"X-CSRF-Token": bob["csrf"]}).json()
            == bob_saved
        )
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        for username, expected in (("alice", SAVED), ("bobby", bob_saved)):
            client.post(
                "/api/auth/login",
                json={"username": username, "password": "testing-password"},
                headers=origin,
            ).raise_for_status()
            assert client.get(PATH).json() == expected


def test_concurrent_first_save_preserves_audio_coach_and_motion(sessions):
    barrier = Barrier(3)

    def save(preference):
        with sessions() as db:
            barrier.wait(timeout=10)
            if preference == "coach":
                save_coach_preferences(db, CoachPreferences(coach_id="dog-collie", motion="still"))
            elif preference == "motion":
                save_motion_preferences(db, MotionPreferences(motion="natural"))
            else:
                save_audio_preferences(db, AudioPreferences(**SAVED))

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(save, ("coach", "motion", "audio")))
    with sessions() as db:
        assert len(db.scalars(select(UserPreferences)).all()) == 1
        assert coach_preferences(db).model_dump() == {"coach_id": "dog-collie", "motion": "still"}
        assert motion_preferences(db).motion == "natural"
        assert audio_preferences(db).model_dump() == SAVED


def test_audio_migration_defaults_preserve_existing_accounts_and_preferences(settings):
    from alembic import command
    from alembic.config import Config

    engine, _ = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "7c249ef302d6")
        connection.execute(
            text(
                "INSERT INTO users (id, username, password, admin, disabled, chesscom_username, "
                "created) VALUES ('alice', 'alice', '', 0, 0, '', 0)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO user_preferences (user_id, coach_id, coach_motion, interface_motion) "
                "VALUES (:user_id, 'cat-black', 'still', 'natural')"
            ),
            [{"user_id": "local"}, {"user_id": "alice"}],
        )
        before_users = connection.execute(text("SELECT * FROM users ORDER BY id")).mappings().all()
    migrate(engine)
    for owner in ("local", "alice"):
        with account_sessions(engine, owner)() as db:
            assert audio_preferences(db).model_dump() == DEFAULT
            assert coach_preferences(db).model_dump() == {
                "coach_id": "cat-black",
                "motion": "still",
            }
            assert motion_preferences(db).motion == "natural"
    with engine.connect() as connection:
        assert (
            connection.execute(text("SELECT * FROM users ORDER BY id")).mappings().all()
            == before_users
        )
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
        assert connection.exec_driver_sql("PRAGMA integrity_check").scalar() == "ok"
        config.attributes["connection"] = connection
        command.check(config)
    engine.dispose()
