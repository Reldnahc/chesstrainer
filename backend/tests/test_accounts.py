"""Adversarial multi-account requests and durable sessions in one database."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from trainer.accounts import COOKIE, Accounts
from trainer.api import create_app
from trainer.db import database, migrate
from trainer.imports import import_games
from trainer.models import AnalysisJob, Game, GameReview, User
from trainer.ownership import account_sessions

ORIGIN = {"Origin": "http://testserver"}
PGN = '[White "Learner"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'


@pytest.mark.parametrize("origin", ["", "   "])
def test_blank_origin_uses_local_workspace_without_exposing_accounts(settings, origin):
    settings.accounts_enabled = True  # The container default must not force login.
    settings.public_origin = origin
    engine, local_sessions = database(settings.database_path)
    migrate(engine)
    alice = Accounts(settings.database_path).create("alice", "testing-password")
    with account_sessions(engine, alice["id"])() as db:
        import_games(db, "private", PGN, [], "white")
        private_game = db.scalar(select(Game.id))
    engine.dispose()

    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        assert client.get("/api/auth/me").json() == {"enabled": False, "user": None}
        assert not app.state.settings.accounts_enabled
        assert client.get("/api/games").json()["total"] == 0
        assert client.get(f"/api/games/{private_game}").status_code == 404
        response = client.post(
            "/api/imports", files={"file": ("local.pgn", PGN)}, data={"side": "white"}
        )
        assert response.status_code == 200, response.text
        local_game = client.get("/api/games").json()["items"][0]["id"]
        assert local_game != private_game
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        assert client.get("/api/games").json()["items"][0]["id"] == local_game


def signup(client, name):
    response = client.post(
        "/api/auth/signup", json={"username": name, "password": "testing-password"}, headers=ORIGIN
    )
    assert response.status_code == 201, response.text
    return response.json(), client.cookies.get(COOKIE)


def test_sessions_isolation_csrf_and_restart(settings):
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    settings.stockfish_path = "missing-no-signup-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        assert client.get("/api/games").status_code == 401
        alice, token = signup(client, "alice")
        assert not alice["user"]["admin"]
        headers = ORIGIN | {"X-CSRF-Token": alice["csrf"]}
        assert client.post("/api/games/nope/review", json={}).status_code == 403
        assert (
            client.post(
                "/api/imports",
                files={"file": ("test.pgn", PGN)},
                data={"side": "white"},
                headers=headers,
            ).status_code
            == 200
        )
        game = client.get("/api/games").json()["items"][0]["id"]
        job = client.get("/api/jobs").json()[0]["id"]
        bob, bob_token = signup(client, "bobby")
        assert client.get("/api/games").json()["total"] == 0
        assert client.get("/api/jobs").json() == []
        assert client.get(f"/api/games/{game}").status_code == 404
        assert client.get(f"/api/games/{game}/review?after=0").status_code == 404
        bob_headers = ORIGIN | {"X-CSRF-Token": bob["csrf"]}
        assert (
            client.post(f"/api/games/{game}/review", json={}, headers=bob_headers).status_code
            == 404
        )
        assert client.post(f"/api/jobs/{job}/cancel", headers=bob_headers).status_code == 404
        # Same public game can be stored independently, without global deduplication collisions.
        assert (
            client.post(
                "/api/imports",
                files={"file": ("test.pgn", PGN)},
                data={"side": "white"},
                headers=bob_headers,
            ).status_code
            == 200
        )
        assert client.get("/api/games").json()["items"][0]["id"] != game
        response = client.post(
            "/api/auth/login",
            json={"username": "alice", "password": "testing-password"},
            headers=ORIGIN,
        )
        assert response.status_code == 200
        second = client.cookies.get(COOKIE)
        assert second != token
        assert client.get("/api/games").json()["items"][0]["id"] == game
        assert (
            client.post(
                "/api/auth/logout", headers=ORIGIN | {"X-CSRF-Token": response.json()["csrf"]}
            ).status_code
            == 200
        )
        assert app.state.accounts.resolve(second) is None
        assert app.state.accounts.resolve(token) is not None
        assert app.state.accounts.resolve(bob_token) is not None
    with TestClient(create_app(settings, workers=False)) as client:
        client.cookies.set(COOKIE, token)
        assert client.get("/api/games").json()["items"][0]["id"] == game


def test_database_scope_aggregates_updates_and_references(settings):
    engine, _ = database(settings.database_path)
    migrate(engine)
    accounts = Accounts(settings.database_path)
    a = accounts.create("alice", "testing-password")
    b = accounts.create("bobby", "testing-password")
    sa, sb = account_sessions(engine, a["id"]), account_sessions(engine, b["id"])
    with sa() as db:
        import_games(db, "test", PGN, [], "white")
        game_id = db.scalar(select(Game.id))
        job_id = db.scalar(select(AnalysisJob.id))
    with sb() as db:
        assert db.get(Game, game_id) is None
        assert db.scalar(select(func.count()).select_from(Game)) == 0
        assert db.execute(update(AnalysisJob).values(status="cancelled")).rowcount == 0
        db.add(GameReview(game_id=game_id, job_id=job_id, rating=1000))
        import pytest

        with pytest.raises(ValueError, match="not in this account"):
            db.commit()
    with sa() as db:
        assert db.get(AnalysisJob, job_id).status == "queued"
        assert db.scalar(select(User).where(User.id == a["id"])).username == "alice"
    engine.dispose()


def test_secure_cookie_and_origin(settings):
    settings.accounts_enabled = True
    settings.public_origin = "https://chess.example.test"
    with TestClient(create_app(settings, workers=False), base_url=settings.public_origin) as client:
        payload = {"username": "alice", "password": "testing-password"}
        assert client.post("/api/auth/signup", json=payload, headers=ORIGIN).status_code == 403
        response = client.post(
            "/api/auth/signup", json=payload, headers={"Origin": settings.public_origin}
        )
        cookie = response.headers["set-cookie"].lower()
        assert "secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie
        assert client.get("/api/auth/me").json()["user"]["username"] == "alice"


def test_account_migration_preserves_existing_learning_history(settings):
    from alembic import command
    from alembic.config import Config
    from lesson_fixtures import seed_lesson

    engine, sessions = database(settings.database_path)
    migrate(engine)
    with sessions() as db:
        seed_lesson(db, settings, count=3)
    config = Config("alembic.ini")
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        config.attributes["connection"] = connection
        command.downgrade(config, "04af728d913e")
        connection.commit()
        tables = [
            row[0]
            for row in connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version'"
            )
        ]
        before = {
            table: [
                dict(row)
                for row in connection.exec_driver_sql(
                    f'SELECT * FROM "{table}" ORDER BY rowid'
                ).mappings()
            ]
            for table in tables
        }
    migrate(engine)
    with engine.connect() as connection:
        for table, rows in before.items():
            after = [
                dict(row)
                for row in connection.exec_driver_sql(
                    f'SELECT * FROM "{table}" ORDER BY rowid'
                ).mappings()
            ]
            assert [
                {k: v for k, v in row.items() if k not in {"user_id", "played_at", "move_count"}}
                for row in after
            ] == rows
            assert all(row.get("user_id", "local") == "local" for row in after)
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
        assert (
            connection.exec_driver_sql("SELECT disabled FROM users WHERE id='local'").scalar() == 1
        )
    engine.dispose()


def test_failed_sign_ins_count_against_limits_but_successful_ones_do_not(settings):
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    settings.stockfish_path = "missing-no-signup-engine"
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        signup(client, "alice")

        def login(password):
            return client.post(
                "/api/auth/login",
                json={"username": "alice", "password": password},
                headers=ORIGIN,
            )

        # Eight good sign-ins exceed the old per-username limit without being refused.
        for _ in range(8):
            assert login("testing-password").status_code == 200
        for index in range(6):
            assert login("wrong-password-1").status_code == 401, index
        assert login("testing-password").status_code == 429
