"""Concrete board claims in the Black Italian curriculum have replayable evidence."""

import chess
from trainer.study_lessons.courses.authoring import position
from trainer.study_lessons.courses.italian_black import EVANS_FLANK, course
from trainer.study_lessons.courses.italian_black_nc3 import GAMBIT, LINE, MOLLER, QUEEN
from trainer.study_lessons.courses.italian_black_positions import (
    ADVANCE,
    CHECK,
    EVANS,
    EXCHANGED,
    ITALIAN,
    QUIET,
    RECAPTURED,
)
from trainer.study_lessons.courses.italian_black_variations import (
    CASTLED_FIRST,
    EARLY_ATTACK,
    KNIGHT_FIRST,
    PUSHED,
    QUEEN_CHECK,
    QUEEN_PRESSURE,
    QUEEN_RECAPTURE,
)

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
# Each optional side trip, by chapter and first step, and the recall line that rehearses it.
TRIP_LINES = {
    ("quiet-development", "early-castle"): "black-castled-first",
    ("quiet-development", "early-knight"): "black-knight-first",
    ("quiet-development", "early-attack"): "black-early-attack",
    ("quiet-development", "early-center"): "black-early-center",
    ("quiet-development", "quiet-knight-threat"): "black-knight-attack",
    ("central-break", "central-push"): "black-central-push",
    ("central-break", "central-queen"): "black-central-queen",
    ("central-break", "central-queen-check"): "black-central-check",
    ("central-break", "central-queen-b3"): "black-central-pressure",
    ("knight-block", "block-queen"): "black-knight-block-queen",
    ("knight-block", "block-moller"): "black-moller-attack",
    ("evans-declined", "evans-flank"): "black-evans-flank",
}


def _before(chapter, identity):
    return course().chapter(chapter).step(identity).position.board()


def _after(chapter, identity):
    step = course().chapter(chapter).step(identity)
    return step.position.after((step.choices[0].uci, *step.choices[0].reply)).board()


def _game(identity, ply):
    game = course().game(identity)
    return game.position.after(game.moves[:ply]).board()


def _piece(board, square, piece_type, color):
    assert board.piece_at(square) == chess.Piece(piece_type, color)


def _board(san):
    return position(san).board()


def _material(board):
    # Black's material lead in pawns.
    return sum(
        value * (len(board.pieces(piece, chess.BLACK)) - len(board.pieces(piece, chess.WHITE)))
        for piece, value in VALUES.items()
    )


def _trip_end(chapter, start):
    step = chapter.step(start)
    result = step.position.after(step.moves)
    identity = step.next_step
    while identity is not None:
        step = chapter.step(identity)
        if step.kind == "decision":
            assert step.position == result
            choice = step.choices[0]
            result = result.after((choice.uci, *choice.reply))
            identity = choice.next_step
        else:
            identity = step.next_step
    return result


def test_quiet_development_supports_both_e_pawns_before_castling():
    developed = _after("quiet-development", "develop")
    _piece(developed, chess.F6, chess.KNIGHT, chess.BLACK)
    assert chess.F6 in developed.attackers(chess.BLACK, chess.E4)
    assert chess.D3 in developed.attackers(chess.WHITE, chess.E4)
    supported = _after("quiet-development", "support")
    assert chess.D6 in supported.attackers(chess.BLACK, chess.E5)
    assert supported.piece_at(chess.D7) is None
    castled = _after("quiet-development", "castle")
    assert castled.king(chess.BLACK) == chess.G8
    _piece(castled, chess.F8, chess.ROOK, chess.BLACK)


def test_f7_warning_shows_castling_adds_a_defender_before_any_capture():
    chapter = course().chapter("quiet-development")
    branch = chapter.step("quiet-threat-choice")
    demo = chapter.step(branch.branch_start)
    threatened = demo.position.after(demo.moves).board()
    assert {chess.G5, chess.C4} <= set(threatened.attackers(chess.WHITE, chess.F7))
    assert {chess.D8, chess.H8} <= set(chess.SquareSet(chess.BB_KNIGHT_ATTACKS[chess.F7]))
    castle = chapter.step(demo.next_step)
    castled = castle.position.after((castle.choices[0].uci,)).board()
    assert {chess.G8, chess.F8} <= set(castled.attackers(chess.BLACK, chess.F7))
    captured = castled.copy()
    captured.push_san("Nxf7")
    assert captured.parse_san("Rxf7") == chess.Move(chess.F8, chess.F7)
    summary = chapter.step(castle.choices[0].next_step)
    assert summary.position.board().fen() == castled.fen()
    assert chapter.step(branch.next_step).position == branch.position


