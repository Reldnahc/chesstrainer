"""Whole-game review must explain both colors without changing training data."""

import chess
import chess.pgn
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.chess_core import Score
from trainer.game_review import (
    analyze_move,
    classify,
    link_previous_scores,
    promote_stronger_played,
)
from trainer.imports import import_games
from trainer.models import AnalysisJob, Decision, Game, GameReviewMove, Review


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
        (20, 15, "Good"),
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
    only["actual"]["uci"] = only["best"]["uci"]
    assert classify(only, 1000)[0] == "Great"
    assert classify(only | {"legal_count": 1}, 1000)[0] == "Best"
    losing = quality(-400, -400, second_score={"kind": "cp", "value": -800})
    losing["actual"]["uci"] = losing["best"]["uci"]
    assert classify(losing, 1000)[0] == "Best"
    for prior, current in [(0, 250), (-250, 0)]:
        previous = {"previous_score": {"kind": "cp", "value": prior}}
        assert classify(quality(current, current, **previous, previous_mistake=True), 1000)[0] == (
            "Great"
        )
        # The same scores without an opponent error are a different search, not a gift.
        assert classify(quality(current, current, **previous, previous_mistake=False), 1000)[0] == (
            "Best"
        )


def test_great_needs_a_runner_up_that_actually_loses():
    still_winning = quality(500, 500, second_score={"kind": "cp", "value": 300})
    still_winning["actual"]["uci"] = still_winning["best"]["uci"]
    assert classify(still_winning, 1500)[0] == "Best"
    mated = quality(500, 500, second_score={"kind": "mate", "value": -3})
    mated["actual"]["uci"] = mated["best"]["uci"]
    assert classify(mated, 1500)[0] == "Great"
    # A runner-up that only misses a mate while still winning is not losing.
    mate = quality(0, 0, second_score={"kind": "cp", "value": 600})
    mate["best"]["score"] = mate["actual"]["score"] = {"kind": "mate", "value": 3}
    mate["actual"]["uci"] = mate["best"]["uci"]
    assert classify(mate, 1500)[0] == "Best"


def test_a_mate_seen_on_one_side_only_is_a_mate_transition():
    # Scores alone cannot tell a horizon difference from a real miss; the review
    # settles that with a deeper search before grading (see the native test).
    missed = quality(0, 499)
    missed["best"]["score"] = {"kind": "mate", "value": 5}
    assert classify(missed, 1500)[0] == "Miss"
    allowed = quality(-442, 0)
    allowed["actual"]["score"] = {"kind": "mate", "value": -4}
    assert classify(allowed, 1500)[0] == "Blunder"


@pytest.mark.stockfish
def test_a_long_mate_beyond_the_played_moves_search_is_settled_deeper(
    settings, sessions, stockfish_path
):
    from trainer.engine import Stockfish

    settings.stockfish_path = stockfish_path
    # The review's own default limits, where these horizon differences arise.
    settings.deep_depth, settings.deep_time = 16, 0.8
    engine = Stockfish(settings, sessions)
    try:
        # Kh6 keeps a queen-against-king mate its first search reads as about +6.
        kept = analyze_move(
            engine, chess.Board("8/8/8/7K/8/7Q/5k2/8 w - - 0 1"), chess.Move.from_uci("h5h6")
        )
        assert kept["actual"]["score"]["kind"] == "mate"
        assert classify(kept, 1500)[0] == "Good"
        # Every defence of the bare king is mated; the root search reads Kd3 as
        # about -5.8 and Kf3 as mated in four. Deeper, Kf3 only hastens the mate.
        lost = analyze_move(
            engine, chess.Board("4Q3/8/8/8/8/7K/4k3/8 b - - 0 1"), chess.Move.from_uci("e2f3")
        )
        assert lost["best"]["score"]["kind"] == "mate"
        assert classify(lost, 1500)[0] in {"Inaccuracy", "Best"}
        # Qxc8+ really gives up Bh6+'s mate in five for about +5.
        board = chess.Board("r1r2k2/2Q1R2p/5bp1/8/3p2P1/2P2Pn1/1P6/1NB2RK1 w - - 1 25")
        missed = analyze_move(engine, board, chess.Move.from_uci("c7c8"))
        if missed["best"]["score"]["kind"] == "mate":
            assert missed["actual"]["score"]["kind"] == "cp"
            assert classify(missed, 1500)[0] == "Miss"
    finally:
        engine.close()


