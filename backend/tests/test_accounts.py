"""Adversarial multi-account requests and durable sessions in one database."""

import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from trainer.accounts import COOKIE, Accounts
from trainer.api import create_app
from trainer.db import database, migrate
from trainer.errors import Conflict, NotFound
from trainer.imports import import_games
from trainer.models import AnalysisJob, Game, GameReview, User
from trainer.ownership import account_sessions

ORIGIN = {"Origin": "http://testserver"}
PGN = '[White "Learner"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'
# The stored switch; conftest opens sign-ups for every other test.
STORED_SIGNUPS = Accounts.signups_open


@pytest.mark.parametrize("origin", ["", "https://chess.example.test"])
def test_disabled_accounts_use_local_workspace_without_exposing_accounts(settings, origin):
    settings.accounts_enabled = False  # The container default must not force login.
    settings.public_origin = origin
    engine, local_sessions = database(settings.database_path)
    migrate(engine)
    alice = Accounts(settings.database_path).create("alice", "testing-password")
    with account_sessions(engine, alice["id"])() as db:
        import_games(db, "private", PGN, [], "white")
        db.commit()
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


def test_accounts_without_public_origin_accept_only_their_own_host(settings):
    settings.accounts_enabled = True
    settings.session_secure = False
    settings.stockfish_path = "missing-no-signup-engine"
    payload = {"username": "host-user", "password": "testing-password"}
    with TestClient(
        create_app(settings, workers=False), base_url="http://club.lan:18000"
    ) as client:
        assert client.get("/api/auth/me").json()["enabled"]
        for origin in ("http://evil.example", "http://club.lan", None):
            headers = {"Origin": origin} if origin else {}
            denied = client.post("/api/auth/signup", json=payload, headers=headers)
            assert denied.status_code == 403
            assert "PUBLIC_ORIGIN" in denied.json()["detail"]
        # TLS usually ends at the proxy, so the browser's https scheme still matches.
        for origin in ("http://club.lan:18000", "https://CLUB.lan:18000"):
            response = client.post(
                "/api/auth/signup",
                json=payload | {"username": f"host-{len(origin)}"},
                headers={"Origin": origin},
            )
            assert response.status_code == 201, response.text
    settings.session_secure = True
    with TestClient(
        create_app(settings, workers=False), base_url="http://club.lan:18000"
    ) as client:
        # Secure cookies would never come back over LAN HTTP, so explain instead.
        response = client.post(
            "/api/auth/signup", json=payload, headers={"Origin": "http://club.lan:18000"}
        )
        assert response.status_code == 403
        assert "SESSION_SECURE=false" in response.json()["detail"]
    # PUBLIC_ORIGIN adds the proxy address without locking out the server's own address.
    settings.session_secure = False
    settings.public_origin = "https://chess.example.test"
    with TestClient(
        create_app(settings, workers=False), base_url="http://club.lan:18000"
    ) as client:
        for origin in ("https://chess.example.test", "http://club.lan:18000"):
            response = client.post(
                "/api/auth/signup",
                json=payload | {"username": f"pinned-{len(origin)}"},
                headers={"Origin": origin},
            )
            assert response.status_code == 201, response.text
        denied = client.post(
            "/api/auth/signup", json=payload, headers={"Origin": "http://evil.example"}
        )
        assert denied.status_code == 403
        assert "https://chess.example.test" in denied.json()["detail"]
    # With secure cookies on, plain HTTP works only between LAN addresses.
    settings.session_secure = True
    for base, peer, allowed in (
        ("http://192.168.1.243:18000", "192.168.1.20", True),
        ("http://club.lan:18000", "10.0.0.7", True),
        ("http://192.168.1.243:18000", "8.8.8.8", False),
        ("http://chess.example.test", "192.168.1.20", False),
    ):
        with TestClient(
            create_app(settings, workers=False), base_url=base, client=(peer, 50000)
        ) as client:
            response = client.post(
                "/api/auth/signup",
                json=payload | {"username": f"lan-{peer.replace('.', '-')}-{len(base)}"},
                headers={"Origin": base},
            )
            if allowed:
                assert response.status_code == 201, response.text
                cookie = response.headers["set-cookie"].lower()
                assert "httponly" in cookie and "secure" not in cookie
            else:
                assert response.status_code == 403
                assert "SESSION_SECURE=false" in response.json()["detail"]
    # A proxy that rewrites Host to the LAN address still serves an https page.
    with TestClient(
        create_app(settings, workers=False),
        base_url="http://192.168.1.243:18000",
        client=("192.168.1.2", 50000),
    ) as client:
        response = client.post(
            "/api/auth/signup",
            json=payload | {"username": "behind-proxy"},
            headers={"Origin": "https://chess.example.test"},
        )
        assert response.status_code == 201, response.text
        assert "secure" in response.headers["set-cookie"].lower()


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
        # The upload queued this game's own analysis job; reviewing reuses it.
        job = client.post(f"/api/games/{game}/review", json={}, headers=headers).json()["job_id"]
        bob, bob_token = signup(client, "bobby")
        assert client.get("/api/games").json()["total"] == 0
        assert client.get("/api/jobs").json() == []
        # A game link opens read-only for another account, without the owner's history.
        shared = client.get(f"/api/games/{game}").json()
        assert shared["read_only"] and "history" not in shared
        assert client.get(f"/api/games/{game}/review?after=0").status_code == 200
        bob_headers = ORIGIN | {"X-CSRF-Token": bob["csrf"]}
        assert (
            client.post(
                f"/api/games/{game}/position", json={"ply": 1}, headers=bob_headers
            ).status_code
            == 200
        )
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
        owned = client.get(f"/api/games/{game}").json()
        assert not owned["read_only"] and "history" in owned
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
        # Signed out, the link still opens the review and steps through moves.
        assert client.get(f"/api/games/{game}").json()["read_only"]
        assert client.get(f"/api/games/{game}/review?after=0").status_code == 200
        assert (
            client.post(f"/api/games/{game}/position", json={"ply": 1}, headers=ORIGIN).status_code
            == 200
        )
        assert client.get("/api/games/missing").status_code == 404
        # Everything else, including engine analysis and the library, needs an account.
        assert client.get("/api/games").status_code == 401
        assert client.post(f"/api/games/{game}/review", json={}, headers=ORIGIN).status_code == 401
        assert client.post(f"/api/games/{game}/analyze", json={}, headers=ORIGIN).status_code == 401
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
        db.commit()
        game_id = db.scalar(select(Game.id))
        job = AnalysisJob(kind="classification")
        db.add(job)
        db.commit()
        job_id = job.id
    with sb() as db:
        assert db.get(Game, game_id) is None
        assert db.scalar(select(func.count()).select_from(Game)) == 0
        assert db.execute(update(AnalysisJob).values(status="cancelled")).rowcount == 0
        db.add(GameReview(game_id=game_id, job_id=job_id, rating=1000))
        import pytest

        with pytest.raises(NotFound, match="not in this account"):
            db.commit()
    with sa() as db:
        assert db.get(AnalysisJob, job_id).status == "queued"
        assert db.scalar(select(User).where(User.id == a["id"])).username == "alice"
    engine.dispose()