def test_quiet_plan_adds_pawn_restraint_without_claiming_b4_is_impossible():
    restrained = _after("quiet-bishop-plan", "plan-restrain")
    assert {chess.A5, chess.C5} <= set(restrained.attackers(chess.BLACK, chess.B4))
    # White has just played Nbd2; examine White's legal resources before it.
    step = course().chapter("quiet-bishop-plan").step("plan-restrain")
    after_a5 = step.position.after((step.choices[0].uci,)).board()
    assert chess.Move(chess.B2, chess.B4) in after_a5.legal_moves
    bishop = course().chapter("quiet-bishop-plan").step("plan-bishop")
    offered = bishop.position.after((bishop.choices[0].uci,)).board()
    assert chess.E6 in offered.attackers(chess.BLACK, chess.C4)
    assert chess.C4 in offered.attackers(chess.WHITE, chess.E6)
    assert offered.parse_san("Bb3") in offered.legal_moves


def test_quiet_plan_explains_real_recapture_costs_without_an_instant_rook_attack():
    before = _before("quiet-bishop-plan", "plan-recapture")
    assert [move.uci() for move in before.legal_moves if move.to_square == chess.E6] == ["f7e6"]
    board = _after("quiet-bishop-plan", "plan-recapture")
    assert len(board.pieces(chess.PAWN, chess.BLACK) & chess.BB_FILE_E) == 2
    assert not board.pieces(chess.PAWN, chess.BLACK) & chess.BB_FILE_F
    assert board.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_F
    assert {chess.D5, chess.F5} <= set(board.attacks(chess.E6))
    assert chess.E5 not in board.attacks(chess.E6)
    assert chess.E6 not in board.attacks(chess.E5)
    _piece(board, chess.F6, chess.KNIGHT, chess.BLACK)
    assert chess.F2 not in board.attacks(chess.F8)
    _piece(board, chess.C5, chess.BISHOP, chess.BLACK)
    for piece_type in chess.PIECE_TYPES:
        assert len(board.pieces(piece_type, chess.WHITE)) == len(
            board.pieces(piece_type, chess.BLACK)
        )


def test_quiet_plan_rehearses_new_decisions_from_the_learned_castled_position():
    definition = course()
    old_setup = definition.line("black-quiet-italian")
    plan = definition.line("black-quiet-bishop-plan")
    assert plan.position == old_setup.position.after(old_setup.moves)
    chapter = definition.chapter("quiet-bishop-plan")
    assert chapter.step("plan-recall").position == plan.position
    board = plan.position.board()
    decisions = []
    for uci in plan.moves:
        if board.turn == chess.BLACK:
            decisions.append((board.fen(), uci))
        board.push_uci(uci)
    assert decisions == [
        (step.position.board().fen(), step.choices[0].uci)
        for step in chapter.steps
        if step.kind == "decision"
    ]
    assert board.fen() == chapter.step("plan-summary").position.board().fen()


def test_central_sequence_checks_exchanges_breaks_and_castles_as_described():
    threatened = _before("central-break", "central-capture")
    assert chess.E5 in threatened.attacks(chess.D4)
    assert chess.C5 in threatened.attacks(chess.D4)
    step = course().chapter("central-break").step("central-check")
    checked = step.position.after((step.choices[0].uci,)).board()
    assert checked.is_check()
    blocked = _after("central-break", "central-check")
    _piece(blocked, chess.D2, chess.BISHOP, chess.WHITE)
    step = course().chapter("central-break").step("central-trade")
    exchange = step.position.after((step.choices[0].uci,)).board()
    assert exchange.is_check()
    traded = _before("central-break", "central-break")
    _piece(traded, chess.D2, chess.KNIGHT, chess.WHITE)
    assert len(traded.pieces(chess.BISHOP, chess.WHITE)) == 1
    assert len(traded.pieces(chess.BISHOP, chess.BLACK)) == 1
    step = course().chapter("central-break").step("central-break")
    challenged = step.position.after((step.choices[0].uci,)).board()
    assert {chess.C4, chess.E4} <= set(challenged.attacks(chess.D5))
    restored = _after("central-break", "central-recapture")
    for piece_type in chess.PIECE_TYPES:
        assert len(restored.pieces(piece_type, chess.WHITE)) == len(
            restored.pieces(piece_type, chess.BLACK)
        )
    castled = _after("central-break", "central-castle")
    assert castled.king(chess.WHITE) == chess.G1
    assert castled.king(chess.BLACK) == chess.G8


