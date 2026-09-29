"""Sacrifice claims require current, legal, material-cost evidence for either side."""

from copy import deepcopy

import chess
import pytest
from trainer.chess_core import Score
from trainer.review_sacrifices import (
    has_sacrifice_support,
    is_sacrifice_offer,
    supported_sacrifice,
)

QUEEN_SACRIFICE = "q4r1k/6pp/4Q2N/8/8/8/8/2K5 w - - 0 1"
PAWN_WINNING_TRADE = "4b2k/3p4/8/1B6/8/8/8/K2Q4 w - - 0 1"
PROMOTION = "8/Pk6/8/8/8/8/8/1K6 w - - 0 1"


def offer(fen, move, capture, black=False):
    board = chess.Board(fen)
    moves = [chess.Move.from_uci(uci) for uci in (move, capture)]
    if black:
        board = board.mirror()
        moves = [
            chess.Move(
                chess.square_mirror(move.from_square),
                chess.square_mirror(move.to_square),
                promotion=move.promotion,
            )
            for move in moves
        ]
    assert board.is_valid()
    return board, *moves


def sacrifice_report(black=False):
    board, move, capture = offer(QUEEN_SACRIFICE, "e6g8", "f8g8", black)
    return {
        "actual": {"uci": move.uci(), "score": {"kind": "mate", "value": 2}},
        "actual_line": {"frames": [{"fen": board.fen()}], "findings": []},
        "sacrifice": {
            "capture": capture.uci(),
            "analysis_id": "saved-acceptance-analysis",
            "score": {"kind": "mate", "value": 1},
        },
    }


@pytest.mark.parametrize("black", [False, True])
def test_queen_offer_leading_to_mate_remains_supported_without_mutating_evidence(black):
    board, move, capture = offer(QUEEN_SACRIFICE, "e6g8", "f8g8", black)
    original_fen = board.fen()
    report = sacrifice_report(black)
    original_report = deepcopy(report)
    assert is_sacrifice_offer(board, move, capture)
    assert supported_sacrifice(report)
    assert board.fen() == original_fen and not board.move_stack
    assert report == original_report


@pytest.mark.parametrize("black", [False, True])
def test_piece_trade_winning_a_pawn_is_not_a_sacrifice(black):
    board, move, capture = offer(PAWN_WINNING_TRADE, "b5d7", "e8d7", black)
    assert not is_sacrifice_offer(board, move, capture)
    report = sacrifice_report(black)
    report["actual"]["uci"] = move.uci()
    report["actual_line"]["frames"][0]["fen"] = board.fen()
    report["sacrifice"]["capture"] = capture.uci()
    # Even saved mate scores cannot turn a material-restoring trade into a sacrifice.
    assert not supported_sacrifice(report)


@pytest.mark.parametrize("black", [False, True])
def test_newly_promoted_piece_is_still_a_pawn_offer(black):
    board, move, capture = offer(PROMOTION, "a7a8q", "b7a8", black)
    assert not is_sacrifice_offer(board, move, capture)
    report = sacrifice_report(black)
    report["actual"]["uci"] = move.uci()
    report["actual_line"]["frames"][0]["fen"] = board.fen()
    report["sacrifice"]["capture"] = capture.uci()
    assert not supported_sacrifice(report)


def test_legal_recapture_is_only_an_abstention_rule_not_a_search_for_sound_recaptures():
    # Qxd7 is legal and restores material, even though ...Rxd7 then takes the queen.
    board, move, capture = offer("3rb2k/3p4/8/1B6/8/8/8/K2Q4 w - - 0 1", "b5d7", "e8d7")
    assert not is_sacrifice_offer(board, move, capture)


@pytest.mark.parametrize("black", [False, True])
def test_a_pinned_illegal_recapture_does_not_restore_material(black):
    board, move, capture = offer("4b2k/3p4/8/1B6/8/8/8/K2Q3r w - - 0 1", "b5d7", "e8d7", black)
    assert is_sacrifice_offer(board, move, capture)


@pytest.mark.parametrize("black", [False, True])
def test_exchange_sacrifice_can_allow_a_recapture_that_still_loses_material(black):
    board, move, capture = offer("7k/8/4b3/8/2P5/8/8/K2R4 w - - 0 1", "d1d5", "e6d5", black)
    assert is_sacrifice_offer(board, move, capture)