def test_bulk_writes_cannot_cross_accounts(settings):
    import pytest

    engine, _ = database(settings.database_path)
    migrate(engine)
    accounts = Accounts(settings.database_path)
    a = accounts.create("alice", "testing-password")
    b = accounts.create("bobby", "testing-password")
    sa, sb = account_sessions(engine, a["id"]), account_sessions(engine, b["id"])
    with sa() as db:
        import_games(db, "test", PGN, [], "white")
        db.commit()
        game_id = db.scalar(select(Game.id))
    with sb() as db:
        with pytest.raises(ValueError, match="Bulk writes"):
            db.execute(update(Game), [{"id": game_id, "white": "Changed"}])
        with pytest.raises(ValueError, match="validated ORM writes"):
            db.execute(
                update(Game).where(Game.id == game_id).ordered_values((Game.user_id, b["id"]))
            )
        with pytest.raises(ValueError, match="Bulk writes"):
            db.bulk_update_mappings(Game, [{"id": game_id, "white": "Changed"}])
        with pytest.raises(ValueError, match="Bulk writes"):
            db.bulk_insert_mappings(Game, [{"fingerprint": "x", "pgn": "", "user_id": a["id"]}])
        with pytest.raises(ValueError, match="Bulk writes"):
            db.bulk_save_objects([Game(fingerprint="y", pgn="")])
    with sa() as db:
        game = db.get(Game, game_id)
        assert game.user_id == a["id"] and game.white != "Changed"
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
    import sqlalchemy
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
    # Later migrations dropped the archived lesson tables and their link columns,
    # and replaced side text, epoch times and the PGN date with one representation
    # each (their values are checked in test_migrations); classification runs lost
    # the hosted-model prompt version and token counts.
    dropped = {
        "lesson_item_id",
        "repertoire_id",
        "orientation",
        "color",
        "created",
        "expires",
        "played_on",
        "chesscom_username",
        "prompt_version",
        "input_tokens",
        "output_tokens",
    }
    current = set(sqlalchemy.inspect(engine).get_table_names())
    with engine.connect() as connection:
        for table, rows in before.items():
            if table not in current:
                continue
            rows = [{k: v for k, v in row.items() if k not in dropped} for row in rows]
            after = [
                dict(row)
                for row in connection.exec_driver_sql(
                    f'SELECT * FROM "{table}" ORDER BY rowid'
                ).mappings()
            ]
            kept = set(rows[0]) if rows else set()
            assert [
                {
                    k: v
                    for k, v in row.items()
                    if k in kept and k not in {"user_id", "played_at", "move_count", "rated"}
                }
                for row in after
            ] == [
                {k: v for k, v in row.items() if k not in {"played_at", "move_count", "rated"}}
                for row in rows
            ]
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