def test_central_endpoint_is_an_isolated_pawn_blockade_with_white_space():
    board = _before("central-break", "central-plan")
    _piece(board, chess.D4, chess.PAWN, chess.WHITE)
    _piece(board, chess.D5, chess.KNIGHT, chess.BLACK)
    white_pawns = board.pieces(chess.PAWN, chess.WHITE)
    assert not white_pawns & (chess.BB_FILE_C | chess.BB_FILE_E)
    assert chess.Move(chess.D4, chess.D5) not in board.legal_moves
    assert chess.E5 in board.attacks(chess.D4)
    assert chess.F3 in board.attackers(chess.WHITE, chess.D4)


def test_evans_retreat_is_prepared_and_keeps_material_equal():
    declined = _after("evans-declined", "evans-decline")
    _piece(declined, chess.B6, chess.BISHOP, chess.BLACK)
    assert len(declined.pieces(chess.PAWN, chess.WHITE)) == 8
    assert len(declined.pieces(chess.PAWN, chess.BLACK)) == 8
    room = _after("evans-declined", "evans-room")
    assert room.piece_at(chess.A7) is None
    assert chess.A5 in room.attackers(chess.WHITE, chess.B6)
    retreat = _after("evans-declined", "evans-retreat")
    _piece(retreat, chess.A7, chess.BISHOP, chess.BLACK)
    assert not retreat.is_attacked_by(chess.WHITE, chess.A7)
    line = course().line("black-evans-declined")
    final = line.position.after(line.moves).board()
    assert final.king(chess.WHITE) == chess.G1
    assert final.king(chess.BLACK) == chess.G8


def test_evans_rehearsal_does_not_introduce_untaught_development_decisions():
    definition = course()
    chapter = definition.chapter("evans-declined")
    guided = {
        (step.position.board().fen(), choice.uci)
        for step in chapter.steps
        if step.kind == "decision"
        for choice in step.choices
    }
    line = definition.line("black-evans-declined")
    board = line.position.board()
    evans_seen = False
    for uci in line.moves:
        if uci == "b2b4":
            evans_seen = True
        if evans_seen and board.turn == chess.BLACK:
            assert (board.fen(), uci) in guided
        board.push_uci(uci)
    developed = _after("evans-declined", "evans-develop")
    assert chess.F6 in developed.attackers(chess.BLACK, chess.E4)
    assert chess.D3 in developed.attackers(chess.WHITE, chess.E4)
    assert _after("evans-declined", "evans-castle").fen() == board.fen()


def test_historical_annotations_describe_the_exact_saved_ply():
    doubled = _game("mason-lasker", 13)
    assert len(doubled.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_E) == 2
    assert not doubled.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_F
    assert doubled.pieces(chess.PAWN, chess.BLACK) & chess.BB_FILE_F
    assert _game("mason-lasker", 20).king(chess.BLACK) == chess.G8
    assert _game("steinitz-bardeleben", 12).is_check()
    central = _game("steinitz-bardeleben", 14)
    assert {chess.C4, chess.E4} <= set(central.attacks(chess.D5))
    assert central.is_pinned(chess.WHITE, chess.C3)
    assert _game("steinitz-bardeleben", 18).king(chess.BLACK) == chess.E8
    assert _game("steinitz-bardeleben", 49).is_check()
    assert not _game("steinitz-bardeleben", 49).is_checkmate()


def test_pollock_lasker_score_has_exact_opening_and_recorded_fork_endpoint():
    historical = course().game("pollock-lasker")
    assert len(historical.moves) == 46
    board = historical.position.board()
    san = []
    for move_uci in historical.moves[:14]:
        move = chess.Move.from_uci(move_uci)
        san.append(board.san(move))
        board.push(move)
    assert " ".join(san) == "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bb6 c3 d6 a4 a6 a5 Ba7"
    final = _game("pollock-lasker", 46)
    _piece(final, chess.E2, chess.KNIGHT, chess.BLACK)
    _piece(final, chess.C3, chess.QUEEN, chess.WHITE)
    assert {chess.C3, chess.G1} <= set(final.attacks(chess.E2))
    assert final.is_check() and not final.is_checkmate()