def test_previous_scores_carry_whether_the_opponent_erred():
    first = quality(30, -150)
    second = quality(0, 0)
    linked = link_previous_scores({1: first, 2: second})
    assert linked[2]["previous_score"] == {"kind": "cp", "value": -30, "mate_given": False}
    assert linked[2]["previous_mistake"] is True
    assert link_previous_scores({1: quality(30, 0), 2: second})[2]["previous_mistake"] is False


def test_a_forced_move_can_never_be_brilliant_even_with_saved_sacrifice_evidence():
    report = quality(legal_count=1, sacrifice={"verified": True})
    report["actual"] = dict(report["best"])
    assert classify(report, 1000)[0] == "Best"


def test_mate_is_not_centipawn_loss():
    report = quality()
    report["actual"]["score"] = {"kind": "mate", "value": -2}
    assert classify(report, 400)[0] == "Blunder"
    report["best"]["score"] = {"kind": "mate", "value": -3}
    # Already lost: being mated sooner is the only thing left to give away.
    assert classify(report, 400)[0] == "Inaccuracy"
    report["actual"]["score"] = {"kind": "mate", "value": -3}
    assert classify(report, 400)[0] == "Best"  # The same defence length: nothing better.
    report["best"]["score"] = {"kind": "mate", "value": 2}
    report["actual"]["score"] = {"kind": "cp", "value": 0}
    assert classify(report, 400)[0] == "Miss"


@pytest.mark.parametrize("loss", [1, 5, 10])
@pytest.mark.parametrize("rating", [400, 2500])
def test_best_requires_the_top_move_not_a_nearby_evaluation(loss, rating):
    report = quality(20, 20 - loss)
    assert classify(report, rating)[0] == "Good"
    report["actual"] = dict(report["best"])
    assert classify(report, rating)[0] == "Best"


@pytest.mark.parametrize("best_mate,played_mate", [(1, 2), (1, 5), (2, 5)])
def test_retaining_a_slower_mate_is_good_not_missed_or_exceptional(best_mate, played_mate):
    report = quality(
        previous_score={"kind": "cp", "value": 0},
        sacrifice={"verified": True},
    )
    report["best"]["score"] = {"kind": "mate", "value": best_mate}
    report["actual"]["score"] = {"kind": "mate", "value": played_mate}
    assert classify(report, 1000)[0] == "Good"
    report["actual"]["score"] = {"kind": "cp", "value": 500}
    assert classify(report, 1000)[0] == "Miss"


@pytest.mark.parametrize("distance", [1, 2, 5])
def test_a_different_move_that_mates_as_fast_is_best(distance):
    report = quality(second_score={"kind": "mate", "value": distance})
    report["best"]["score"] = {"kind": "mate", "value": distance}
    report["actual"]["score"] = {"kind": "mate", "value": distance}
    assert classify(report, 1000)[0] == "Best"


def test_an_equally_scored_different_move_is_best():
    assert classify(quality(0, 0), 1000) == ("Best", "This is as strong as the engine's top move.")
    assert classify(quality(10, 0), 1000)[0] == "Good"
    # ...h5 and ...h6 are both mated in one: nothing better existed.
    mated = quality(0, 0)
    mated["best"]["score"] = mated["actual"]["score"] = {"kind": "mate", "value": -1}
    assert classify(mated, 1000) == ("Best", "This is as strong as the engine's top move.")