def test_promote_grants_admin_to_an_existing_account_only(settings, monkeypatch, capsys):
    from trainer import accounts as accounts_module

    engine, _ = database(settings.database_path)
    migrate(engine)
    engine.dispose()
    accounts = Accounts(settings.database_path)
    friend = accounts.create("friend", "correct horse battery")
    token = accounts.issue(friend["id"])
    monkeypatch.setattr(accounts_module, "Settings", lambda: settings)

    def run(*argv):
        monkeypatch.setattr("sys.argv", ["trainer.accounts", *argv])
        with pytest.raises(SystemExit) as exit_info:
            accounts_module.main()
            raise SystemExit(0)
        return exit_info.value.code

    assert run("promote", "Friend") == 0
    assert "promote completed" in capsys.readouterr().out
    # The open session is kept and sees the new privilege on its next request.
    assert accounts.resolve(token)["admin"] == 1
    assert run("promote", "friend") == 1
    assert "already an administrator" in capsys.readouterr().err
    assert run("promote", "nobody") == 1
    assert "Account not found" in capsys.readouterr().err
    # The unclaimed local workspace is not an account the CLI can change.
    assert run("promote", "__local__") == 1
    assert "Account not found" in capsys.readouterr().err


@pytest.mark.pristine_database
def test_account_commands_explain_a_busy_database_and_a_missing_terminal(
    settings, monkeypatch, capsys
):
    import io
    import sqlite3

    from alembic import command
    from alembic.config import Config
    from trainer import accounts as accounts_module
    from trainer import db as db_module

    # A server mid-upgrade holds the write lock on a database behind the code.
    engine, _ = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "e2a4c6b8d0f1")
    engine.dispose()
    monkeypatch.setattr(accounts_module, "Settings", lambda: settings)
    monkeypatch.setattr(db_module, "database", lambda path: database(path, timeout=0.1))

    def run(*argv):
        monkeypatch.setattr("sys.argv", ["trainer.accounts", *argv])
        with pytest.raises(SystemExit) as exit_info:
            accounts_module.main()
            raise SystemExit(0)
        return exit_info.value.code

    server = sqlite3.connect(settings.database_path, isolation_level=None)
    server.execute("BEGIN IMMEDIATE")
    try:
        assert run("promote", "friend") == 1
        err = capsys.readouterr().err
        assert "Upgrading the database first" in err and "still upgrading" in err
    finally:
        server.execute("ROLLBACK")
        server.close()
    # Once upgraded, the commands no longer touch the schema.
    assert run("promote", "nobody") == 1
    assert "Account not found" in capsys.readouterr().err
    engine, _ = database(settings.database_path)
    assert db_module.migrations_pending(engine) is False
    engine.dispose()
    # Without -it, a password prompt fails at once instead of waiting forever.
    Accounts(settings.database_path).create("friend", "correct horse battery")
    monkeypatch.setattr("sys.stdin", io.StringIO(""))
    assert run("reset-password", "friend") == 1
    assert "docker exec -it" in capsys.readouterr().err