def test_evans_excerpt_reaches_the_central_break_not_just_repeated_development():
    excerpt = course().chapter("evans-declined").step("evans-game")
    board = _game(excerpt.game_id, excerpt.to_ply)
    _piece(board, chess.D5, chess.PAWN, chess.BLACK)
    assert chess.E4 in board.attacks(chess.D5)
    assert {chess.F6, chess.B7, chess.E7} <= set(board.attackers(chess.BLACK, chess.D5))
    assert board.king(chess.BLACK) == chess.G8
    assert board.king(chess.WHITE) == chess.E1


def test_new_course_annotations_do_not_change_the_existing_white_course():
    from trainer.study_lessons.courses.italian import course as white_course

    before = white_course().model_dump(mode="json")
    black = course()
    black.game("mason-lasker").annotations[0].text = "Changed by one consumer"
    assert white_course().model_dump(mode="json") == before
    assert course().game("mason-lasker").annotations[0].text != "Changed by one consumer"


def test_fourth_move_side_trips_state_real_board_facts():
    castled = _board(ITALIAN + " O-O Nf6 d3")
    assert castled.epd() == _before("quiet-development", "support").epd()
    loose = _board(ITALIAN + " O-O Nf6 c3")
    assert not loose.attackers(chess.WHITE, chess.E4)
    for move in ("Nxe4", "d4", "d5"):
        loose.push_san(move)
    assert chess.C4 in loose.attacks(chess.D5)
    assert _material(_board(ITALIAN + " O-O Nf6 d4 Bxd4 Nxd4 Nxd4")) == 1
    for san in (ITALIAN + " O-O Nf6 Ng5", CASTLED_FIRST + " Ng5"):
        board = _board(san)
        assert {chess.G5, chess.C4} <= set(board.attackers(chess.WHITE, chess.F7))
        assert board.parse_san("O-O") == chess.Move(chess.E8, chess.G8)
    for move in ("Nc3", "Re1"):
        board = _board(ITALIAN + " O-O Nf6 " + move)
        assert board.parse_san("d6") == chess.Move(chess.D7, chess.D6)

    knight = _board(ITALIAN + " Nc3")
    _piece(knight, chess.C3, chess.KNIGHT, chess.WHITE)
    _piece(knight, chess.C2, chess.PAWN, chess.WHITE)
    assert chess.C3 in knight.attackers(chess.WHITE, chess.E4)
    board = _board(KNIGHT_FIRST + " Be3")
    assert chess.C5 in board.attackers(chess.BLACK, chess.E3)
    assert board.parse_san("Bxe3") == chess.Move(chess.C5, chess.E3)
    # After 5.O-O instead of 5.d3, d6 reaches the castling trip's position.
    board = _board(ITALIAN + " Nc3 Nf6 O-O d6")
    assert board.epd() == _board(ITALIAN + " O-O Nf6 Nc3 d6").epd()
    trick = _board(ITALIAN + " Nc3 Nf6 Nxe5 Nxe5 d4")
    assert {chess.C5, chess.E5} <= set(trick.attacks(chess.D4))
    for move in ("Nxc4", "dxc5"):
        trick.push_san(move)
    assert _material(trick) == 2

    attack = _board(ITALIAN + " Ng5")
    assert {chess.G5, chess.C4} <= set(attack.attackers(chess.WHITE, chess.F7))
    assert not attack.attackers(chess.WHITE, chess.G5)
    assert chess.D8 in attack.attackers(chess.BLACK, chess.G5)
    chased = _board(ITALIAN + " Ng5 Qxg5 d4")
    assert chess.C1 in chased.attackers(chess.WHITE, chess.G5)
    assert chess.C5 in chased.attacks(chess.D4)
    grabbed = _board(EARLY_ATTACK)
    assert chess.H1 in grabbed.attacks(chess.G2)
    assert _material(grabbed) == 4
    for reply, follow_up in (("dxc5", "Qxh1+"), ("Rf1", "Qxe4+")):
        board = grabbed.copy()
        board.push_san(reply)
        board.push_san(follow_up)
        assert board.is_check()
    quiet = _board(ITALIAN + " Ng5 Qxg5 d3")
    assert chess.C1 in quiet.attackers(chess.WHITE, chess.G5)

    center = _board(ITALIAN + " d4")
    assert len(center.attackers(chess.BLACK, chess.D4)) == 3
    assert len(center.attackers(chess.WHITE, chess.D4)) == 2
    traded = _board(ITALIAN + " d4 Bxd4 Nxd4 Nxd4")
    assert _material(traded) == 1
    minors = chess.KNIGHT, chess.BISHOP
    assert sum(len(traded.pieces(piece, chess.WHITE)) for piece in minors) == sum(
        len(traded.pieces(piece, chess.BLACK)) for piece in minors
    )
    for queen in ("Qf3", "Qd5"):
        board = _board(ITALIAN + " d4 Bxd4 Nxd4 Nxd4 c3 Nc6 " + queen)
        threat = board.copy()
        threat.push(chess.Move.null())
        threat.push_san("Qxf7")
        assert threat.is_checkmate()
        board.push_san("Qf6")
        assert chess.F6 in board.attackers(chess.BLACK, chess.F7)
    board = _board(ITALIAN + " d4 Bxd4 Nxd4 Nxd4 c3 Nc6 Qf3 Qf6 Qxf6")
    assert board.parse_san("Nxf6") == chess.Move(chess.G8, chess.F6)
    board = _board(ITALIAN + " d4 Bxd4 Ng5 Nh6")
    assert chess.H6 in board.attackers(chess.BLACK, chess.F7)
    board = _board(ITALIAN + " d4 Bxd4 c3")
    assert chess.D4 in board.attacks(chess.C3)
    assert board.parse_san("Bb6") == chess.Move(chess.D4, chess.B6)
    board = _board(ITALIAN + " d4 Bxd4 Nxd4 Nxd4 Be3")
    assert chess.E3 in board.attackers(chess.WHITE, chess.D4)
    assert board.parse_san("Nc6") == chess.Move(chess.D4, chess.C6)
    board = _board(ITALIAN + " d4 Bxd4 Nxd4 Nxd4 Qh5")
    assert {chess.F7, chess.E5} <= set(board.attacks(chess.H5))
    board.push_san("Qe7")
    assert {chess.F7, chess.E5} <= set(board.attacks(chess.E7))


