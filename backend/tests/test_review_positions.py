"""Geometry is factual; it must never acquire an invented strategic value judgment."""

from copy import deepcopy

import chess
import pytest
from review_intelligence_fixtures import move_report
from review_position_fixtures import position_reports
from test_review_clocks import game
from trainer.game_review import public_report
from trainer.review_intelligence.context import move_contexts
from trainer.review_intelligence.positional import pawn_features, position_changes


@pytest.mark.parametrize("feature", ["doubled_files", "bishop_pair"])
@pytest.mark.parametrize("black", [False, True])
def test_unplayed_positional_changes_keep_their_branch_and_affected_side(feature, black):
    fixture = position_reports(feature, black)
    alternative, actual = fixture["alternative"], fixture["actual"]
    unplayed = [
        e for e in alternative["intelligence"]["events"] if e["facts"].get("feature") == feature
    ]
    played = [e for e in actual["intelligence"]["events"] if e["facts"].get("feature") == feature]
    assert len(unplayed) == len(played) == 1
    assert unplayed[0]["facts"]["line"] == "best"
    assert played[0]["facts"]["line"] == "actual"
    for key in ("side", "before", "after", "uci"):
        assert unplayed[0]["facts"][key] == played[0]["facts"][key]
    assert unplayed[0]["facts"]["side"] == ("black" if black else "white")


def changes(fen, uci, feature):
    board, move = chess.Board(fen), chess.Move.from_uci(uci)
    assert board.is_valid() and move in board.legal_moves
    return [f for f in position_changes(board, move) if f["feature"] == feature]


def test_passed_pawn_requires_no_enemy_on_same_or_neighbor_file_ahead():
    facts = changes("7k/8/3p4/4P3/8/8/8/K7 w - - 0 1", "e5d6", "passed_pawns")
    assert next(f for f in facts if f["side"] == "white")["added"] == ["d6"]
    assert not changes("7k/8/3p4/8/4P3/8/8/K7 w - - 0 1", "e4e5", "passed_pawns")
    advance = changes("7k/8/8/4P3/8/8/8/K7 w - - 0 1", "e5e6", "passed_pawn_advance")
    assert advance[0]["after"] == "e6"
    assert not changes("7k/8/8/4P3/8/8/8/K7 w - - 0 1", "e5e6", "passed_pawns")


def test_pawn_structure_tracks_identities_not_merely_changed_square_names():
    board = chess.Board("7k/8/8/3p4/2P5/8/2PP4/K7 w - - 0 1")
    facts = position_changes(board, chess.Move.from_uci("c4d5"))
    doubled = next(f for f in facts if f["feature"] == "doubled_files" and f["side"] == "white")
    assert doubled["before"] == ["c"] and doubled["after"] == ["d"]
    assert not [f for f in facts if f["feature"] == "isolated_pawns" and f["side"] == "white"]
    isolated = changes("7k/8/8/3p4/2P5/8/1P6/K7 w - - 0 1", "c4d5", "isolated_pawns")
    assert next(f for f in isolated if f["side"] == "white")["added"] == ["b2", "d5"]
    assert not changes("7k/8/8/8/2P5/8/8/K7 w - - 0 1", "c4c5", "isolated_pawns")


def test_pawn_rules_are_color_symmetric_and_handle_en_passant():
    board = chess.Board("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1")
    move = chess.Move.from_uci("e5d6")
    assert board.is_en_passant(move)
    assert any(
        f["feature"] == "passed_pawns" and f["side"] == "black"
        for f in position_changes(board, move)
    )
    white = pawn_features(board, chess.WHITE)
    black = pawn_features(board.mirror(), chess.BLACK)
    for key in ("passed_pawns", "isolated_pawns"):
        assert {chess.square_mirror(s) for s in white[key]} == black[key]


def test_rook_open_file_is_not_an_invented_activity_or_advantage_claim():
    semi = changes("7k/3p4/8/8/8/8/P7/R5K1 w - - 0 1", "a1d1", "rook_file")[0]
    assert (semi["before"], semi["after"], semi["file"]) == ("closed", "semi_open", "d")
    opened = changes("7k/8/8/8/8/8/P7/R5K1 w - - 0 1", "a1d1", "rook_file")[0]
    assert opened["after"] == "open"
    assert not changes("7k/3p4/8/8/8/8/P2P4/R5K1 w - - 0 1", "a1d1", "rook_file")