def seed(app, pgn='[White "Learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1'):
    with app.state.sessions() as db:
        import_games(db, "synthetic.pgn", pgn, ["Learner"], None)
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
            "revision": 0,
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
def test_full_game_native_analysis_resume_restart_and_training_decisions(
    settings, stockfish_path, monkeypatch, workers
):
    settings.stockfish_path = stockfish_path
    settings.stockfish_workers = workers
    app = create_app(settings, workers=False)
    with TestClient(app) as client:
        from trainer.review_intelligence import presentation
        from trainer.routes import games as routes

        ratings = []
        original = routes.public_report

        def record_rating(report, rating, **kwargs):
            ratings.append(rating)
            return original(report, rating, **kwargs)

        monkeypatch.setattr(routes, "public_report", record_rating)
        monkeypatch.setattr(presentation, "public_report", record_rating)
        game = seed(
            app,
            '[White "Learner"]\n[Black "Opponent"]\n[WhiteElo "700"]\n[BlackElo "1800"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
        )
        job = client.post(f"/api/games/{game}/review", json={"rating": 800}).json()["job_id"]
        app.state.runner.run_job(job)
        detail = client.get(f"/api/games/{game}").json()
        assert detail["job"]["status"] == "completed", detail["job"]
        assert detail["job"]["completed"] == 4
        assert detail["context"]["complete"] and detail["context"]["missing_plies"] == []
        assert detail["context"]["biggest_swing_ply"] == 3
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
        assert updates["context"] == detail["context"]
        assert updates["history"] == detail["history"]
        assert "narrative" not in detail
        assert "narrative" not in updates
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
        assert client.get(f"/api/games/{game}").json()["context"] == detail["context"]
        with app.state.sessions() as db:
            # The same job adds training decisions for the learner's moves; no recall yet.
            assert db.scalar(select(func.count()).select_from(Decision)) == 2
            assert db.scalar(select(func.count()).select_from(Review)) == 0
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
@pytest.mark.parametrize("mirror", [False, True])
@pytest.mark.parametrize(
    "fen,uci",
    [
        ("8/2p5/1p3PQ1/p6p/2P4k/8/PP3K2/8 w - - 0 37", "f6f7"),
        ("8/2p2P2/1p4Q1/p6p/2P5/7k/PP3K2/8 w - - 1 38", "f7f8q"),
        ("5Q2/2p5/1p4Q1/p6p/2P5/8/PP3K1k/8 w - - 1 39", "f8h8"),
    ],
)
def test_native_slower_mate_stays_good(settings, sessions, stockfish_path, mirror, fen, uci):
    from trainer.engine import Stockfish
    from trainer.game_review import public_report

    settings.stockfish_path = stockfish_path
    settings.deep_depth, settings.deep_time = 16, 0.8
    board, move = chess.Board(fen), chess.Move.from_uci(uci)
    if mirror:
        board = board.mirror()
        move = chess.Move(
            chess.square_mirror(move.from_square),
            chess.square_mirror(move.to_square),
            promotion=move.promotion,
        )
    assert board.is_valid() and move in board.legal_moves
    engine = Stockfish(settings, sessions)
    try:
        report = analyze_move(engine, board, move)
        assert Score.model_validate(report["best"]["score"]) == Score(kind="mate", value=1)
        assert Score.model_validate(report["actual"]["score"]) == Score(kind="mate", value=2)
        assert public_report(report, 650)["engine_label"] == "Good"
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