def test_central_side_trips_state_real_board_facts():
    pushed = _board(ADVANCE + " exd4 e5 d5")
    assert chess.F6 in pushed.attacks(chess.E5)
    assert chess.C4 in pushed.attacks(chess.D5)
    for capture in ("exf6", "cxd4"):
        board = pushed.copy()
        board.push_san(capture)
        assert board.parse_san("dxc4") == chess.Move(chess.D5, chess.C4)
    board = _board(ADVANCE + " exd4 e5 d5 exf6 dxc4 fxg7")
    assert chess.H8 in board.attacks(chess.G7)
    assert board.parse_san("Rg8") == chess.Move(chess.H8, chess.G8)
    board = _board(ADVANCE + " exd4 e5 d5 exd6")
    assert board.parse_san("Qxd6") == chess.Move(chess.D8, chess.D6)
    assert _board(ADVANCE + " exd4 e5 d5 Bb5").is_pinned(chess.BLACK, chess.C6)
    jumped = _board(ADVANCE + " exd4 e5 d5 Bb5 Ne4 cxd4")
    assert chess.D5 in jumped.attackers(chess.BLACK, chess.E4)
    assert not jumped.attackers(chess.WHITE, chess.E4)
    assert chess.C5 in jumped.attacks(chess.D4)
    kept = _board(PUSHED)
    assert chess.D4 in kept.attacks(chess.B6)
    assert not kept.is_attacked_by(chess.WHITE, chess.B6)

    assert chess.D2 in _board(EXCHANGED + " Nbxd2").attackers(chess.WHITE, chess.E4)
    assert not _board(EXCHANGED + " Qxd2").attackers(chess.WHITE, chess.E4)
    assert _board(EXCHANGED + " Qxd2 Nxe4 Qe3").is_pinned(chess.BLACK, chess.E4)
    held = _board(QUEEN_RECAPTURE)
    assert chess.D5 in held.attackers(chess.BLACK, chess.E4)
    assert chess.C4 in held.attacks(chess.D5)
    assert _material(held) == 1
    board = held.copy()
    board.push_san("Bb5")
    assert board.is_pinned(chess.BLACK, chess.C6)
    board.push_san("Bd7")
    assert not board.is_pinned(chess.BLACK, chess.C6)
    board = held.copy()
    board.push_san("Bxd5")
    assert board.parse_san("Qxd5") == chess.Move(chess.D8, chess.D5)
    board = held.copy()
    for move in ("Nc3", "O-O"):
        board.push_san(move)
    assert not board.is_pinned(chess.BLACK, chess.E4)

    assert _board(RECAPTURED + " Qe2+").is_check()
    blocked = _board(RECAPTURED + " Qe2+ Be6")
    assert chess.E6 in blocked.attackers(chess.BLACK, chess.D5)
    assert blocked.is_pinned(chess.BLACK, chess.E6)
    wrong = _board(RECAPTURED + " Qe2+ Qe7")
    assert not wrong.attackers(chess.BLACK, chess.D5)
    assert chess.C4 in wrong.attackers(chess.WHITE, chess.D5)
    board = _board(RECAPTURED + " Qe2+ Be6 Bxd5")
    assert chess.Move(chess.E6, chess.D5) not in board.legal_moves
    assert board.parse_san("Qxd5") == chess.Move(chess.D8, chess.D5)
    board = _board(RECAPTURED + " Qe2+ Be6 Ng5")
    assert not board.attackers(chess.WHITE, chess.G5)
    assert board.parse_san("Qxg5") == chess.Move(chess.D8, chess.G5)
    board = _board(RECAPTURED + " Qe2+ Be6 Ne5")
    assert not board.attackers(chess.WHITE, chess.D4)
    board.push_san("Nxd4")
    assert chess.E2 in board.attacks(chess.D4)
    _piece(board, chess.E2, chess.QUEEN, chess.WHITE)

    pressure = _board(RECAPTURED + " Qb3")
    assert chess.C4 in pressure.attackers(chess.WHITE, chess.D5)
    battery = pressure.copy()
    battery.remove_piece_at(chess.C4)
    assert chess.B3 in battery.attackers(chess.WHITE, chess.D5)
    assert chess.B7 in pressure.attacks(chess.B3)
    defended = _board(RECAPTURED + " Qb3 Nce7")
    assert {chess.D8, chess.E7} <= set(defended.attackers(chess.BLACK, chess.D5))
    assert chess.C8 in defended.attackers(chess.BLACK, chess.B7)
    board = _board(RECAPTURED + " Qb3 Na5")
    assert {chess.B3, chess.C4} <= set(board.attacks(chess.A5))
    board.push_san("Qa4+")
    assert board.is_check()
    for move in ("Nc6", "Qb3"):
        board.push_san(move)
    assert board.epd() == pressure.epd()
    for san in (QUEEN_CHECK, QUEEN_PRESSURE):
        board = _board(san)
        assert _material(board) == 0
        assert not board.pieces(chess.PAWN, chess.WHITE) & (chess.BB_FILE_C | chess.BB_FILE_E)
        _piece(board, chess.D4, chess.PAWN, chess.WHITE)