def test_administrators_manage_other_accounts_from_settings(settings):
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    settings.stockfish_path = "missing-no-signup-engine"
    app = create_app(settings, workers=False)
    accounts = Accounts(settings.database_path)
    with TestClient(app) as client:
        admin = accounts.create("keeper", "testing-password", admin=True)
        friend, _ = signup(client, "friend")
        friend_id = friend["user"]["id"]
        headers = ORIGIN | {"X-CSRF-Token": friend["csrf"]}
        assert (
            client.post(
                "/api/imports",
                files={"file": ("test.pgn", PGN)},
                data={"side": "white"},
                headers=headers,
            ).status_code
            == 200
        )
        assert client.get("/api/auth/accounts").status_code == 403
        assert (
            client.delete("/api/auth/accounts/" + admin["id"], headers=headers).status_code == 403
        )

        def sign_in(name, password="testing-password"):
            response = client.post(
                "/api/auth/login", json={"username": name, "password": password}, headers=ORIGIN
            )
            return response.status_code, ORIGIN | {"X-CSRF-Token": response.json().get("csrf", "")}

        status, headers = sign_in("keeper")
        assert status == 200
        listed = client.get("/api/auth/accounts").json()["accounts"]
        assert [(row["username"], row["admin"], row["disabled"]) for row in listed] == [
            ("keeper", True, False),
            ("friend", False, False),
        ]
        assert set(listed[0]) == {"id", "username", "admin", "disabled", "created"}
        # Administrators cannot lock themselves out or remove their own account.
        own = "/api/auth/accounts/" + admin["id"]
        assert client.delete(own, headers=headers).status_code == 409
        assert (
            client.post(own + "/access", json={"disabled": True}, headers=headers).status_code
            == 409
        )
        assert client.delete("/api/auth/accounts/missing", headers=headers).status_code == 404

        target = "/api/auth/accounts/" + friend_id
        assert (
            client.post(
                target + "/password", json={"password": "short"}, headers=headers
            ).status_code
            == 422
        )
        assert (
            client.post(
                target + "/password", json={"password": "a-new-password"}, headers=headers
            ).status_code
            == 200
        )
        assert (
            client.post(target + "/access", json={"disabled": True}, headers=headers).status_code
            == 200
        )
        assert sign_in("friend", "a-new-password")[0] == 401
        _, headers = sign_in("keeper")
        assert (
            client.post(target + "/access", json={"disabled": False}, headers=headers).status_code
            == 200
        )
        assert sign_in("friend", "testing-password")[0] == 401
        assert sign_in("friend", "a-new-password")[0] == 200
        # The administrator's password is temporary: only choosing a new one is allowed.
        assert client.get("/api/auth/me").json()["user"]["password_change_required"]
        blocked = client.get("/api/games")
        assert blocked.status_code == 403
        assert blocked.json()["detail"] == "Choose a new password to continue."
        _, headers = sign_in("keeper")
        assert client.post(target + "/admin", headers=headers).status_code == 200
        repeat = client.post(target + "/admin", headers=headers)
        assert repeat.status_code == 409
        assert repeat.json()["detail"] == "Account is already an administrator."

        with closing(sqlite3.connect(settings.database_path)) as db, db:
            db.execute("UPDATE analysis_jobs SET status='running' WHERE user_id=?", (friend_id,))
        assert "analysis running" in client.delete(target, headers=headers).json()["detail"]
        with closing(sqlite3.connect(settings.database_path)) as db, db:
            db.execute("UPDATE analysis_jobs SET status='queued' WHERE user_id=?", (friend_id,))
        deleted = client.delete(target, headers=headers)
        assert deleted.status_code == 200, deleted.text
        assert [row["username"] for row in client.get("/api/auth/accounts").json()["accounts"]] == [
            "keeper"
        ]
        with closing(sqlite3.connect(settings.database_path)) as db, db:
            tables = [
                row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")
            ]
            owned = 0
            for table in tables:
                columns = {column[1] for column in db.execute(f'PRAGMA table_info("{table}")')}
                if "user_id" in columns:
                    owned += db.execute(
                        f'SELECT count(*) FROM "{table}" WHERE user_id=?', (friend_id,)
                    ).fetchone()[0]
        assert owned == 0
        assert sign_in("friend", "a-new-password")[0] == 401


