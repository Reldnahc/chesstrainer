"""Every game queues one analysis job; requested, fresh and backfill levels order them."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.game_analysis import BACKFILL, FRESH, REQUESTED, queue_games, queue_library
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
    ProviderConnection,
)

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


def test_newest_games_are_fresh_and_run_before_backfill_newest_first(settings, monkeypatch):
    monkeypatch.setattr("trainer.game_analysis.RECENT_GAMES", 2)
    app = create_app(settings, workers=False)
    with TestClient(app):
        games = seed_games(app, 4)
        with app.state.sessions() as db:
            assert queue_library(db) == 4
            db.commit()
            levels = {
                review.game_id: db.get(AnalysisJob, review.job_id).priority
                for review in db.scalars(select(GameReview))
            }
            # Queuing again creates nothing new.
            assert queue_library(db) == 0
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


def test_poller_queues_a_recent_games_sync_for_each_connection_when_due(settings):
    app = create_app(settings, workers=False)
    with TestClient(app):
        workspaces = app.state.runner.workspaces
        poll(workspaces, ["local"], 300)
        with app.state.sessions() as db:
            assert db.scalar(select(func.count()).select_from(AnalysisJob)) == 0
            db.add(ProviderConnection(provider="chesscom", username="learner"))
            db.add(ProviderConnection(provider="lichess", username=""))
            db.commit()
        poll(workspaces, ["local"], 300)
        poll(workspaces, ["local"], 300)
        with app.state.sessions() as db:
            job = db.scalar(select(AnalysisJob))
            source = db.get(ChessComImport, job.id)
            assert db.scalar(select(func.count()).select_from(AnalysisJob)) == 1
            assert (job.kind, source.months, source.max_games) == ("sync", 0, 100)
            job.status = "completed"
            job.created_at = datetime.now(timezone.utc) - timedelta(seconds=301)
            db.commit()
        poll(workspaces, ["local"], 300)
        with app.state.sessions() as db:
            assert db.scalar(select(AnalysisJob.status)) == "queued"


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
            queue_library(db)
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
