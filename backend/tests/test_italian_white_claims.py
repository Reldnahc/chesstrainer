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
from trainer.study_lessons.courses.italian_two_knights import TWO_KNIGHTS, WAIT
from trainer.study_lessons.courses.italian_variations import EARLY_H6, KNIGHT_JUMP


def board(san):
    return position(san).board()


def step_board(chapter_id, step_id):
    return course().chapter(chapter_id).step(step_id).position.board()


def test_two_knights_chapter_defends_e4_and_answers_the_d5_strike():
    knight_first = position(ITALIAN + " Nf6 d3 Bc5")
    bishop_first = position(ITALIAN + " Bc5 d3 Nf6")
    assert knight_first.moves != bishop_first.moves
    assert knight_first.board().fen() == bishop_first.board().fen()
    defend = course().chapter("two-knights").step("two-knights-defend")
    assert defend.choices[0].uci == "d2d3" and defend.choices[0].reply == ()
    attacked = defend.position.board()
    assert chess.F6 in attacked.attackers(chess.BLACK, chess.E4)
    assert not attacked.attackers(chess.WHITE, chess.E4)
    attacked.push_san("d3")
    assert chess.D3 in attacked.attackers(chess.WHITE, chess.E4)

    strike = step_board("two-knights", "two-knights-take")
    assert {chess.C4, chess.E4} <= set(strike.attacks(chess.D5))
    for san in ("exd5", "Nxd5", "O-O", "Be6"):
        strike.push_san(san)
    assert chess.E6 in strike.attackers(chess.BLACK, chess.D5)
    strike.push_san("Re1")
    assert {chess.E1, chess.F3} <= set(strike.attackers(chess.WHITE, chess.E5))
    assert set(strike.attackers(chess.BLACK, chess.E5)) == {chess.C6}
    strike.push_san("Bd6")
    assert set(strike.attackers(chess.BLACK, chess.E5)) == {chess.C6, chess.D6}
    assert strike.king(chess.BLACK) == chess.E8


def test_two_knights_d6_side_trip_wins_the_undefended_e6_pawn():
    weak = step_board("two-knights", "two-knights-d6-attack")
    assert set(weak.attackers(chess.BLACK, chess.F7)) == {chess.E8}
    assert {
        square for square in weak.attacks(chess.F8) if weak.color_at(square) != chess.BLACK
    } == {chess.E7}
    weak.push_san("Ng5")
    assert {chess.C4, chess.G5} <= set(weak.attackers(chess.WHITE, chess.F7))
    fork = weak.copy()
    fork.push_san("a6")
    fork.push_san("Nxf7")
    assert {chess.D8, chess.H8} <= set(fork.attacks(chess.F7))
    for san in ("Be6", "Nxe6", "fxe6"):
        weak.push_san(san)
    assert not weak.attackers(chess.BLACK, chess.E6)
    assert chess.C4 in weak.attackers(chess.WHITE, chess.E6)
    weak.push_san("Bxe6")
    assert len(weak.pieces(chess.PAWN, chess.WHITE)) == 8
    assert len(weak.pieces(chess.PAWN, chess.BLACK)) == 7
    assert not weak.pieces(chess.BISHOP, chess.BLACK) & chess.BB_LIGHT_SQUARES


