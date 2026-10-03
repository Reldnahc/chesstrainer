"""Every game queues one analysis job; requested, fresh and backfill levels order them."""

import time
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from trainer import presence
from trainer.api import create_app
from trainer.chesscom import ChessComClient
from trainer.game_analysis import BACKFILL, FRESH, REQUESTED, queue_games, queue_imported
from trainer.game_providers.lichess import LichessClient
from trainer.game_sync import poll
from trainer.imports import import_games
from trainer.models import (
    AnalysisJob,
    ChessComImport,
    Decision,
    EngineAnalysis,
    Game,
    GameReview,
    GameReviewMove,
    ImportGame,
    ProviderConnection,
    User,
)
from trainer.presence import active_cutoff

START = datetime(2026, 9, 1, tzinfo=timezone.utc)


def seed_games(app, count):
    pgn = "\n\n".join(
        f'[White "Learner"]\n[Black "Opponent"]\n[Round "{i}"]\n\n1. e4 e5 2. Nf3 Nc6 *'
        for i in range(count)
    )
    with app.state.sessions() as db:
        import_games(db, "games.pgn", pgn, ["Learner"], None, queue_analysis=False)
        ids = db.scalars(select(Game.id).order_by(Game.pgn)).all()
        for i, game_id in enumerate(ids):
            db.get(Game, game_id).played_at = START + timedelta(days=i)
        db.commit()
        return ids  # Oldest first.


def claim_order(app):
    order = []
    while job := app.state.runner.claim():
        with app.state.sessions() as db:
            order.append(db.scalar(select(GameReview.game_id).where(GameReview.job_id == job)))
            db.get(AnalysisJob, job).status = "completed"
            db.commit()
    return order


def test_polled_games_run_before_imported_backfill_newest_first(settings):
    app = create_app(settings, workers=False)
    with TestClient(app):
        games = seed_games(app, 4)
        with app.state.sessions() as db:
            # The poller found the two newest; the rest came from an older import.
            assert queue_games(db, games[2:], FRESH) == 2
            assert queue_imported(db, db.scalar(select(ImportGame.import_id)), BACKFILL) == 2
            db.commit()
            levels = {
                review.game_id: db.get(AnalysisJob, review.job_id).priority
                for review in db.scalars(select(GameReview))
            }
            # Queuing again creates nothing new.
            assert queue_imported(db, db.scalar(select(ImportGame.import_id)), BACKFILL) == 0
        assert levels == {games[3]: FRESH, games[2]: FRESH, games[1]: BACKFILL, games[0]: BACKFILL}
        assert claim_order(app) == list(reversed(games))


def test_opening_a_game_moves_its_queued_analysis_to_the_front(settings):
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        games = seed_games(app, 3)
        with app.state.sessions() as db:
            queue_games(db, games, BACKFILL)
            # A later, higher level raises a queued job but never lowers one.
            queue_games(db, [games[1]], FRESH)
            queue_games(db, [games[1]], BACKFILL)
            db.commit()
        client.post(f"/api/games/{games[0]}/review", json={})
        with app.state.sessions() as db:
            levels = {
                review.game_id: db.get(AnalysisJob, review.job_id).priority
                for review in db.scalars(select(GameReview))
            }
            assert db.scalar(select(func.count()).select_from(AnalysisJob)) == 3
        assert levels == {games[0]: REQUESTED, games[1]: FRESH, games[2]: BACKFILL}
        queue = client.get("/api/analysis/queue").json()
        assert (queue["requested"], queue["fresh"], queue["backfill"]) == (1, 1, 1)
        assert claim_order(app) == [games[0], games[1], games[2]]


class FakeClient:
    """Change detector double: records each call's usernames and states."""

    calls = []
    answers = {}

    def __init__(self, _settings):
        pass

    def changed(self, usernames, states):
        FakeClient.calls.append((sorted(usernames), states))
        return {name: FakeClient.answers.get(name, (False, {"etag": "same"})) for name in usernames}

    def close(self):
        pass


def connect(app, *pairs):
    with app.state.sessions() as db:
        for provider, name in pairs:
            db.add(ProviderConnection(provider=provider, username=name))
        db.commit()


def syncs(app):
    with app.state.sessions() as db:
        return {
            (source.provider, source.username): (job.status, source.max_games, source.months)
            for job, source in db.execute(
                select(AnalysisJob, ChessComImport).join(
                    ChessComImport, ChessComImport.job_id == AnalysisJob.id
                )
            )
        }


