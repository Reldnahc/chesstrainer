import json
import threading
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.game_providers.base import ImportCancelled, ProviderError
from trainer.game_providers.ingest import fetch_import
from trainer.game_providers.lichess import LichessClient
from trainer.models import AnalysisJob, Game, ProviderCheckpoint, ProviderImport

PGN = '[Site "https://lichess.org/abcd1234"]\n[White "Learner"]\n[Black "Opponent"]\n[WhiteElo "1500"]\n[BlackElo "1400"]\n[TimeControl "180+2"]\n\n1. f3 e5 2. g4 Qh4# 0-1'


def record(id="abcd1234", **changes):
    return dict(
        id=id,
        pgn=PGN,
        variant="standard",
        speed="blitz",
        status="mate",
        lastMoveAt=1770000000000,
        players={"white": {"user": {"name": "Learner"}}, "black": {"user": {"name": "Opponent"}}},
        **changes,
    )


def source(sessions, **changes):
    with sessions() as db:
        job = AnalysisJob(
            kind="provider_fetch", created_at=datetime(2026, 3, 1, tzinfo=timezone.utc)
        )
        db.add(job)
        db.flush()
        db.add(
            ProviderImport(
                job_id=job.id,
                provider="lichess",
                username="learner",
                months=0,
                max_games=100,
                time_class="all",
                **changes,
            )
        )
        db.commit()
        return job.id


def client(settings, rows, seen=None):
    def response(request):
        if seen is not None:
            seen.append(request)
        return httpx.Response(200, content="\n".join(json.dumps(row) for row in rows))

    return LichessClient(settings, transport=httpx.MockTransport(response))


def run(job, sessions, settings, remote, cancelled=lambda: False):
    try:
        fetch_import(job, sessions, settings, remote, cancelled, threading.Lock())
    finally:
        remote.close()


def test_lichess_shared_ingest_preserves_pgn_and_deduplicates(settings, sessions):
    seen = []
    job = source(sessions)
    run(job, sessions, settings, client(settings, [record()], seen))
    with sessions() as db:
        saved = db.scalar(select(Game))
        assert "lichess.org/abcd1234" in saved.pgn
        assert '[WhiteElo "1500"]' in saved.pgn
        assert saved.learner_color is True
        assert saved.played_at.year == 2026
        request = db.get(ProviderImport, job)
        assert request.games_imported == 1 and request.fetch_completed
    assert seen[0].url.host == "lichess.org"
    assert seen[0].url.params["evals"] == "false"
    assert seen[0].url.params["ongoing"] == "false"
    again = source(sessions)
    run(again, sessions, settings, client(settings, [record()]))
    with sessions() as db:
        assert db.scalar(select(func.count()).select_from(Game)) == 1
        assert db.get(ProviderImport, again).duplicates == 1


def test_lichess_resume_preserves_completed_records(settings, sessions):
    job = source(sessions)
    with pytest.raises(ProviderError, match="invalid"):
        run(job, sessions, settings, client(settings, [record(), {"id": "bad"}]))
    with sessions() as db:
        assert db.get(ProviderImport, job).games_imported == 1
        assert db.get(ProviderCheckpoint, (job, "https://lichess.org/abcd1234"))
    run(job, sessions, settings, client(settings, [record()]))
    with sessions() as db:
        saved = db.get(ProviderImport, job)
        assert saved.games_imported == 1 and saved.duplicates == 0 and saved.fetch_completed


@pytest.mark.parametrize(
    "field,value", [("status", "started"), ("variant", "chess960"), ("variant", "antichess")]
)
def test_lichess_excludes_unfinished_and_variants(settings, sessions, field, value):
    row = record()
    row[field] = value
    job = source(sessions)
    run(job, sessions, settings, client(settings, [row]))
    with sessions() as db:
        assert db.get(ProviderImport, job).games_imported == 0
        assert db.get(ProviderImport, job).filtered == 1


@pytest.mark.parametrize("status", [404, 429, 302, 503])
def test_lichess_errors_do_not_follow_redirects_or_retry_rate_limits(settings, sessions, status):
    seen = []

    def response(request):
        seen.append(request)
        return httpx.Response(
            status, headers={"Location": "https://elsewhere.invalid", "Retry-After": "60"}
        )

    with pytest.raises(ProviderError):
        run(
            source(sessions),
            sessions,
            settings,
            LichessClient(settings, transport=httpx.MockTransport(response)),
        )
    assert len(seen) == 1


def test_lichess_bounds_and_cancellation(settings, sessions):
    settings.provider_max_response_bytes = 1000
    with pytest.raises(ProviderError, match="response limit"):
        run(source(sessions), sessions, settings, client(settings, [record()] * 10))
    remote = client(settings, [record()])
    with pytest.raises(ImportCancelled):
        run(source(sessions), sessions, settings, remote, lambda: True)


