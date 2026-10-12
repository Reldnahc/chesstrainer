"""Server settings stored in the database, seeded once from the environment."""

import json
from types import SimpleNamespace

from fastapi.testclient import TestClient
from trainer import restart, site_settings
from trainer.accounts import Accounts
from trainer.api import create_app
from trainer.config import Settings
from trainer.db import database

ORIGIN = {"Origin": "http://testserver"}


def test_every_setting_is_either_stored_or_an_environment_variable():
    stored, env = set(site_settings.MANAGED), site_settings.ENV_ONLY
    assert stored.isdisjoint(env)
    assert stored | env == set(Settings.model_fields)
    for name in site_settings.MANAGED:
        site_settings.describe(name, None, None)  # Every stored type has a form field.


def test_the_environment_seeds_missing_settings_and_the_table_wins_afterwards(
    settings, monkeypatch
):
    monkeypatch.setenv("ENGINE_SLOTS", "6")
    first = site_settings.load(Settings(_env_file=None, database_path=settings.database_path))
    assert first.engine_slots == 6 and first.triage_depth == 10
    sql_engine, _ = database(settings.database_path)
    site_settings.save(sql_engine, {"engine_slots": 2, "triage_depth": 14})
    with sql_engine.begin() as connection:
        connection.exec_driver_sql(
            "INSERT INTO site_settings(key, value) VALUES('deep_depth', ?)", (json.dumps(999),)
        )
    sql_engine.dispose()
    # The saved value beats the environment; an invalid saved value falls back.
    later = site_settings.load(Settings(_env_file=None, database_path=settings.database_path))
    assert (later.engine_slots, later.triage_depth, later.deep_depth) == (2, 14, 16)


def test_local_installs_edit_settings_and_restart_only_under_python_m_trainer(
    settings, monkeypatch
):
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        listing = client.get("/api/server-settings").json()
        assert [group["title"] for group in listing["groups"]][:2] == ["Engine", "Game review"]
        slots = listing["groups"][0]["settings"][0]
        assert slots | {"value": None} == {
            "key": "engine_slots",
            "label": "Shared engine slots",
            "help": slots["help"],
            "kind": "integer",
            "nullable": False,
            "choices": None,
            "minimum": 1,
            "maximum": 32,
            "default": 4,
            "value": None,
            "running": 4,
        }
        bad = client.put("/api/server-settings", json={"values": {"engine_slots": 99}})
        assert bad.status_code == 422
        assert bad.json()["detail"].startswith("Shared engine slots:")
        assert (
            client.put("/api/server-settings", json={"values": {"database_path": "x"}}).status_code
            == 422
        )
        saved = client.put(
            "/api/server-settings", json={"values": {"engine_slots": 3, "triage_nodes": None}}
        ).json()
        slots = saved["groups"][0]["settings"][0]
        assert (slots["value"], slots["running"]) == (3, 4)  # Applies at the next start.

        assert not saved["restart_available"]
        assert client.post("/api/server/restart").status_code == 409
        server = SimpleNamespace(should_exit=False)
        monkeypatch.setattr(restart, "server", server)
        monkeypatch.setattr(restart, "requested", False)
        assert client.get("/api/server-settings").json()["restart_available"]
        assert client.post("/api/server/restart").status_code == 202
        assert server.should_exit and restart.requested


def test_only_administrators_manage_server_settings_with_accounts(settings):
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    settings.stockfish_path = "missing-no-signup-engine"
    accounts = Accounts(settings.database_path)
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get("/api/server-settings").status_code == 401
        member = client.post(
            "/api/auth/signup",
            json={"username": "member", "password": "testing-password"},
            headers=ORIGIN,
        ).json()
        headers = ORIGIN | {"X-CSRF-Token": member["csrf"]}
        assert client.get("/api/server-settings").status_code == 403
        change = {"values": {"engine_slots": 2}}
        assert client.put("/api/server-settings", json=change, headers=headers).status_code == 403
        assert client.post("/api/server/restart", headers=headers).status_code == 403

        accounts.create("keeper", "testing-password", admin=True)
        keeper = client.post(
            "/api/auth/login",
            json={"username": "keeper", "password": "testing-password"},
            headers=ORIGIN,
        ).json()
        headers = ORIGIN | {"X-CSRF-Token": keeper["csrf"]}
        assert client.get("/api/server-settings").status_code == 200
        assert client.put("/api/server-settings", json=change, headers=ORIGIN).status_code == 403
        assert client.put("/api/server-settings", json=change, headers=headers).status_code == 200
