"""Whole-game review must explain both colors without changing training data."""

import chess
import chess.pgn
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.chess_core import Score
from trainer.game_review import analyze_move, classify
from trainer.imports import import_games
from trainer.models import AnalysisJob, Decision, Exercise, Game, GameReviewMove, Review


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
        assert client.get(f"/api/games/{game}/review").json() == {
            "job": None,
            "moves": [],
            "accuracy": None,
        }
        assert detail["accuracy"] is None
        assert client.get(f"/api/games/{game}/review?after=-1").status_code == 422
        assert client.get("/api/games/missing/review").status_code == 404
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
        assert client.post(f"/api/games/{game}/review", json={}).json() == first
        assert client.get(f"/api/games/{game}").json()["rating"] == 1500


@pytest.mark.stockfish
@pytest.mark.parametrize("workers", [1, 3])
def test_full_game_native_analysis_resume_restart_and_training_isolation(
    settings, stockfish_path, monkeypatch, workers
):
    settings.stockfish_path = stockfish_path
    settings.stockfish_workers = workers
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        from trainer.routes import games as routes

        ratings = []
        original = routes.public_report

        def record_rating(report, rating):
            ratings.append(rating)
            return original(report, rating)

        monkeypatch.setattr(routes, "public_report", record_rating)
        game = seed(
            app,
            '[White "Learner"]\n[Black "Opponent"]\n[WhiteElo "700"]\n[BlackElo "1800"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
        )
        job = client.post(f"/api/games/{game}/review", json={"rating": 800}).json()["job_id"]
        app.state.runner.run_job(job)
        detail = client.get(f"/api/games/{game}").json()
        assert detail["job"]["status"] == "completed", detail["job"]
        assert detail["job"]["completed"] == 4
        assert detail["accuracy"] is not None
        assert 0 <= detail["accuracy"]["white"] < detail["accuracy"]["black"] <= 100
        assert ratings == [700, 1800, 700, 1800]
        assert (detail["white_rating"], detail["black_rating"]) == (700, 1800)
        assert all(f["report"] for f in detail["frames"][1:])
        # Fool's Mate is a named line, even though g4 allows mate.
        assert detail["frames"][3]["report"]["label"] == "Book"
        assert detail["frames"][3]["report"]["engine_label"] == "Blunder"
        assert detail["frames"][4]["report"]["white_score"]["kind"] == "mate"
        assert Score.model_validate(detail["frames"][4]["report"]["white_score"]).outcome() == -1
        branch = client.post(
            f"/api/games/{game}/analyze", json={"ply": 2, "moves": ["g2g4"]}
        ).json()
        assert branch["report"]["label"] == "Book"
        assert branch["report"]["engine_label"] == "Blunder"
        assert branch["report"]["opening"] == detail["frames"][3]["report"]["opening"]
        assert ratings[-1] == 700
        assert (
            client.post(
                f"/api/games/{game}/analyze", json={"ply": 1, "moves": ["c7c5"]}
            ).status_code
            == 200
        )
        assert ratings[-1] == 1800
        updates = client.get(f"/api/games/{game}/review?after=2").json()
        assert updates["job"] == detail["job"]
        assert updates["accuracy"] == detail["accuracy"]
        assert client.get("/api/games").json()["items"][0]["accuracy"] == detail["accuracy"]
        assert [move["ply"] for move in updates["moves"]] == [3, 4]
        assert ratings[-2:] == [700, 1800]
        for move in updates["moves"]:
            assert "actual_line" not in move["report"]
            for key, value in move["report"].items():
                assert value == detail["frames"][move["ply"]]["report"][key]
        final = client.get(f"/api/games/{game}/review?after=4").json()
        assert final["moves"] == []
        assert final["accuracy"] == detail["accuracy"]
        client.post(f"/api/games/{game}/review", json={"rating": 2500})
        assert client.get(f"/api/games/{game}").json()["accuracy"] == detail["accuracy"]
        with app.state.sessions() as db:
            for model in (Decision, Exercise, Review):
                assert db.scalar(select(func.count()).select_from(model)) == 0
            assert db.scalar(select(func.count()).select_from(GameReviewMove)) == 4
        app.state.runner.run_job(job)  # Completed reports are reused, not duplicated.
        assert client.get(f"/api/games/{game}").json()["job"]["completed"] == 4
    settings.stockfish_path = "missing-after-restart"
    with TestClient(create_app(settings, workers=False)) as client:
        assert client.get(f"/api/games/{game}").json()["frames"][3]["report"]["label"] == "Book"
        assert client.get(f"/api/games/{game}").json()["accuracy"] == detail["accuracy"]


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