@pytest.mark.parametrize(
    "fen,move,capture",
    [
        ("4b2k/3r4/8/1B6/8/8/8/K7 w - - 0 1", "b5d7", "e8d7"),
        ("7k/8/3b4/8/4P3/8/8/K7 w - - 0 1", "e4e5", "d6e5"),
        (QUEEN_SACRIFICE, "e6g8", "f8f7"),
        (QUEEN_SACRIFICE, "e6g8", "h8h7"),
        (QUEEN_SACRIFICE, "e6e5", "f8g8"),
        (QUEEN_SACRIFICE, "e6h8", "f8g8"),
        (QUEEN_SACRIFICE, "0000", "f8g8"),
        (QUEEN_SACRIFICE, "e6g8", "0000"),
    ],
)
def test_no_net_cost_pawns_non_captures_and_illegal_moves_abstain(fen, move, capture):
    assert not is_sacrifice_offer(*offer(fen, move, capture))


@pytest.mark.parametrize("black", [False, True])
def test_current_mover_tactic_can_support_a_saved_sound_non_mating_offer(black):
    report = sacrifice_report(black)
    report["actual"]["score"] = {"kind": "cp", "value": 20}
    report["sacrifice"]["score"] = {"kind": "cp", "value": -50}
    report["actual_line"]["findings"] = [{"actor": "black" if black else "white", "plies": [1, 3]}]
    assert supported_sacrifice(report)


@pytest.mark.parametrize(
    "findings",
    [
        [],
        [{"actor": "white", "plies": [3]}],
        [{"actor": "black", "plies": [1, 2]}],
        [{"actor": "white", "plies": [True]}],
        [{"actor": "white", "plies": "1"}],
        [{"actor": "white"}],
        [None],
        None,
    ],
)
def test_later_opponent_or_malformed_tactics_do_not_support_current_offer(findings):
    report = sacrifice_report()
    report["actual"]["score"] = {"kind": "cp", "value": 20}
    report["actual_line"]["findings"] = findings
    assert not supported_sacrifice(report)


@pytest.mark.parametrize("value,mate_given", [(-2, False), (0, False)])
def test_losing_mate_does_not_supply_tactical_support(value, mate_given):
    board = chess.Board(QUEEN_SACRIFICE)
    score = Score(kind="mate", value=value, mate_given=mate_given)
    assert not has_sacrifice_support(board, score, {"findings": []})


@pytest.mark.parametrize(
    "path,value",
    [
        (("sacrifice",), None),
        (("sacrifice", "capture"), None),
        (("sacrifice", "capture"), "f8f7"),
        (("sacrifice", "capture"), "bogus"),
        (("sacrifice", "analysis_id"), ""),
        (("sacrifice", "analysis_id"), " "),
        (("sacrifice", "analysis_id"), 1),
        (("sacrifice", "score"), None),
        (("sacrifice", "score"), {"kind": "cp", "value": -51}),
        (("sacrifice", "score"), {"kind": "mate", "value": -1}),
        (("sacrifice", "score"), {"kind": "cp", "value": "0"}),
        (("actual",), {}),
        (("actual", "uci"), "e6h8"),
        (("actual", "uci"), "bogus"),
        (("actual", "score"), {"kind": "cp", "value": -51}),
        (("actual_line",), None),
        (("actual_line", "frames"), []),
        (("actual_line", "frames"), [None]),
        (("actual_line", "frames"), [{}]),
        (("actual_line", "frames"), [{"fen": "invalid"}]),
        (("actual_line", "frames"), [{"fen": "8/8/8/8/8/8/8/8 w - - 0 1"}]),
    ],
)
def test_missing_malformed_or_unsound_stored_proof_abstains_without_mutation(path, value):
    report = sacrifice_report()
    parent = report
    for key in path[:-1]:
        parent = parent[key]
    parent[path[-1]] = value
    snapshot = deepcopy(report)
    assert not supported_sacrifice(report)
    assert report == snapshot


def test_absent_report_and_missing_top_level_evidence_abstain():
    assert not supported_sacrifice(None)
    for key in ("actual", "actual_line", "sacrifice"):
        report = sacrifice_report()
        del report[key]
        assert not supported_sacrifice(report)