def test_knight_jump_trap_and_its_punishment_state_real_board_facts():
    trap = board(ITALIAN + " Nd4")
    assert not trap.attackers(chess.BLACK, chess.E5)
    assert chess.D4 in trap.attackers(chess.BLACK, chess.F3)
    greedy = board(ITALIAN + " Nd4 Nxe5 Qg5")
    assert {chess.E5, chess.G2} <= set(greedy.attacks(chess.G5))

    sacrifice = step_board("quiet-development", "knight-jump-sacrifice")
    assert set(sacrifice.attackers(chess.BLACK, chess.F7)) == {chess.E8}
    assert chess.C5 in sacrifice.attackers(chess.BLACK, chess.D4)
    for san in ("Bxf7+", "Kxf7", "Qh5+"):
        sacrifice.push_san(san)
    assert sacrifice.is_check()
    # Every way out of the check leaves the c5-bishop attacked and undefended.
    for move in list(sacrifice.legal_moves):
        reply = sacrifice.copy()
        reply.push(move)
        assert reply.piece_at(chess.C5) == chess.Piece(chess.BISHOP, chess.BLACK)
        assert chess.H5 in reply.attackers(chess.WHITE, chess.C5)
        assert not reply.attackers(chess.BLACK, chess.C5)

    finish = board(KNIGHT_JUMP)
    assert finish.is_check()
    assert not finish.has_castling_rights(chess.BLACK)
    assert len(finish.pieces(chess.PAWN, chess.WHITE)) == 8
    assert len(finish.pieces(chess.PAWN, chess.BLACK)) == 7
    for kind in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN):
        assert len(finish.pieces(kind, chess.WHITE)) == len(finish.pieces(kind, chess.BLACK))
    finish.push_san("d6")
    assert not finish.attackers(chess.BLACK, chess.D4)
    assert chess.C5 in finish.attackers(chess.WHITE, chess.D4)
    knight = board(ITALIAN + " Nd4 Nxd4 exd4 O-O Nf6")
    assert chess.F6 in knight.attackers(chess.BLACK, chess.E4)
    assert not knight.attackers(chess.WHITE, chess.E4)
    knight.push_san("Re1")
    assert chess.E1 in knight.attackers(chess.WHITE, chess.E4)


def test_h6_side_trips_reach_the_quiet_setup_from_three_move_orders():
    main = board(ITALIAN + " Bc5 d3 Nf6 O-O h6 c3")
    assert board(EARLY_H6).fen() == main.fen()
    assert board(WAIT).fen() == main.fen()


def test_pin_side_trip_supports_the_knight_and_keeps_the_king_pawns():
    pinned = step_board("finish-development", "pin-question")
    assert chess.G4 in pinned.attackers(chess.BLACK, chess.F3)
    assert pinned.piece_at(chess.E2) is None
    assert pinned.piece_at(chess.D1) == chess.Piece(chess.QUEEN, chess.WHITE)
    # A relative pin to the queen, not a legal pin to the king.
    assert not pinned.is_pinned(chess.WHITE, chess.F3)
    support = step_board("finish-development", "pin-support")
    support.push_san("Nbd2")
    assert chess.D2 in support.attackers(chess.WHITE, chess.F3)
    taken = board(QUIET + " c3 Bg4 h3 Bxf3")
    assert chess.D1 in taken.attackers(chess.WHITE, chess.F3)
    taken.push_san("gxf3")
    assert not taken.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_G
    assert len(taken.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_F) == 2


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


def test_recall_lines_start_where_their_chapters_start():
    lesson = course()
    development = lesson.line("central-preparation")
    central = lesson.line("central-break")
    assert development.position == position(QUIET)
    assert development.position.after(development.moves) == position(DEVELOPED)
    assert central.position == position(KNIGHT_ROUTE)
    assert central.position.after(central.moves) == position(CENTRAL)
    anchors = {
        "quiet-italian": "",
        "knight-jump": "",
        "early-h6": "",
        "two-knights-center": TWO_KNIGHTS,
        "two-knights-h6": TWO_KNIGHTS,
        "two-knights-d6": TWO_KNIGHTS,
        "two-knights-check": TWO_KNIGHTS,
        "central-preparation": QUIET,
        "central-pin": QUIET,
        "premature-break": QUIET,
        "bishop-threat": QUIET,
        "central-break": KNIGHT_ROUTE,
        "active-break": KNIGHT_ROUTE,
    }
    assert {line.id: line.position for line in lesson.lines} == {
        identity: position(san) for identity, san in anchors.items()
    }
    assert [chapter.id for chapter in lesson.chapters] == [
        "quiet-development",
        "two-knights",
        "finish-development",
        "central-break",
    ]