def test_generic_api_connections_and_fetch_jobs_never_start_engine(settings):
    factories = {"lichess": lambda s: client(s, [record()])}
    app = create_app(settings, workers=False, start_engine=False, provider_factories=factories)
    with TestClient(app) as api:
        assert {p["id"] for p in api.get("/api/game-providers").json()} == {"lichess", "chesscom"}
        assert (
            api.put("/api/providers/unknown/connection", json={"username": "learner"}).status_code
            == 404
        )
        assert (
            api.put("/api/providers/lichess/connection", json={"username": "../bad"}).status_code
            == 422
        )
        assert (
            api.put("/api/providers/lichess/connection", json={"username": " Learner "}).json()[
                "username"
            ]
            == "learner"
        )
        assert api.get("/api/providers/chesscom/sync").json()["username"] == ""
        response = api.post(
            "/api/imports/provider/lichess",
            json={"username": "learner", "months": 0, "time_class": "all", "analyze": False},
        )
        assert response.status_code == 202
        job = response.json()["job_id"]
        assert (
            api.post(
                "/api/imports/provider/lichess",
                json={"username": "learner", "months": 0, "time_class": "all", "analyze": False},
            ).json()["job_id"]
            == job
        )
        assert (
            api.post(
                "/api/imports/provider/lichess", json={"username": "learner", "time_class": "daily"}
            ).status_code
            == 422
        )
        app.state.runner.run_job(job)
        saved = api.get("/api/jobs").json()[0]
        assert saved["status"] == "completed" and saved["positions_triaged"] == 0
        assert saved["provider_import"]["provider"] == "lichess" and saved["chesscom"] is None
        sync = api.post("/api/providers/lichess/sync").json()
        assert sync["provider"] == "lichess"
        assert api.post("/api/providers/lichess/sync").json()["job_id"] == sync["job_id"]
        assert (
            api.put("/api/providers/lichess/connection", json={"username": ""}).json()["username"]
            == ""
        )
        assert api.post("/api/providers/lichess/sync").status_code == 422


def test_provider_connections_are_account_scoped_and_persist(settings):
    from test_accounts import ORIGIN, signup

    settings.accounts_enabled = True
    settings.public_origin = ORIGIN["Origin"]
    settings.session_secure = False
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as api:
        alice, _ = signup(api, "alice")
        headers = ORIGIN | {"X-CSRF-Token": alice["csrf"]}
        assert (
            api.put(
                "/api/providers/lichess/connection",
                json={"username": "AliceChess"},
                headers=headers,
            ).status_code
            == 200
        )
        assert (
            api.put(
                "/api/providers/chesscom/connection", json={"username": "AliceCom"}, headers=headers
            ).status_code
            == 200
        )
        api.post("/api/auth/logout", headers=headers)
        bob, _ = signup(api, "bob")
        assert api.get("/api/providers/lichess/sync").json()["username"] == ""
        headers = ORIGIN | {"X-CSRF-Token": bob["csrf"]}
        api.put("/api/providers/lichess/connection", json={"username": "BobChess"}, headers=headers)
    with TestClient(create_app(settings, workers=False, start_engine=False)) as api:
        api.post(
            "/api/auth/login",
            json={"username": "alice", "password": "testing-password"},
            headers=ORIGIN,
        )
        assert api.get("/api/providers/lichess/sync").json()["username"] == "alicechess"
        assert api.get("/api/providers/chesscom/sync").json()["username"] == "alicecom"


def test_provider_migration_preserves_saved_chesscom_name(settings):
    from alembic import command
    from alembic.config import Config
    from trainer.db import database, migrate

    engine, _ = database(settings.database_path)
    config = Config("alembic.ini")
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "21f2bf8ba641")
        connection.exec_driver_sql(
            "UPDATE users SET chesscom_username = 'learner' WHERE id = 'local'"
        )
    migrate(engine)
    with engine.connect() as connection:
        assert (
            connection.exec_driver_sql(
                "SELECT username FROM provider_connections WHERE user_id = 'local' AND provider = 'chesscom'"
            ).scalar()
            == "learner"
        )
    engine.dispose()


def test_lichess_date_window_and_black_learner(settings, sessions):
    from datetime import date

    row = record()
    row["players"]["white"]["user"]["name"] = "Opponent"
    row["players"]["black"]["user"]["name"] = "Learner"
    row["pgn"] = PGN.replace('[White "Learner"]', '[White "Opponent"]').replace(
        '[Black "Opponent"]', '[Black "Learner"]'
    )
    seen = []
    job = source(sessions, start_date=date(2026, 2, 1), end_date=date(2026, 2, 28))
    run(job, sessions, settings, client(settings, [row], seen))
    assert seen[0].url.params["since"] == "1769904000000"
    assert seen[0].url.params["until"] == "1772323199999"
    with sessions() as db:
        assert db.scalar(select(Game)).learner_color is False


def test_lichess_limit_closes_stream_without_consuming_bad_followup(settings, sessions):
    job = source(sessions)
    with sessions() as db:
        db.get(ProviderImport, job).max_games = 1
        db.commit()
    run(job, sessions, settings, client(settings, [record(), {"id": "invalid"}]))
    with sessions() as db:
        assert db.get(ProviderImport, job).games_imported == 1
        assert db.get(ProviderImport, job).fetch_completed


def test_rate_limit_pauses_later_jobs_on_the_host(settings):
    seen = []

    def response(request):
        seen.append(request)
        return httpx.Response(429)

    app = create_app(
        settings,
        workers=False,
        start_engine=False,
        provider_factories={
            "lichess": lambda s: LichessClient(s, transport=httpx.MockTransport(response)),
        },
    )
    with TestClient(app) as api:
        for name in ["one", "two"]:
            job = api.post(
                "/api/imports/provider/lichess", json={"username": name, "analyze": False}
            ).json()["job_id"]
            app.state.runner.run_job(job)
        assert len(seen) == 1
        assert all(
            row["status"] == "failed" and "minute" in row["error"]
            for row in api.get("/api/jobs").json()
        )
