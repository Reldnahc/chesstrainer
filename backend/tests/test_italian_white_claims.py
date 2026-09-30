"""Board evidence for the White Italian's actual decisions and contrasting branches."""

import chess
from trainer.study_lessons.courses.authoring import position
from trainer.study_lessons.courses.italian import course
from trainer.study_lessons.courses.italian_center import ADVANCE
from trainer.study_lessons.courses.italian_positions import (
    CENTRAL,
    DEVELOPED,
    ITALIAN,
    KNIGHT_ROUTE,
    PREPARED,
    QUIET,
)


def board(san):
    return position(san).board()


def step_board(chapter_id, step_id):
    return course().chapter(chapter_id).step(step_id).position.board()


def test_two_knights_branch_transposes_only_after_the_bishop_choice():
    knight_first = position(ITALIAN + " Nf6 d3 Bc5")
    bishop_first = position(ITALIAN + " Bc5 d3 Nf6")
    assert knight_first.moves != bishop_first.moves
    assert knight_first.board().fen() == bishop_first.board().fen()
    before_reply = board(ITALIAN + " Nf6 d3")
    assert chess.D3 in before_reply.attackers(chess.WHITE, chess.E4)
    assert before_reply.parse_san("Be7") in before_reply.legal_moves
    assert board(ITALIAN + " Nf6 d3 Be7").board_fen() != bishop_first.board().board_fen()
    branch = course().chapter("quiet-development").step("two-support")
    assert branch.choices[0].uci == "d2d3"
    assert branch.choices[0].reply == ("f8c5",)


def test_rook_and_knight_route_provide_the_claimed_support_without_blocking_each_other():
    prepared = board(PREPARED)
    assert prepared.piece_at(chess.F1) is None
    assert chess.E1 in prepared.attackers(chess.WHITE, chess.E4)
    knight_out = board(PREPARED + " Bb3 Ba7 Nbd2 h6")
    assert chess.D2 in knight_out.attackers(chess.WHITE, chess.E4)
    assert knight_out.parse_san("Nf1") in knight_out.legal_moves
    routed = step_board("finish-development", "develop-last-bishop")
    assert routed.piece_at(chess.D2) is None
    assert routed.parse_san("Be3") in routed.legal_moves
    assert routed.parse_san("Ng3") in routed.legal_moves
    # Leaving d2 removed this particular defender; d3 and Re1 still cover e4.
    assert chess.F1 not in routed.attackers(chess.WHITE, chess.E4)
    assert {chess.D3, chess.E1} <= set(routed.attackers(chess.WHITE, chess.E4))


def test_bishop_escape_does_not_claim_blocked_support_as_an_existing_defender():
    threatened = step_board("finish-development", "save-bishop")
    assert chess.A5 in threatened.attackers(chess.BLACK, chess.B3)
    threatened.push_san("Bc2")
    assert chess.A5 not in threatened.attackers(chess.BLACK, chess.C2)
    assert chess.C2 not in threatened.attackers(chess.WHITE, chess.E4)
    assert threatened.piece_at(chess.D3) == chess.Piece(chess.PAWN, chess.WHITE)
    threatened.push_san("Re8")
    threatened.push_san("d4")
    assert chess.C2 in threatened.attackers(chess.WHITE, chess.E4)


def test_piece_recapture_keeps_the_actual_structure_distinct_from_the_historical_example():
    developed = step_board("finish-development", "development-takeaway")
    assert developed.piece_at(chess.E3) == chess.Piece(chess.KNIGHT, chess.WHITE)
    assert developed.piece_at(chess.F2) == chess.Piece(chess.PAWN, chess.WHITE)
    assert set(developed.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_E) == {chess.E4}
    assert {chess.D5, chess.F5} <= set(developed.attacks(chess.E3))
    assert developed.piece_at(chess.B1) is None and developed.piece_at(chess.C1) is None
    source = course().game("mason-lasker")
    contrast = source.position.after(source.moves[:14]).board()
    assert set(contrast.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_E) == {
        chess.E3,
        chess.E4,
    }
    assert not contrast.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_F
    assert contrast.pieces(chess.PAWN, chess.BLACK) & chess.BB_FILE_F


def test_premature_black_break_has_the_specific_capture_and_rook_tactic():
    after_break = step_board("finish-development", "capture-break")
    assert {chess.C4, chess.E4} <= set(after_break.attacks(chess.D5))
    after_break.push_san("exd5")
    after_break.push_san("Nxd5")
    assert set(after_break.attackers(chess.BLACK, chess.E5)) == {chess.C6}
    assert chess.E1 in after_break.attackers(chess.WHITE, chess.E5)
    for san in ("Nxe5", "Nxe5", "Rxe5", "c6"):
        after_break.push_san(san)
    assert len(after_break.pieces(chess.PAWN, chess.WHITE)) == 7
    assert len(after_break.pieces(chess.PAWN, chess.BLACK)) == 6
    assert len(after_break.pieces(chess.KNIGHT, chess.WHITE)) == 1
    assert len(after_break.pieces(chess.KNIGHT, chess.BLACK)) == 1
    assert chess.C6 in after_break.attackers(chess.BLACK, chess.D5)
    assert after_break.piece_at(chess.E5) == chess.Piece(chess.ROOK, chess.WHITE)