@pytest.mark.stockfish
def test_brilliant_sacrifice_can_create_a_forced_mate(settings, sessions, stockfish_path):
    from trainer.engine import Stockfish

    settings.stockfish_path = stockfish_path
    engine = Stockfish(settings, sessions)
    try:
        # Qg8+ Rxg8 Nf7#: a sound queen sacrifice, not an ordinary queen trade.
        board = chess.Board("q4r1k/6pp/4Q2N/8/8/8/8/2K5 w - - 0 1")
        assert board.is_valid()
        report = analyze_move(engine, board, chess.Move.from_uci("e6g8"))
        assert report["actual"]["score"]["kind"] == "mate"
        assert report["sacrifice"] is not None, report["second_score"]
        assert classify(report, 1000)[0] == "Brilliant"
    finally:
        engine.close()


@pytest.mark.parametrize(
    "fen,moves,piece,square",
    [
        ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", ["e1g1"], "K", "g1"),
        ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", ["e5d6"], "P", "d6"),
        ("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", ["a7a8n"], "N", "a8"),
        ("4k3/8/8/8/8/8/p7/4K3 b - - 0 12", ["a2a1q"], "q", "a1"),
    ],
)
def test_variations_preserve_special_moves_and_setup_positions(settings, fen, moves, piece, square):
    from trainer.game_review import branch_board

    board = chess.Board(fen)
    pgn = chess.pgn.Game.from_board(board)
    pgn.add_variation(next(iter(board.legal_moves)))
    game = Game(pgn=str(pgn))
    result = branch_board(game, 0, moves)
    assert result.piece_at(chess.parse_square(square)).symbol() == piece
    assert result.root().fen() == board.fen()
    assert len(result.move_stack) == 1


@pytest.mark.stockfish
@pytest.mark.parametrize("workers", [1, 3])
def test_cancelled_review_resumes_completed_plies(settings, stockfish_path, monkeypatch, workers):
    settings.stockfish_path = stockfish_path
    settings.stockfish_workers = workers
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        game = seed(app)
        job = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
        original = app.state.runner.cancelled

        def pause_after_one(job_id):
            with app.state.sessions() as db:
                count = db.scalar(select(func.count()).select_from(GameReviewMove))
            if count:
                client.post(f"/api/jobs/{job_id}/cancel")
            return original(job_id)

        monkeypatch.setattr(app.state.runner, "cancelled", pause_after_one)
        app.state.runner.run_job(job)
        detail = client.get(f"/api/games/{game}").json()
        assert detail["job"]["status"] == "cancelled"
        assert detail["accuracy"] is None
        assert 1 <= detail["job"]["completed"] <= workers
        first_report = detail["frames"][1]["report"]
        monkeypatch.setattr(app.state.runner, "cancelled", original)
        client.post(f"/api/games/{game}/review", json={})
        app.state.runner.run_job(job)
        detail = client.get(f"/api/games/{game}").json()
        assert detail["job"]["status"] == "completed"
        assert detail["job"]["completed"] == 4
        assert detail["frames"][1]["report"] == first_report