def test_knight_block_chapter_takes_the_pawn_the_pinned_knight_cannot_defend():
    lesson = course()
    chapter = lesson.chapter("knight-block")
    assert _board(CHECK + " Nc3").is_pinned(chess.WHITE, chess.C3)
    taken = _board(CHECK + " Nc3 Nxe4")
    assert chess.Move(chess.C3, chess.E4) not in taken.legal_moves
    assert {chess.B4, chess.E4} <= set(taken.attackers(chess.BLACK, chess.C3))
    assert _board(CHECK + " Nc3 Nxe4 Qe2").is_pinned(chess.BLACK, chess.E4)
    defended = _board(CHECK + " Nc3 Nxe4 Qe2 d5 Bb5")
    assert chess.D5 in defended.attackers(chess.BLACK, chess.E4)
    assert defended.is_pinned(chess.BLACK, chess.C6)
    safe = _board(QUEEN)
    assert not safe.is_pinned(chess.BLACK, chess.C6)
    assert not safe.is_pinned(chess.BLACK, chess.E4)
    assert safe.is_pinned(chess.WHITE, chess.C3)
    assert len(safe.attackers(chess.BLACK, chess.C3)) == 2
    assert _material(safe) == 1

    castled = _board(CHECK + " Nc3 Nxe4 O-O")
    assert not castled.is_pinned(chess.WHITE, chess.C3)
    for move in ("O-O", "Nd5"):
        castled.push_san(move)
    assert chess.B4 in castled.attacks(chess.D5)
    moller = _board(GAMBIT + " d5")
    assert chess.C3 in moller.attacks(chess.B2)
    assert chess.C6 in moller.attacks(chess.D5)
    assert _material(_board(MOLLER)) == 2
    board = _board(GAMBIT + " d5 Bf6 Re1 Ne7 Rxe4")
    assert board.parse_san("O-O") == chess.Move(chess.E8, chess.G8)

    rook = _board(GAMBIT + " bxc3")
    rook.push(chess.Move.null())
    rook.push_san("Re1")
    assert rook.is_pinned(chess.BLACK, chess.E4)
    supported = _board(GAMBIT + " bxc3 d5")
    assert chess.D5 in supported.attackers(chess.BLACK, chess.E4)
    assert chess.C4 in supported.attacks(chess.D5)
    stopped = _board(GAMBIT + " bxc3 d5 Ba3")
    assert chess.F8 in stopped.attacks(chess.A3)
    assert chess.Move(chess.E8, chess.G8) not in stopped.legal_moves
    assert stopped.parse_san("dxc4") == chess.Move(chess.D5, chess.C4)
    final = _board(LINE)
    assert final.king(chess.BLACK) == chess.G8
    assert not final.is_pinned(chess.BLACK, chess.C6)
    assert not final.is_pinned(chess.BLACK, chess.E4)
    assert _material(final) == 1
    assert len(final.pieces(chess.BISHOP, chess.WHITE)) == 2
    assert len(final.pieces(chess.BISHOP, chess.BLACK)) == 1
    line = lesson.line("black-knight-block")
    assert line.position.after(line.moves) == chapter.step("block-summary").position
    assert chapter.step("block-recall").position == line.position == position(CHECK)