def test_d4_replaces_pawn_support_and_enables_the_prepared_recapture():
    before = step_board("central-break", "play-break")
    assert {chess.D3, chess.E1, chess.G3} <= set(before.attackers(chess.WHITE, chess.E4))
    before.push_san("d4")
    assert chess.D3 not in before.attackers(chess.WHITE, chess.E4)
    assert {chess.E1, chess.G3} <= set(before.attackers(chess.WHITE, chess.E4))
    assert {chess.C3, chess.D1, chess.F3} <= set(before.attackers(chess.WHITE, chess.D4))
    assert chess.E5 in before.attacks(chess.D4)
    before.push_san("exd4")
    assert before.parse_san("cxd4") in before.legal_moves


def test_exchanging_before_recapturing_removes_a_real_pin_without_inventing_doubled_pawns():
    immediate = board(ADVANCE + " exd4 cxd4 Bg4")
    assert chess.G4 in immediate.attackers(chess.BLACK, chess.F3)
    assert immediate.piece_at(chess.D1) == chess.Piece(chess.QUEEN, chess.WHITE)
    assert immediate.piece_at(chess.E2) is None
    assert immediate.piece_at(chess.F3) == chess.Piece(chess.KNIGHT, chess.WHITE)
    # This is a relative pin to the queen, not a legality/king pin.
    assert not immediate.is_pinned(chess.WHITE, chess.F3)

    exchanged = step_board("central-break", "rebuild-center")
    assert set(exchanged.pieces(chess.BISHOP, chess.BLACK)) == {chess.A7}
    assert chess.BB_E6 & chess.BB_LIGHT_SQUARES
    assert chess.BB_A7 & chess.BB_DARK_SQUARES
    assert set(exchanged.pieces(chess.PAWN, chess.BLACK) & chess.BB_FILE_E) == {chess.E6}
    assert exchanged.piece_at(chess.D4) == chess.Piece(chess.PAWN, chess.BLACK)
    assert not exchanged.pieces(chess.PAWN, chess.BLACK) & chess.BB_FILE_F
    assert exchanged.piece_at(chess.F2) == chess.Piece(chess.PAWN, chess.WHITE)


def test_central_line_finishes_with_pawn_space_and_development_but_preserves_black_resources():
    finish = step_board("central-break", "central-takeaway")
    assert finish.piece_at(chess.D4) == chess.Piece(chess.PAWN, chess.WHITE)
    assert finish.piece_at(chess.E4) == chess.Piece(chess.PAWN, chess.WHITE)
    assert finish.piece_at(chess.E3) == chess.Piece(chess.BISHOP, chess.WHITE)
    assert chess.E3 in finish.attackers(chess.WHITE, chess.D4)
    assert finish.piece_at(chess.C1) is None
    assert len(finish.pieces(chess.PAWN, chess.WHITE)) == 7
    assert len(finish.pieces(chess.PAWN, chess.BLACK)) == 7
    assert finish.parse_san("Ng4") in finish.legal_moves
    assert finish.parse_san("e5") in finish.legal_moves
    chased = finish.copy()
    chased.push_san("Ng4")
    assert chess.G4 in chased.attackers(chess.BLACK, chess.E3)
    finish.push_san("e5")
    assert chess.E5 in finish.attackers(chess.BLACK, chess.D4)


def test_better_prepared_black_break_recovers_material_with_active_pieces():
    position_after_break = step_board("central-break", "centralize-under-pressure")
    assert {chess.C6, chess.G4} <= set(position_after_break.attackers(chess.BLACK, chess.E5))
    position_after_break.push_san("Nd4")
    assert chess.D4 in position_after_break.attackers(chess.WHITE, chess.E6)
    position_after_break.push_san("Ncxe5")
    assert len(position_after_break.pieces(chess.PAWN, chess.WHITE)) == 7
    assert len(position_after_break.pieces(chess.PAWN, chess.BLACK)) == 7
    assert position_after_break.piece_at(chess.D5) == chess.Piece(chess.PAWN, chess.BLACK)
    assert set(position_after_break.pieces(chess.KNIGHT, chess.BLACK)) == {chess.G4, chess.E5}
    assert {chess.F2, chess.H2} <= set(position_after_break.attacks(chess.G4))


def test_later_rehearsals_use_the_taught_anchor_and_do_not_enroll_illustrative_branches():
    lesson = course()
    development = lesson.line("central-preparation")
    central = lesson.line("central-break")
    assert development.position == position(QUIET)
    assert development.position.after(development.moves) == position(DEVELOPED)
    assert central.position == position(KNIGHT_ROUTE)
    assert central.position.after(central.moves) == position(CENTRAL)
    assert set(line.id for line in lesson.lines) == {
        "quiet-italian",
        "central-preparation",
        "central-break",
    }
    assert "two-knights" not in {chapter.id for chapter in lesson.chapters}
