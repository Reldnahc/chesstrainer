"""New searches and saved review projections reject spurious Brilliant claims."""

from copy import deepcopy
from types import SimpleNamespace

import chess
import pytest
from review_intelligence_fixtures import move_report
from test_review_sacrifices import PAWN_WINNING_TRADE, PROMOTION, QUEEN_SACRIFICE, offer
from trainer.chess_core import Candidate
from trainer.game_review import analyze_move, line_evidence, public_report


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize(
    "fen,uci,capture,valid",
    [
        (PAWN_WINNING_TRADE, "b5d7", "e8d7", False),
        (PROMOTION, "a7a8q", "b7a8", False),
        (QUEEN_SACRIFICE, "e6g8", "f8g8", True),
    ],
)
def test_saved_acceptance_is_rechecked_before_grading_difficulty_and_dialogue(
    black, fen, uci, capture, valid
):
    board, move, response = offer(fen, uci, capture, black)
    report = move_report(
        board,
        move.uci(),
        before={"kind": "mate", "value": 2},
        after={"kind": "mate", "value": 2},
        second={"kind": "mate", "value": 3},
        pv=[move.uci(), response.uci()],
    )
    report["sacrifice"] = {
        "capture": response.uci(),
        "analysis_id": "saved-acceptance",
        "score": {"kind": "mate", "value": 1},
    }
    # Synthetic saved scores deliberately remain sound, isolating whether the
    # legal material exchange justifies the old sacrifice claim at all.
    snapshot = deepcopy(report)
    described = public_report(report, 1000)
    assert described["engine_label"] == ("Brilliant" if valid else "Best")
    assert bool(described["sacrifice"]) == valid
    assert described["practical"]["components"]["verified_sacrifice"] == valid
    assert (
        any(event["kind"] == "sacrifice" for event in described["intelligence"]["events"]) == valid
    )
    assert report == snapshot  # No rewrite of saved searches or private review data.
    assert described == public_report(report, 1000)


@pytest.mark.stockfish
@pytest.mark.parametrize("black", [False, True])
def test_native_promotion_capture_is_not_a_brilliant_piece_sacrifice(
    settings, sessions, stockfish_path, black
):
    from trainer.engine import Stockfish

    settings.stockfish_path = stockfish_path
    board, move, _ = offer(PROMOTION, "a7a8q", "b7a8", black)
    engine = Stockfish(settings, sessions)
    try:
        report = analyze_move(engine, board, move)
        assert report["sacrifice"] is None
        assert public_report(report, 1000)["engine_label"] != "Brilliant"
    finally:
        engine.close()


def test_saved_downstream_tactic_does_not_turn_current_offer_into_brilliant():
    board = chess.Board("8/7k/8/8/4q3/5N2/8/K7 w - - 0 1")
    report = move_report(board, "f3g5", pv=["f3g5", "h7g8", "g5e4"])
    report["actual_line"] = line_evidence(
        board, Candidate.model_validate(report["actual"]), "played-evidence", 1
    )
    assert report["actual_line"]["findings"]
    for finding in report["actual_line"]["findings"]:
        finding["plies"] = [3]
    report["sacrifice"] = {
        "capture": "e4g5",
        "analysis_id": "saved-acceptance",
        "score": {"kind": "cp", "value": 0},
    }
    assert public_report(report, 1000)["engine_label"] != "Brilliant"


@pytest.mark.parametrize("black", [False, True])
def test_forced_king_move_never_claims_brilliant_or_runs_acceptance_search(black):
    board, move, capture = offer("r7/8/2b5/8/8/2k5/8/K6R w - - 0 1", "a1b1", "c6h1", black)
    assert list(board.legal_moves) == [move]
    report = move_report(
        board,
        move.uci(),
        before={"kind": "mate", "value": 2},
        after={"kind": "mate", "value": 2},
        pv=[move.uci(), capture.uci()],
    )
    report["second_score"] = None
    report["sacrifice"] = {
        "capture": capture.uci(),
        "analysis_id": "old-acceptance",
        "score": {"kind": "mate", "value": 1},
    }
    described = public_report(report, 1000)
    assert described["engine_label"] == "Best"
    assert not described["sacrifice"]
    assert not described["practical"]["components"]["verified_sacrifice"]
    assert not any(event["kind"] == "sacrifice" for event in described["intelligence"]["events"])

    class Engine:
        calls = 0

        def analyze(self, position, *, deep, multipv):
            self.calls += 1
            assert position.fen() == board.fen() and deep and multipv == 2
            return SimpleNamespace(
                id="forced-root",
                engine_version="Synthetic authority",
                candidates=[report["actual"]],
            )

    engine = Engine()
    fresh = analyze_move(engine, board, move)
    assert engine.calls == 1 and fresh["sacrifice"] is None
    assert public_report(fresh, 1000)["engine_label"] == "Best"
