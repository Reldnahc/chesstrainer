"""Whole-game review must explain both colors without changing training data."""

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.chess_core import Score
from trainer.game_review import analyze_move, classify
from trainer.imports import import_games
from trainer.models import Decision, Exercise, Game, GameReviewMove, Review


def quality(best=0, actual=0, **changes):
    report = {
        "best": {"score": {"kind": "cp", "value": best}, "uci": "e2e4"},
        "actual": {"score": {"kind": "cp", "value": actual}, "uci": "d2d4"},
        "opportunity_missed": False,
        "sacrifice": None,
        "legal_count": 20,
        "second_score": {"kind": "cp", "value": best - 20},
        "previous_score": None,
    }
    return report | changes


def test_labels_and_elo_only_change_blunder_severity():
    for best, actual, expected in [
        (20, 15, "Best"),
        (30, 0, "Good"),
        (70, 0, "Inaccuracy"),
        (120, 0, "Mistake"),
    ]:
        assert classify(quality(best, actual), 400)[0] == expected
        assert classify(quality(best, actual), 2500)[0] == expected
    assert classify(quality(0, -210), 400)[0] == "Blunder"  # Decisive, even a pawn.
    assert classify(quality(500, 280), 400)[0] == "Mistake"
    assert classify(quality(500, 280), 2500)[0] == "Blunder"
    assert classify(quality(150, 0, opportunity_missed=True), 1000)[0] == "Miss"
    assert classify(quality(sacrifice={"verified": True}), 1000)[0] == "Brilliant"


def test_great_only_good_and_both_opponent_error_transitions():
    only = quality(0, 0, second_score={"kind": "cp", "value": -200})
    assert classify(only, 1000)[0] == "Great"
    assert classify(only | {"legal_count": 1}, 1000)[0] == "Best"
    assert (
        classify(quality(-400, -400, second_score={"kind": "cp", "value": -800}), 1000)[0] == "Best"
    )
    for prior, current in [(0, 250), (-250, 0)]:
        assert (
            classify(
                quality(current, current, previous_score={"kind": "cp", "value": prior}), 1000
            )[0]
            == "Great"
        )


def test_mate_is_not_centipawn_loss():
    report = quality()
    report["actual"]["score"] = {"kind": "mate", "value": -2}
    assert classify(report, 400)[0] == "Blunder"
    report["best"]["score"] = {"kind": "mate", "value": -3}
    assert classify(report, 400)[0] == "Best"  # Already lost, no new allowed mate.
    report["best"]["score"] = {"kind": "mate", "value": 2}
    report["actual"]["score"] = {"kind": "cp", "value": 0}
    assert classify(report, 400)[0] == "Miss"


def seed(app, pgn='[White "Learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1'):
    with app.state.sessions() as db:
        import_games(db, "synthetic.pgn", pgn, ["Learner"], None, queue_analysis=False)
        return db.scalar(select(Game.id))


def test_library_variations_special_moves_and_missing_engine(settings):
    settings.stockfish_path = "missing-test-engine"
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        assert client.get("/api/games").json()["items"] == []
        assert client.get("/api/games/missing").status_code == 404
        game = seed(app)
        detail = client.get(f"/api/games/{game}").json()
        assert len(detail["frames"]) == 5
        assert detail["frames"][-1]["result"] == "0-1"
        assert detail["frames"][-1]["legal_moves"] == []
        branch = {"ply": 1, "moves": ["d7d5", "e2e4"]}
        response = client.post(f"/api/games/{game}/position", json=branch)
        assert response.status_code == 200
        assert response.json()["turn"] == "black"
        assert (
            client.post(
                f"/api/games/{game}/position", json={"ply": 1, "moves": ["e2e4"]}
            ).status_code
            == 422
        )
        assert client.post(f"/api/games/{game}/position", json={"ply": 99}).status_code == 422
        assert (
            client.post(
                f"/api/games/{game}/position", json={"ply": 4, "moves": ["a2a3"]}
            ).status_code
            == 422
        )
        assert client.post(f"/api/games/{game}/analyze", json=branch).status_code == 503
        first = client.post(f"/api/games/{game}/review", json={"rating": 800}).json()
        second = client.post(f"/api/games/{game}/review", json={"rating": 1500}).json()
        assert first == second
        assert client.get(f"/api/games/{game}").json()["rating"] == 1500


@pytest.mark.stockfish
def test_full_game_native_analysis_resume_restart_and_training_isolation(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        game = seed(app)
        job = client.post(f"/api/games/{game}/review", json={"rating": 800}).json()["job_id"]
        app.state.runner.run_job(job)
        detail = client.get(f"/api/games/{game}").json()
        assert detail["job"]["status"] == "completed", detail["job"]
        assert detail["job"]["completed"] == 4
        assert all(f["report"] for f in detail["frames"][1:])
        assert detail["frames"][3]["report"]["label"] == "Blunder"
        assert detail["frames"][4]["report"]["white_score"]["kind"] == "mate"
        assert Score.model_validate(detail["frames"][4]["report"]["white_score"]).outcome() == -1
        branch = client.post(
            f"/api/games/{game}/analyze", json={"ply": 2, "moves": ["g2g4"]}
        ).json()
        assert branch["report"]["label"] == "Blunder"
        with app.state.sessions() as db:
            for model in (Decision, Exercise, Review):
                assert db.scalar(select(func.count()).select_from(model)) == 0
            assert db.scalar(select(func.count()).select_from(GameReviewMove)) == 4
        app.state.runner.run_job(job)  # Completed reports are reused, not duplicated.
        assert client.get(f"/api/games/{game}").json()["job"]["completed"] == 4
    settings.stockfish_path = "missing-after-restart"
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get(f"/api/games/{game}").json()["frames"][3]["report"]["label"] == "Blunder"


@pytest.mark.stockfish
def test_native_positive_fork_coaching(settings, sessions, stockfish_path):
    from trainer.engine import Stockfish

    settings.stockfish_path = stockfish_path
    engine = Stockfish(settings, sessions)
    try:
        # Knight fork of king and queen; the report must attach the actual move's evidence.
        board = chess.Board("q3k3/8/8/3N4/8/8/7P/4K3 w - - 0 1")
        report = analyze_move(engine, board, chess.Move.from_uci("d5c7"))
        assert report["actual"]["uci"] == "d5c7"
        assert any(f["skill_id"] == "fork" for f in report["actual_line"]["findings"])
        for frame in report["actual_line"]["frames"]:
            assert chess.Board(frame["fen"]).is_valid()
    finally:
        engine.close()