def test_evans_b5_side_trip_wins_the_e4_pawn_white_left_undefended():
    assert chess.C6 in _board(EVANS + " b5").attacks(chess.B5)
    assert _board(EVANS + " b5 axb5 Bxb5").is_pinned(chess.BLACK, chess.C6)
    assert not _board(EVANS + " b5 axb5 Bxb5 Nf6 a6").attackers(chess.WHITE, chess.E4)
    final = _board(EVANS_FLANK)
    assert _material(final) == 1
    board = final.copy()
    board.push_san("Qe2")
    assert chess.E2 in board.attackers(chess.WHITE, chess.E4)
    assert board.parse_san("Nf6") == chess.Move(chess.E4, chess.F6)
    board = final.copy()
    board.push_san("axb7")
    assert board.parse_san("Bxb7") == chess.Move(chess.C8, chess.B7)


def test_every_side_trip_has_a_recall_line_that_follows_it():
    lesson = course()
    trips = {
        (chapter.id, step.branch_start)
        for chapter in lesson.chapters
        for step in chapter.steps
        if step.kind == "branch"
    }
    assert trips == set(TRIP_LINES)
    for (chapter_id, start), line_id in TRIP_LINES.items():
        line = lesson.line(line_id)
        assert line.position.after(line.moves) == _trip_end(lesson.chapter(chapter_id), start)
        # Recall ends on the learner's own move.
        assert line.position.after(line.moves).board().turn == chess.WHITE


def test_recall_lines_start_where_their_chapters_start():
    lesson = course()
    anchors = {
        "black-quiet-italian": "",
        "black-castled-first": "",
        "black-knight-first": "",
        "black-early-attack": "",
        "black-early-center": "",
        "black-knight-attack": "",
        "black-quiet-bishop-plan": QUIET,
        "black-central-counterplay": "",
        "black-central-push": "",
        "black-central-queen": "",
        "black-central-check": "",
        "black-central-pressure": "",
        "black-knight-block": CHECK,
        "black-knight-block-queen": CHECK,
        "black-moller-attack": CHECK,
        "black-evans-declined": "",
        "black-evans-flank": "",
    }
    assert {line.id: line.position for line in lesson.lines} == {
        identity: position(san) for identity, san in anchors.items()
    }
    assert [chapter.id for chapter in lesson.chapters] == [
        "quiet-development",
        "quiet-bishop-plan",
        "central-break",
        "knight-block",
        "evans-declined",
    ]