def test_signups_start_closed_and_administrators_add_members(settings, monkeypatch, capsys):
    monkeypatch.setattr(Accounts, "signups_open", STORED_SIGNUPS)
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    settings.stockfish_path = "missing-no-signup-engine"
    accounts = Accounts(settings.database_path)
    payload = {"username": "stranger", "password": "testing-password"}
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get("/api/auth/me").json()["signups_open"] is False
        closed = client.post("/api/auth/signup", json=payload, headers=ORIGIN)
        assert closed.status_code == 403
        assert closed.json()["detail"].startswith("Sign-ups are closed.")
        assert accounts.by_name("stranger") is None

        accounts.create("keeper", "testing-password", admin=True)
        response = client.post(
            "/api/auth/login",
            json={"username": "keeper", "password": "testing-password"},
            headers=ORIGIN,
        )
        headers = ORIGIN | {"X-CSRF-Token": response.json()["csrf"]}
        assert client.get("/api/auth/accounts").json()["signups_open"] is False
        new = {"username": "Friend", "password": "a-temporary-pass"}
        assert client.post("/api/auth/accounts", json=new, headers=headers).status_code == 201
        repeat = client.post("/api/auth/accounts", json=new, headers=headers)
        assert repeat.status_code == 409
        assert repeat.json()["detail"] == "That username is unavailable."
        assert (
            client.post("/api/auth/accounts", json=new, headers=ORIGIN).status_code == 403
        )  # CSRF still applies.

        # The new member signs in with the temporary password and must replace it.
        client.post("/api/auth/logout", headers=headers)
        response = client.post(
            "/api/auth/login",
            json={"username": "friend", "password": "a-temporary-pass"},
            headers=ORIGIN,
        )
        assert response.status_code == 200
        friend = response.json()
        assert friend["user"]["password_change_required"] and not friend["user"]["admin"]
        friend_headers = ORIGIN | {"X-CSRF-Token": friend["csrf"]}
        assert client.get("/api/games").status_code == 403
        # Members cannot add accounts or open sign-ups.
        changed = client.post(
            "/api/auth/password",
            json={"current_password": "a-temporary-pass", "new_password": "friend-password"},
            headers=friend_headers,
        )
        assert changed.status_code == 200
        assert (
            client.post("/api/auth/accounts", json=payload, headers=friend_headers).status_code
            == 403
        )
        assert (
            client.put("/api/auth/signups", json={"open": True}, headers=friend_headers).status_code
            == 403
        )

        response = client.post(
            "/api/auth/login",
            json={"username": "keeper", "password": "testing-password"},
            headers=ORIGIN,
        )
        headers = ORIGIN | {"X-CSRF-Token": response.json()["csrf"]}
        assert (
            client.put("/api/auth/signups", json={"open": True}, headers=headers).status_code == 200
        )
        assert client.get("/api/auth/accounts").json()["signups_open"] is True
        client.post("/api/auth/logout", headers=headers)
        assert client.get("/api/auth/me").json()["signups_open"] is True
        opened = client.post("/api/auth/signup", json=payload, headers=ORIGIN)
        assert opened.status_code == 201, opened.text
        assert not opened.json()["user"]["admin"]

    # Host operators can flip the same switch without signing in.
    from trainer import accounts as module

    monkeypatch.setattr(module, "Settings", lambda: settings)
    monkeypatch.setattr("sys.argv", ["trainer.accounts", "close-signups"])
    module.main()
    assert accounts.signups_open() is False
    assert "Sign-ups are closed" in capsys.readouterr().out


