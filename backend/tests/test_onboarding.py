"""Onboarding completion is durable, account-scoped, and absent from local mode."""

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from test_accounts import ORIGIN, signup
from trainer.api import create_app
from trainer.db import database, migrate


def test_completion_is_authenticated_idempotent_and_persists(settings):
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as api:
        assert api.post("/api/auth/onboarding/complete", headers=ORIGIN).status_code == 401
        alice, _ = signup(api, "alice")
        assert alice["user"]["onboarding_completed"] is False
        assert api.get("/api/auth/me").json()["user"]["onboarding_completed"] is False
        headers = ORIGIN | {"X-CSRF-Token": alice["csrf"]}
        assert api.post("/api/auth/onboarding/complete", headers=ORIGIN).status_code == 403
        for _ in range(2):
            result = api.post("/api/auth/onboarding/complete", headers=headers)
            assert result.status_code == 200
            assert result.json()["user"]["onboarding_completed"] is True
        api.post("/api/auth/logout", headers=headers)
        bob, _ = signup(api, "bob")
        assert bob["user"]["onboarding_completed"] is False
    with TestClient(create_app(settings, workers=False, start_engine=False)) as api:
        result = api.post(
            "/api/auth/login",
            json={"username": "alice", "password": "testing-password"},
            headers=ORIGIN,
        )
        assert result.json()["user"]["onboarding_completed"] is True
        assert api.get("/api/jobs").json() == []


def test_existing_users_are_grandfathered_during_upgrade(settings):
    engine, _ = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "38db246ec907")
        connection.exec_driver_sql(
            "INSERT INTO users (id,username,password,admin,disabled,chesscom_username,created) VALUES ('existing','existing','unused',0,0,'',0)"
        )
    migrate(engine)
    with engine.connect() as connection:
        assert (
            connection.exec_driver_sql(
                "SELECT onboarding_completed FROM users WHERE id='existing'"
            ).scalar()
            == 1
        )
    engine.dispose()


def test_local_workspace_has_no_onboarding_endpoint(settings):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as api:
        assert api.get("/api/auth/me").json() == {"enabled": False, "user": None}
        assert api.post("/api/auth/onboarding/complete").status_code in {404, 405}