def test_parallel_review_preserves_order_history_and_engine_budget(settings, monkeypatch):
    import threading

    settings.stockfish_workers = 4
    settings.engine_slots = 2
    app = create_app(settings, workers=False, start_engine=False)
    engines, finished, histories = [], [], {}
    lock, pair, second_done = threading.Lock(), threading.Barrier(2), threading.Event()
    active = peak = 0

    class Engine:
        def __init__(self, *_):
            self.closed = False
            engines.append(self)

        def close(self):
            self.closed = True

    def analyze(engine, board, move):
        nonlocal active, peak
        ply = len(board.move_stack) + 1
        with lock:
            active += 1
            peak = max(peak, active)
            histories[ply] = [m.uci() for m in board.move_stack]
        try:
            if ply <= 2:
                pair.wait(5)
            if ply == 1:
                assert second_done.wait(5)
            with lock:
                finished.append(ply)
            if ply == 2:
                second_done.set()
            return {"best": {"score": {"kind": "cp", "value": ply * 100}}}
        finally:
            with lock:
                active -= 1

    monkeypatch.setattr("trainer.game_review.analyze_move", analyze)
    app.state.runner.engine_factory = Engine
    with TestClient(app) as client:
        game = seed(app)
        job_id = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            assert job.status == "completed", job.error
            assert job.positions_triaged == 4
            rows = db.scalars(select(GameReviewMove).order_by(GameReviewMove.ply)).all()
            assert [row.ply for row in rows] == [1, 2, 3, 4]
            assert rows[0].report["previous_score"] is None
            for row in rows[1:]:
                assert row.report["previous_score"] == {
                    "kind": "cp",
                    "value": -(row.ply - 1) * 100,
                    "mate_given": False,
                }
        assert finished[:2] == [2, 1]
        assert peak == 2 and len(engines) == 2
        assert histories[4] == ["f2f3", "e7e5", "g2g4"]
        assert all(engine.closed for engine in engines)


def test_parallel_review_failure_keeps_committed_work_and_closes_engines(settings, monkeypatch):
    from trainer.engine import EngineUnavailable

    settings.stockfish_workers = 2
    app = create_app(settings, workers=False, start_engine=False)
    engines, calls = [], []
    failing = True

    class Engine:
        def __init__(self, *_):
            self.closed = False
            engines.append(self)

        def close(self):
            self.closed = True

    def analyze(engine, board, move):
        ply = len(board.move_stack) + 1
        calls.append(ply)
        if failing and ply == 2:
            raise EngineUnavailable("Fixture search failed")
        return {"best": {"score": {"kind": "cp", "value": ply * 100}}}

    monkeypatch.setattr("trainer.game_review.analyze_move", analyze)
    app.state.runner.engine_factory = Engine
    with TestClient(app) as client:
        game = seed(app)
        job_id = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            assert (job.status, job.error) == ("failed", "Fixture search failed")
            assert db.scalar(select(func.count()).select_from(GameReviewMove)) == 1
            first = db.get(GameReviewMove, (game, 1)).report
        assert all(engine.closed for engine in engines)
        failing = False
        client.post(f"/api/games/{game}/review", json={})
        app.state.runner.run_job(job_id)
        with app.state.sessions() as db:
            assert db.get(AnalysisJob, job_id).status == "completed"
            assert db.scalar(select(func.count()).select_from(GameReviewMove)) == 4
            assert db.get(GameReviewMove, (game, 1)).report == first
        assert calls.count(1) == 1
        assert all(engine.closed for engine in engines)


def test_review_migration_matches_models(sessions):
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from trainer.models import Base

    with sessions.kw["bind"].connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []


@pytest.mark.parametrize(
    "value,expected",
    [
        ("700", 700),
        ("1800", 1800),
        ("?", None),
        ("", None),
        ("0", None),
        ("-20", None),
        ("50000", None),
    ],
)
def test_pgn_rating_missing_or_invalid_does_not_borrow_opponent(value, expected):
    from trainer.routes.games import pgn_rating

    parsed = chess.pgn.Game()
    parsed.headers["WhiteElo"] = value
    parsed.headers["BlackElo"] = "2100"
    assert pgn_rating(parsed, chess.WHITE) == expected
    assert pgn_rating(parsed, chess.BLACK) == 2100
