from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from trainer.accounts import COOKIE
from trainer.api import create_app
from trainer.contracts.preferences import CoachPreferences
from trainer.db import database, migrate
from trainer.models import UserPreferences
from trainer.preferences import coach_preferences, save_coach_preferences

DEFAULT = {"coach_id": "classic", "motion": "natural"}
PATH = "/api/preferences/coach"


def test_local_defaults_save_restart_and_validation(settings):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == DEFAULT
        with client.app.state.sessions() as db:
            assert db.scalar(select(UserPreferences)) is None
        for invalid in (
            {"coach_id": "invented", "motion": "natural"},
            {"coach_id": "classic", "motion": "flash"},
            DEFAULT | {"user_id": "another-account"},
        ):
            assert client.put(PATH, json=invalid).status_code == 422
        saved = DEFAULT | {"motion": "still"}
        assert client.put(PATH, json=saved).json() == saved
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == saved


def test_accounts_second_device_isolation_and_csrf(settings):
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
        token = client.cookies.get(COOKIE)
        assert client.put(PATH, json=DEFAULT, headers=origin).status_code == 403
        assert (
            client.put(
                PATH,
                json=DEFAULT | {"motion": "subtle"},
                headers=origin | {"X-CSRF-Token": alice["csrf"]},
            ).status_code
            == 200
        )
        client.post(
            "/api/auth/signup",
            json={"username": "bobby", "password": "testing-password"},
            headers=origin,
        ).raise_for_status()
        assert client.get(PATH).json() == DEFAULT
        signed_in = client.post(
            "/api/auth/login",
            json={"username": "alice", "password": "testing-password"},
            headers=origin,
        )
        signed_in.raise_for_status()
        assert client.cookies.get(COOKIE) != token
        assert client.get(PATH).json() == DEFAULT | {"motion": "subtle"}


def test_unknown_saved_choices_fall_back_without_overwriting(sessions):
    with sessions() as db:
        db.add(UserPreferences(coach_id="future-coach", coach_motion="future-motion"))
        db.commit()
        assert coach_preferences(db).model_dump() == DEFAULT
        saved = db.scalar(select(UserPreferences))
        assert saved.coach_id == "future-coach" and saved.coach_motion == "future-motion"


def test_concurrent_first_save_has_one_account_row(sessions):
    def save(motion):
        with sessions() as db:
            return save_coach_preferences(db, CoachPreferences(motion=motion))

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(save, ("still", "subtle")))
    assert {result.motion for result in results} == {"still", "subtle"}
    with sessions() as db:
        assert len(db.scalars(select(UserPreferences)).all()) == 1


def test_migration_preserves_existing_accounts_and_defaults(settings):
    from alembic import command
    from alembic.config import Config

    engine, sessions = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.connect() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "862dcc851f0b")
        connection.commit()
        before = connection.execute(text("SELECT * FROM users")).all()
    migrate(engine)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT * FROM users")).all() == before
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    with sessions() as db:
        assert coach_preferences(db).model_dump() == DEFAULT
    engine.dispose()