def test_poller_syncs_only_connections_whose_provider_reports_a_change(settings, monkeypatch):
    FakeClient.calls, FakeClient.answers = [], {}
    app = create_app(settings, workers=False)
    runner = app.state.runner
    monkeypatch.setitem(runner.provider_factories, "chesscom", FakeClient)
    monkeypatch.setitem(runner.provider_factories, "lichess", FakeClient)
    with TestClient(app):
        poll(runner, ["local"])
        assert FakeClient.calls == [] and syncs(app) == {}
        connect(app, ("chesscom", "learner"), ("lichess", "learner2"))
        # A new connection has no saved marker, so the providers report a change.
        FakeClient.answers = {
            "learner": (True, {"etag": "same"}),
            "learner2": (True, {"etag": "same"}),
        }
        poll(runner, ["local"])
        FakeClient.answers = {}
        assert syncs(app) == {
            ("chesscom", "learner"): ("queued", 10, 0),
            ("lichess", "learner2"): ("queued", 10, 0),
        }
        with app.state.sessions() as db:
            for job in db.scalars(select(AnalysisJob)):
                job.status = "completed"
            db.commit()
        # Unchanged providers queue nothing; the saved markers are sent back.
        poll(runner, ["local"])
        assert {status for status, *_ in syncs(app).values()} == {"completed"}
        assert FakeClient.calls[-1][1]["learner2"]["etag"] == "same"
        FakeClient.answers = {"learner2": (True, {"signature": 2})}
        poll(runner, ["local"])
        assert syncs(app)[("lichess", "learner2")][0] == "queued"
        assert syncs(app)[("chesscom", "learner")][0] == "completed"
        # A rate-limited provider is skipped until its cooldown ends.
        calls = len(FakeClient.calls)
        runner.provider_retry_at["chesscom"] = time.monotonic() + 60
        poll(runner, ["local"])
        assert len(FakeClient.calls) == calls + 1


def test_poller_skips_accounts_away_for_a_week_and_welcomes_them_back(settings):
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        assert client.get("/api/welcome-back").json() == {"away_since": None}
        with Session(app.state.workspaces.sql_engine) as db:
            assert db.get(User, "local").last_seen_at is not None
            db.execute(
                update(User)
                .where(User.id == "local")
                .values(last_seen_at=datetime.now(timezone.utc) - timedelta(days=8))
            )
            db.commit()
        runner = app.state.runner
        with runner.queue.sessions() as db:
            active = db.scalars(
                runner.queue.owners().where(User.last_seen_at >= active_cutoff(settings))
            ).all()
        assert active == []
        presence.forget()
        away = client.get("/api/welcome-back").json()["away_since"]
        assert away is not None
        with runner.queue.sessions() as db:
            assert db.scalars(
                runner.queue.owners().where(User.last_seen_at >= active_cutoff(settings))
            ).all() == ["local"]
        assert client.post("/api/welcome-back/dismiss").json() == {"away_since": None}


@pytest.mark.stockfish
def test_game_analysis_runs_review_and_training_in_one_job(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        with app.state.sessions() as db:
            import_games(
                db,
                "game.pgn",
                '[White "Learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
                ["Learner"],
                None,
                queue_analysis=False,
            )
            queue_imported(db, db.scalar(select(ImportGame.import_id)), FRESH)
            db.commit()
        job = app.state.runner.claim()
        app.state.runner.run_job(job)
        game = client.get("/api/games").json()["items"][0]["id"]
        assert client.get(f"/api/games/{game}").json()["job"]["status"] == "completed"
        with app.state.sessions() as db:
            decisions = db.scalars(select(Decision)).all()
            assert len(decisions) == 2
            # Training reuses the review's deep searches instead of triaging again.
            for decision in decisions:
                report = db.get(GameReviewMove, (decision.game_id, decision.ply)).report
                assert decision.before_analysis_id == report["before_analysis_id"]
                assert decision.deep
                played = db.get(EngineAnalysis, decision.played_analysis_id)
                assert played.candidates[0]["uci"] == decision.move_uci
            assert (
                db.scalar(
                    select(func.count())
                    .select_from(EngineAnalysis)
                    .where(EngineAnalysis.config["depth"].as_integer() < settings.deep_depth)
                )
                == 0
            )
        assert client.get("/api/analysis/queue").json()["completed"] == 1


def test_chesscom_change_check_uses_the_month_archive_etag(settings):
    seen = []

    def respond(request):
        seen.append(request.headers.get("If-None-Match"))
        if request.headers.get("If-None-Match") == 'W/"one"':
            return httpx.Response(304)
        return httpx.Response(200, json={"games": []}, headers={"ETag": 'W/"one"'})

    client = ChessComClient(settings, transport=httpx.MockTransport(respond))
    first = client.changed(["learner"], {})
    assert first["learner"][0] is True
    second = client.changed(["learner"], {"learner": first["learner"][1]})
    assert second["learner"] == (False, first["learner"][1])
    assert seen == [None, 'W/"one"']


def test_lichess_change_check_batches_every_player_in_one_request(settings):
    bodies = []

    def respond(request):
        bodies.append(request.content.decode())
        return httpx.Response(
            200,
            json=[
                {"id": "alice", "perfs": {"blitz": {"games": 5}}, "playTime": {"total": 900}},
                {"id": "bob", "perfs": {"blitz": {"games": 2}}, "playTime": {"total": 300}},
            ],
        )

    client = LichessClient(settings, transport=httpx.MockTransport(respond))
    first = client.changed(["alice", "bob"], {})
    assert bodies == ["alice,bob"]
    assert all(changed for changed, _ in first.values())
    states = {name: state for name, (_, state) in first.items()}
    assert not any(changed for changed, _ in client.changed(["alice", "bob"], states).values())
    states["bob"] = {"signature": {"games": {"blitz": 1}, "play_time": 100}}
    again = client.changed(["alice", "bob"], states)
    assert (again["alice"][0], again["bob"][0]) == (False, True)
    assert len(bodies) == 3