@pytest.mark.stockfish
def test_a_mating_sacrifice_is_brilliant_even_when_already_winning(
    settings, sessions, stockfish_path
):
    from trainer.engine import Stockfish

    settings.stockfish_path = stockfish_path
    engine = Stockfish(settings, sessions)
    try:
        # mannusingh6978 vs Reldnahcs: Qe1+ Rxe1 Rxe1#, while Bxf2+ was already
        # about +7.8. Only the queen sacrifice forces mate.
        board = chess.Board("r3r1k1/p3qppp/1p6/2b5/6R1/N7/PBP2PPP/R5K1 b - - 0 20")
        report = analyze_move(engine, board, chess.Move.from_uci("e7e1"))
        assert report["actual"]["score"] == {"kind": "mate", "value": 2, "mate_given": False}
        assert report["sacrifice"] is not None, report["root_candidates"]
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
    # These fakes only answer review searches; training has its own coverage.
    monkeypatch.setattr("trainer.job_execution.JobExecution.train", lambda *_args: None)
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
            # Previous scores are linked when reports are read, in game order.
            reports = link_previous_scores({row.ply: row.report for row in rows})
            assert "previous_score" not in rows[0].report
            assert reports[1].get("previous_score") is None
            for ply in (2, 3, 4):
                assert reports[ply]["previous_score"] == {
                    "kind": "cp",
                    "value": -(ply - 1) * 100,
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
    # These fakes only answer review searches; training has its own coverage.
    monkeypatch.setattr("trainer.job_execution.JobExecution.train", lambda *_args: None)
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


def test_a_missed_tactic_is_a_miss_only_at_mistake_size():
    assert classify(quality(155, 100, opportunity_missed=True), 1000)[0] == "Inaccuracy"
    assert classify(quality(200, 100, opportunity_missed=True), 1000)[0] == "Miss"


def test_a_played_move_searched_above_the_reported_best_is_promoted():
    report = quality(
        790,
        896,
        loss_cp=0,
        opportunity_missed=True,
        best_line={"line": "best"},
        actual_line={"line": "actual"},
    )
    promoted = promote_stronger_played(report)
    assert promoted["best"] == report["actual"]
    assert promoted["best_line"] == report["actual_line"]
    assert promoted["opportunity_missed"] is False
    assert classify(promoted, 1000)[0] == "Best"
    # A tie keeps the reported best: Best still requires the top move.
    assert promote_stronger_played(quality(790, 790)) == quality(790, 790)


def test_export_returns_saved_pgn_and_every_mainline_position(settings):
    app = create_app(settings, workers=False, start_engine=False)
    with TestClient(app) as client:
        game = seed(app)
        data = client.get(f"/api/games/{game}/export").json()
        detail = client.get(f"/api/games/{game}").json()
    assert data["pgn"].endswith("\n") and "[White" in data["pgn"]
    assert [p["fen"] for p in data["positions"]] == [f["fen"] for f in detail["frames"]]
    assert data["positions"][0]["uci"] is None
    assert [p["uci"] for p in data["positions"][1:]] == [f["uci"] for f in detail["frames"][1:]]
    assert data["orientation"] == detail["orientation"]


def test_a_blunder_reason_says_whether_the_mover_stays_winning_or_was_lost():
    # Centipawn grading is unchanged; only the reason is truthful about the result.
    assert classify(quality(1500, 1200), 1500) == (
        "Blunder",
        "This move gives up a large amount of a winning advantage, though the position "
        "remains clearly winning.",
    )
    assert classify(quality(-372, -604), 1500) == (
        "Blunder",
        "This move makes an already lost position much worse.",
    )
    assert classify(quality(0, -250), 1500)[1] == (
        "This move gives away a decisive advantage or allows a severe loss."
    )


def test_a_promotion_caption_reads_as_one_sentence():
    from trainer.explanation_types import replay_line

    frames = replay_line(chess.Board("8/P6k/8/8/8/8/8/K7 w - - 0 1"), ["a7a8q"])
    assert frames[1].annotation.startswith("White plays a8=Q, promoting to a queen")


def test_the_coach_leads_with_a_finding_that_starts_with_the_move():
    from types import SimpleNamespace

    from trainer.game_review import lead_order

    def finding(skill_id, plies):
        return SimpleNamespace(skill_id=skill_id, plies=plies)

    capture, late_pin, fork = (
        finding("hanging_piece", [1]),
        finding("pin", [3]),
        finding("fork", [2]),
    )
    # A pin three plies on comes after the capture the move itself makes.
    assert lead_order([late_pin, capture], 1) == [capture, late_pin]
    # A preferred mechanism starting with the reply still leads.
    assert lead_order([capture, late_pin, fork], 1) == [fork, capture, late_pin]
