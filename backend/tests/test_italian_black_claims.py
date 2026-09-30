"""Concrete board claims in the Black Italian curriculum have replayable evidence."""

import chess
from trainer.study_lessons.courses.italian_black import course


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
    traded = _after("central-break", "central-trade")
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


def test_new_course_annotations_do_not_change_the_existing_white_course():
    from trainer.study_lessons.courses.italian import course as white_course

    before = white_course().model_dump(mode="json")
    black = course()
    black.game("mason-lasker").annotations[0].text = "Changed by one consumer"
    assert white_course().model_dump(mode="json") == before
    assert course().game("mason-lasker").annotations[0].text != "Changed by one consumer"
