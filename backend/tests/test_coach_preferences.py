import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from trainer.api import create_app
from trainer.db import database, migrate
from trainer.models import UserPreferences
from trainer.preferences import coach_preferences

DEFAULT = {"coach_id": "classic", "motion": "system"}
PATH = "/api/preferences/coach"
RETIRED_COACHES = [
    ("dog-sunny", "dog-puppy"),
    ("cat-tabby", "cat-kitten"),
    ("cat-calico", "cat-kitten"),
]


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


@pytest.mark.parametrize(("retired", "replacement"), RETIRED_COACHES)
@pytest.mark.parametrize("motion", ["natural"])
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


@pytest.mark.pristine_database
@pytest.mark.parametrize("saved_motion", ["subtle"])
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
