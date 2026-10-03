from concurrent.futures import ThreadPoolExecutor
from typing import get_args

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from trainer.accounts import COOKIE
from trainer.api import create_app
from trainer.contracts.preferences import CoachId, CoachPreferences
from trainer.db import database, migrate
from trainer.models import UserPreferences
from trainer.preferences import coach_preferences, save_coach_preferences

DEFAULT = {"coach_id": "classic", "motion": "system"}
PATH = "/api/preferences/coach"
RETIRED_COACHES = [
    ("dog-sunny", "dog-puppy"),
    ("cat-tabby", "cat-kitten"),
    ("cat-calico", "cat-kitten"),
]


@pytest.mark.parametrize("coach_id", get_args(CoachId))
def test_every_coach_persists_across_restart(settings, coach_id):
    saved = {"coach_id": coach_id, "motion": "natural"}
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        response = client.put(PATH, json=saved)
        assert response.status_code == 200
        assert response.json() == saved
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == saved


def test_local_defaults_save_restart_and_validation(settings):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == DEFAULT
        with client.app.state.sessions() as db:
            assert db.scalar(select(UserPreferences)) is None
        for invalid in (
            {"coach_id": "invented", "motion": "natural"},
            {"coach_id": "classic", "motion": "flash"},
            {"coach_id": "classic", "motion": "subtle"},
            DEFAULT | {"user_id": "another-account"},
        ):
            assert client.put(PATH, json=invalid).status_code == 422
        saved = DEFAULT | {"motion": "still"}
        assert client.put(PATH, json=saved).json() == saved
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == saved


def test_patch_changes_only_the_fields_sent(settings):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        # A first change creates the row with the other field at its default.
        assert client.patch(PATH, json={"coach_id": "dog-corgi"}).json() == {
            "coach_id": "dog-corgi",
            "motion": "system",
        }
        assert client.patch(PATH, json={"motion": "still"}).json() == {
            "coach_id": "dog-corgi",
            "motion": "still",
        }
        assert client.patch(PATH, json={"coach_id": "robot"}).json() == {
            "coach_id": "robot",
            "motion": "still",
        }
        assert client.patch(PATH, json={}).json() == {"coach_id": "robot", "motion": "still"}
        for invalid in ({"coach_id": "invented"}, {"motion": "subtle"}, {"extra": True}):
            assert client.patch(PATH, json=invalid).status_code == 422
        assert client.get(PATH).json() == {"coach_id": "robot", "motion": "still"}


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
                json={"coach_id": "dog-collie", "motion": "natural"},
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
        assert client.get(PATH).json() == {"coach_id": "dog-collie", "motion": "natural"}


def test_unknown_saved_choices_fall_back_without_overwriting(sessions):
    with sessions() as db:
        db.add(UserPreferences(coach_id="future-coach", coach_motion="future-motion"))
        db.commit()
        assert coach_preferences(db).model_dump() == DEFAULT
        saved = db.scalar(select(UserPreferences))
        assert saved.coach_id == "future-coach" and saved.coach_motion == "future-motion"


@pytest.mark.parametrize(("retired", "replacement"), RETIRED_COACHES)
@pytest.mark.parametrize("motion", ["system", "natural", "still"])
def test_retired_coach_reads_replacement_without_overwriting(
    settings, retired, replacement, motion
):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        with client.app.state.sessions() as db:
            db.add(UserPreferences(coach_id=retired, coach_motion=motion, interface_motion="still"))
            db.commit()
        expected = {"coach_id": replacement, "motion": motion}
        assert client.get(PATH).json() == expected
        assert client.get("/api/preferences/motion").json() == {"motion": "still"}
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get(PATH).json() == expected
        with client.app.state.sessions() as db:
            saved = db.scalar(select(UserPreferences))
            assert saved.coach_id == retired
            assert saved.coach_motion == motion
            assert saved.interface_motion == "still"


@pytest.mark.parametrize(("retired", "replacement"), RETIRED_COACHES)
def test_retired_coach_writes_are_rejected(settings, retired, replacement):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        response = client.put(PATH, json={"coach_id": retired, "motion": "natural"})
        assert response.status_code == 422
        assert client.get(PATH).json() == DEFAULT
        selected = {"coach_id": replacement, "motion": "natural"}
        assert client.put(PATH, json=selected).json() == selected


def test_concurrent_first_save_has_one_account_row(sessions):
    def save(motion):
        with sessions() as db:
            return save_coach_preferences(db, CoachPreferences(motion=motion))

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(save, ("still", "natural")))
    assert {result.motion for result in results} == {"still", "natural"}
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
        before = connection.execute(text("SELECT * FROM users")).mappings().all()
    migrate(engine)
    with engine.connect() as connection:
        after = connection.execute(text("SELECT * FROM users")).mappings().all()
        assert [{key: row[key] for key in before[0]} for row in after] == before
        assert all(row["onboarding_completed"] for row in after)
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    with sessions() as db:
        assert coach_preferences(db).model_dump() == DEFAULT
    engine.dispose()


@pytest.mark.parametrize("saved_motion", ["natural", "still", "subtle"])
def test_device_default_migration_preserves_saved_motion(settings, saved_motion):
    from alembic import command
    from alembic.config import Config

    engine, sessions = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "55de0b7b8ff2")
        connection.execute(
            text("INSERT INTO user_preferences (user_id, coach_motion) VALUES ('local', :motion)"),
            {"motion": saved_motion},
        )
    migrate(engine)
    with engine.connect() as connection:
        columns = connection.exec_driver_sql("PRAGMA table_info(user_preferences)").mappings().all()
        assert (
            next(column for column in columns if column["name"] == "coach_motion")["dflt_value"]
            == "'system'"
        )
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    with sessions() as db:
        expected = "natural" if saved_motion == "subtle" else saved_motion
        assert coach_preferences(db).motion == expected
        assert db.scalar(select(UserPreferences)).coach_motion == saved_motion
    engine.dispose()