def test_flight_square_must_be_legal_not_just_vacated():
    opened = changes("k7/8/8/8/8/8/5PPP/6K1 w - - 0 1", "h2h3", "king_flights")[0]
    assert opened["opened"] == ["h2"]
    assert not changes("k7/8/3b4/8/8/8/5PPP/6K1 w - - 0 1", "h2h3", "king_flights")


def test_pinned_defender_does_not_supply_piece_support():
    board = chess.Board("k3r3/8/8/8/4B3/2N5/8/4K3 w - - 0 1")
    # Be4 is pinned to Ke1 and therefore cannot defend a knight on d5.
    facts = position_changes(board, chess.Move.from_uci("c3d5"))
    assert not [
        f for f in facts if f["feature"] == "piece_support" and f["target"] == "d5" and f["after"]
    ]
    supported = changes("k7/8/8/8/4P3/2N5/8/4K3 w - - 0 1", "c3d5", "piece_support")
    knight = next(f for f in supported if f["target"] == "d5")
    assert knight["after"] == ["e4"]


def test_first_development_requires_original_history_and_never_repeats_after_return():
    parsed = game("1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 *")
    contexts = move_contexts(parsed)
    board = parsed.board()
    for ply, move in enumerate(parsed.mainline_moves(), 1):
        report = move_report(board, move.uci())
        explained = public_report(report, 1000, context=contexts[ply])
        events = [
            e
            for e in explained["intelligence"]["events"]
            if e["facts"].get("feature") == "first_development"
        ]
        assert bool(events) == (ply <= 2)
        assert not [
            e
            for e in public_report(report, 1000)["intelligence"]["events"]
            if e["facts"].get("feature") == "first_development"
        ]
        board.push(move)


def test_castling_is_a_relocation_not_a_guarantee_of_safety():
    fact = changes("r3k2r/8/8/8/8/8/5PPP/R3K2R w KQkq - 0 1", "e1g1", "castling")[0]
    assert fact["after"] == "g1" and fact["adjacent_pawns"] == ["f2", "g2", "h2"]
    assert not changes("r3k2r/8/8/8/8/8/5PPP/R3K2R w KQkq - 0 1", "e1f1", "castling")


def test_bishop_pair_requires_both_square_colors_not_two_promoted_same_color_bishops():
    lost = changes("7k/8/8/8/3b4/2B5/8/K4B2 b - - 0 1", "d4c3", "bishop_pair")
    assert lost[0]["side"] == "white" and lost[0]["after"] == 1
    assert not changes("7k/8/8/8/3b4/2B5/8/K1B5 b - - 0 1", "d4c3", "bishop_pair")


def test_positional_events_are_evidence_linked_and_do_not_change_with_eval_or_prose():
    board = chess.Board("7k/8/8/8/8/8/P7/R5K1 w - - 0 1")
    report = move_report(board, "a1d1", best="a1b1")

    def facts(value):
        return [
            e
            for e in public_report(value, 1000)["intelligence"]["events"]
            if e["kind"] == "positional"
        ]

    original = facts(report)
    assert {e["facts"]["line"] for e in original} == {"actual", "best"}
    assert all(
        {ref["source"] for ref in e["evidence"]} == {"position", "rule", "stockfish"}
        for e in original
    )
    changed = deepcopy(report)
    changed["actual"]["score"]["value"] = -1500
    changed["actual_line"]["frames"][0]["annotation"] = "invented strategic story"
    assert facts(changed) == original
    assert all(e["facts"]["value_judgment"] == "not_inferred" for e in original)
    changed["before_analysis_id"] = None
    assert facts(changed) == []


@pytest.mark.parametrize(
    "fen,uci", [(chess.STARTING_FEN, "e2e5"), ("8/8/8/8/8/8/8/8 w - - 0 1", "a1a2")]
)
def test_illegal_context_abstains(fen, uci):
    assert position_changes(chess.Board(fen), chess.Move.from_uci(uci)) == []