def test_members_change_their_own_password_and_keep_this_device(settings):
    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    settings.stockfish_path = "missing-no-signup-engine"
    app = create_app(settings, workers=False)
    accounts = Accounts(settings.database_path)
    with TestClient(app) as client:
        member, _ = signup(client, "member")
        other_device = accounts.issue(member["user"]["id"])
        headers = ORIGIN | {"X-CSRF-Token": member["csrf"]}

        def change(current, new):
            return client.post(
                "/api/auth/password",
                json={"current_password": current, "new_password": new},
                headers=headers,
            )

        assert change("wrong-password", "another-password").status_code == 403
        assert change("testing-password", "testing-password").status_code == 422
        assert change("testing-password", "short").status_code == 422
        changed = change("testing-password", "another-password")
        assert changed.status_code == 200, changed.text
        assert changed.json()["user"]["username"] == "member"
        assert client.get("/api/games").status_code == 200
        assert accounts.resolve(other_device) is None
        relogin = client.post(
            "/api/auth/login",
            json={"username": "member", "password": "another-password"},
            headers=ORIGIN,
        )
        assert relogin.status_code == 200

        # After an administrator's reset, choosing a new password lifts the block.
        accounts.set_password(accounts.by_name("member"), "temporary-pass", temporary=True)
        login = client.post(
            "/api/auth/login",
            json={"username": "member", "password": "temporary-pass"},
            headers=ORIGIN,
        ).json()
        assert login["user"]["password_change_required"]
        headers = ORIGIN | {"X-CSRF-Token": login["csrf"]}
        assert client.get("/api/games").status_code == 403
        cleared = change("temporary-pass", "my-own-password")
        assert not cleared.json()["user"]["password_change_required"]
        assert client.get("/api/games").status_code == 200


def test_a_disabled_account_with_interrupted_analysis_can_still_be_deleted(settings):
    from sqlalchemy.orm import Session
    from trainer.job_queue import JobQueue

    engine, _ = database(settings.database_path)
    migrate(engine)
    accounts = Accounts(settings.database_path)
    friend = accounts.create("friend", "testing-password")
    with Session(engine) as db:
        db.add(AnalysisJob(user_id=friend["id"], kind="game_review", status="running"))
        db.commit()
    accounts.set_disabled(friend, True)
    with pytest.raises(Conflict, match="analysis running"):
        accounts.delete(accounts.by_id(friend["id"]))
    # A restart interrupted that job; recovery requeues it even for a disabled owner.
    JobQueue(engine).recover()
    accounts.delete(accounts.by_id(friend["id"]))
    assert accounts.by_id(friend["id"]) is None
    engine.dispose()
