from datetime import datetime, timedelta, timezone

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from test_accounts import ORIGIN, signup
from trainer.api import create_app
from trainer.chesscom import ChessComClient
from trainer.game_analysis import FRESH, REQUESTED
from trainer.models import AnalysisJob, ChessComImport, EngineAnalysis, Game, ImportBatch


def test_sync_fetches_recent_games_and_queues_fresh_analysis_without_running_engine(settings):
    settings.accounts_enabled = True
    settings.public_origin = "http://testserver"
    settings.session_secure = False
    current = datetime.now(timezone.utc)
    root = "https://api.chess.com/pub/player/learner/games"
    archive = root + current.strftime("/%Y/%m")
    entries = []
    for i in range(3):
        entries.append(
            {
                "rules": "chess",
                "time_class": "blitz",
                "end_time": current.timestamp() - i,
                "white": {"username": "Learner"},
                "black": {"username": "Opponent"},
                "pgn": f'[White "Learner"]\n[Black "Opponent"]\n[Round "{i}"]\n[UTCDate "{current:%Y.%m.%d}"]\n[UTCTime "10:00:0{2 - i}"]\n\n1. e4 e5 1/2-1/2',
            }
        )
    calls = []

    def client_factory(config):
        def respond(request):
            calls.append(str(request.url))
            assert str(request.url) in {root + "/archives", archive}
            return httpx.Response(
                200,
                json={"archives": [archive]}
                if str(request.url).endswith("archives")
                else {"games": entries},
            )

        return ChessComClient(config, transport=httpx.MockTransport(respond))

    def forbidden_engine(*args):
        raise AssertionError("Signup and sync must never instantiate Stockfish")

    app = create_app(
        settings, workers=False, engine_factory=forbidden_engine, chesscom_factory=client_factory
    )
    with TestClient(app) as client:
        identity, _ = signup(client, "alice")
        headers = ORIGIN | {"X-CSRF-Token": identity["csrf"]}
        saved = client.put(
            "/api/providers/chesscom/connection", json={"username": " Learner "}, headers=headers
        )
        assert saved.status_code == 200, saved.text
        assert saved.json()["username"] == "learner"
        job = client.post("/api/sync", headers=headers).json()
        assert client.post("/api/sync", headers=headers).json()["job_id"] == job["job_id"]
        sessions = app.state.workspaces.sessions(identity["user"]["id"])
        with sessions() as db:
            db.get(ChessComImport, job["job_id"]).max_games = 2
            db.commit()
        assert app.state.runner.claim() is None
        assert app.state.runner.claim(sync_only=True) == job["job_id"]
        app.state.runner.run_job(job["job_id"])
        result = client.get("/api/games").json()
        assert result["total"] == 2
        # Every fetched game queues one analysis job; fetching itself never searches.
        assert all(item["status"] == "queued" for item in result["items"])
        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(EngineAnalysis)) == 0
            queued = db.scalars(select(AnalysisJob).where(AnalysisJob.kind == "game_review")).all()
            assert len(queued) == 2 and {job.priority for job in queued} == {FRESH}
            assert db.scalar(select(ImportBatch)).original_pgn == ""
            assert '[Round "0"]' in db.get(Game, result["items"][0]["id"]).pgn
            db.get(AnalysisJob, job["job_id"]).created_at = current - timedelta(minutes=2)
            db.commit()
        client.post("/api/sync", headers=headers)
        with sessions() as db:
            db.get(ChessComImport, job["job_id"]).max_games = 2
            db.commit()
        app.state.runner.run_job(job["job_id"])
        assert client.get("/api/games").json()["total"] == 2  # No creeping backfill of old games.
        assert len(calls) == 4
        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(AnalysisJob)) == 3
        # A game fetched earlier remains eligible for explicit training analysis.
        selected = result["items"][0]["id"]
        training = client.post(f"/api/games/{selected}/train", headers=headers)
        assert training.status_code == 202
        assert training.json()["status"] == "queued"
        assert (
            client.post(f"/api/games/{selected}/train", headers=headers).json() == training.json()
        )
        review = client.post(f"/api/games/{selected}/review", json={}, headers=headers)
        assert review.status_code == 200
        with sessions() as db:
            assert db.get(AnalysisJob, review.json()["job_id"]).priority == REQUESTED


def test_uploads_and_imports_fetch_then_queue_backfill_analysis(settings):
    with TestClient(create_app(settings, workers=False)) as client:
        response = client.post(
            "/api/imports",
            files={"file": ("test.pgn", '[White "Me"]\n\n1. e4 e5 *')},
            data={"side": "white", "analyze": "false"},
        )
        assert response.status_code == 200
        assert response.json()["job_id"] is None
        # The old analyze flag is ignored: imports fetch, then every game is analyzed.
        fetched = client.post(
            "/api/imports/chesscom", json={"username": "learner", "analyze": False}
        )
        analyzed = client.post(
            "/api/imports/chesscom", json={"username": "learner", "analyze": True}
        )
        assert fetched.json()["job_id"] == analyzed.json()["job_id"]
        jobs = client.get("/api/jobs").json()
        assert [job["kind"] for job in jobs] == ["chesscom_fetch"]
        # Uploads and manual imports are older-game backfill, behind polled games.
        assert client.get("/api/analysis/queue").json()["backfill"] == 1
