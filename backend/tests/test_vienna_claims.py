"""Pin the board facts behind the authored Vienna Gambit explanations."""

import chess
from course_claims import Boards, attackers, attacks, count, minor, pawn_balance, piece, pins_to, sq
from trainer.study_lessons.courses import vienna_positions as p
from trainer.study_lessons.courses.vienna import course

board = Boards(course())


def test_course_loads_with_every_chapter_ending_in_a_rehearsal():
    built = course()
    assert built.learner_color == "white"
    assert [chapter.id for chapter in built.chapters] == [
        "vienna-accepted",
        "vienna-strike",
        "vienna-declined",
        "vienna-second-moves",
    ]
    for chapter in built.chapters:
        assert chapter.steps[-1].kind == "rehearsal"
    assert all(line.repertoire for line in built.lines)


def test_accepted_chapter_claims():
    gambit = board("e4 e5 Nc3 Nf6 f4")
    assert attacks(gambit, "f4", "e5") and piece(gambit, "f2") is None
    assert attacks(board(p.PUSHED), "e5", "f6")
    assert attacks(board(p.RETREAT), "f3", "h4")
    center = board(p.CENTER)
    assert attacks(center, "d4", "e5") and attacks(center, "c1", "f4")
    recapture = board(p.CENTER + " dxe5 dxe5", beyond=True)
    recapture.push_san("Qxd1+")
    assert recapture.is_check() and piece(recapture, "d1") == "q"
    blocked = board(p.CHECK + " c6")
    assert attacks(blocked, "c6", "b5")
    aimed = board(p.CHECK + " c6 Bc4")
    assert attacks(aimed, "c4", "f7")
    assert attacks(board(p.CHECK + " c6 Bc4 exd4"), "d4", "c3")
    assert board(p.SACRIFICE).is_check()
    assert board(p.SACRIFICE + " Ke7 Qe2+").is_check()
    assert board(p.HUNT).is_check()
    assert board(p.HUNT + " Kf6 Bg5+").is_check()
    fork = board(p.FORK)
    assert fork.is_check()
    assert attacks(fork, "f7", "d8") and piece(fork, "d8") == "q"
    assert attacks(fork, "f7", "h8") and piece(fork, "h8") == "r"
    assert not fork.is_attacked_by(chess.BLACK, sq("f7"))
    assert fork.legal_moves.count() > 0 and not fork.is_checkmate()
    for reply in fork.legal_moves:
        assert fork.piece_at(reply.from_square).piece_type == chess.KING
        after = fork.copy()
        after.push(reply)
        assert attacks(after, "f7", "d8") and attacks(after, "f7", "h8")
    assert minor(fork, chess.WHITE) == 1

    queen = board(p.PUSHED + " Qe7")
    assert attacks(queen, "e7", "e5") and queen.is_pinned(chess.WHITE, sq("e5"))
    guarded = board(p.PUSHED + " Qe7 Qe2")
    assert attacks(guarded, "e2", "e5") and not guarded.is_pinned(chess.WHITE, sq("e5"))
    jump = board(p.PUSHED + " Qe7 Qe2 Ng8 d4 d6 Nd5")
    assert attacks(jump, "d5", "e7") and attacks(jump, "d5", "c7")
    assert board(p.PUSHED + " Qe7 Qe2 Ng8 d4 d6 Nd5 Qd7 exd6+").is_check()
    final = board(p.QUEEN)
    assert final.is_check() and attacks(final, "c7", "b8")
    assert attacks(final, "d5", "c7")
    assert final.king(chess.BLACK) == sq("d8") and piece(final, "c7") == "P"
    assert not final.is_legal(chess.Move(sq("d8"), sq("c7")))

    pinned = board(p.RETREAT + " Nc6 d4 d6 Bb5")
    assert pinned.is_pinned(chess.BLACK, sq("c6"))
    knight = board(p.KNIGHT)
    assert attackers(knight, chess.WHITE, "e5") == {"d4", "e2", "f3", "f4"}
    assert pawn_balance(knight) == -1
    assert piece(knight, "g8") == "n" and piece(knight, "f8") == "b"

    pin = board(p.CENTER + " Bg4")
    assert pins_to(pin, "g4", "f3", "d1") and piece(pin, "d1") == "Q"
    assert attacks(board(p.CENTER + " Bg4 Bxf4"), "f4", "e5")
    assert attacks(board(p.CENTER + " Bg4 Bxf4 dxe5 Bxe5 Nc6"), "c6", "e5")
    pin_end = board(p.PIN)
    assert pin_end.is_pinned(chess.BLACK, sq("c6"))
    assert pawn_balance(pin_end) == 0

    block = board(p.CHECK + " Bd7 Qe2")
    assert attacks(block, "e2", "e5") and attacks(block, "e2", "b5")
    assert attacks(board(p.BLOCK), "b5", "c7")

    takes = board(p.SACRIFICE + " Kxf7")
    assert attacks(takes, "d1", "d8")
    assert count(board(p.KING_TAKES), chess.QUEEN, chess.BLACK) == 0
    back = board(p.HUNT + " Ke8 Nxc6+")
    assert back.is_check() and attackers(back, chess.WHITE, "e8") == {"e2"}
    assert attacks(back, "c6", "d8")
    assert count(board(p.KING_BACK), chess.QUEEN, chess.BLACK) == 0


def test_strike_chapter_claims():
    taken = board("e4 e5 Nc3 Nf6 f4 d5 fxe5")
    assert attacks(taken, "e5", "f6")
    assert attacks(board(p.STRIKE), "f3", "e5")
    trade = board(p.TRADE)
    assert not trade.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_B
    assert pins_to(board(p.TRADE + " Bg4"), "g4", "f3", "d1")
    center = board(p.STRIKE_CENTER + " Nc6")
    assert all(piece(center, name) == "P" for name in ("c3", "d4", "e5"))
    assert attacks(center, "c6", "d4") and attacks(center, "c6", "e5")
    castled = board(p.STRIKE_CASTLED)
    assert piece(castled, "f1") == "R"
    assert not castled.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_F
    assert attacks(board(p.STRIKE_LINE), "h3", "g4")

    queen = board(p.STRIKE + " Bg4 Qe2")
    assert attacks(queen, "e2", "e4")
    assert attacks(board(p.STRIKE_PIN), "f4", "e5")
    pin_end = board(p.STRIKE_PIN)
    assert all(pin_end.piece_at(sq(name)) is None for name in ("b1", "c1", "d1"))
    bishop = board(p.STRIKE + " Bc5 d4")
    assert attacks(bishop, "d4", "c5")
    assert board(p.STRIKE + " Bc5 d4 Bb4").is_pinned(chess.WHITE, sq("c3"))
    bishop_end = board(p.STRIKE_BISHOP)
    assert attacks(bishop_end, "d2", "c3")
    assert all(bishop_end.piece_at(sq(name)) is None for name in ("b1", "c1", "d1"))
    knight = board(p.STRIKE_KNIGHT + " O-O")
    main = board(p.STRIKE_CASTLED + " O-O")
    assert knight.board_fen() == main.board_fen() and knight.turn == main.turn


def test_declined_chapter_claims():
    defended = board(p.DEFENDED)
    assert attacks(defended, "e5", "f6")
    assert all(piece(defended, name) == "P" for name in ("d4", "e5"))
    assert attacks(board("e4 e5 Nc3 Nf6 f4 Nc6 fxe5 Nxe5 d4"), "d4", "e5")

    solid = board(p.SOLID)
    assert attackers(solid, chess.WHITE, "e5") == {"f3", "f4"}
    assert attackers(board(p.SOLID + " Nc6 d4"), chess.WHITE, "e5") == {"d4", "f3", "f4"}
    line = board(p.SOLID_LINE)
    assert attacks(line, "e3", "d4") and piece(line, "d1") == "R" and piece(line, "d4") == "Q"
    assert line.king(chess.WHITE) == sq("c1") and line.king(chess.BLACK) == sq("g8")
    assert piece(line, "e4") == "P" and piece(line, "f4") == "P"
    assert not line.pieces(chess.KNIGHT, chess.BLACK) & chess.BB_FILE_C

    solid_pin = board(p.SOLID_PIN)
    assert solid_pin.is_pinned(chess.BLACK, sq("c6"))
    assert count(solid_pin, chess.BISHOP, chess.WHITE) == 2
    assert count(solid_pin, chess.BISHOP, chess.BLACK) == 1
    take = board(p.SOLID_TAKE)
    assert pawn_balance(take) == 0
    assert piece(take, "d4") == "P" and piece(take, "e4") == "P"


def test_second_move_chapter_claims():
    pinned = board("e4 e5 Nc3 Bc5 Nf3 d6 d4 exd4 Nxd4 Nf6 Bg5")
    assert pins_to(pinned, "g5", "f6", "d8") and piece(pinned, "d8") == "q"
    held = board("e4 e5 Nc3 Bc5 Nf3 d6 d4 exd4 Nxd4 Nf6 Bg5 h6 Bh4")
    assert pins_to(held, "h4", "f6", "d8")
    bishop = board(p.BISHOP_FIRST)
    assert piece(bishop, "g5") == "p" and piece(bishop, "h6") == "p"

    aimed = board("e4 e5 Nc3 Nc6 Bc4")
    assert attacks(aimed, "c4", "f7")
    defended = board(p.KNIGHTS)
    assert attacks(defended, "d3", "e4") and attacks(defended, "c1", "g5")
    assert attacks(board(p.KNIGHTS + " Bb4"), "b4", "c3")
    pin_end = board(p.KNIGHTS_PIN)
    assert count(pin_end, chess.BISHOP, chess.WHITE) == 2
    assert count(pin_end, chess.BISHOP, chess.BLACK) == 1
    early = board(p.KNIGHTS_EARLY)
    assert early.king(chess.WHITE) == sq("g1") and early.king(chess.BLACK) == sq("g8")
    line = board(p.KNIGHTS_LINE)
    assert attacks(line, "h3", "g4")
    assert pins_to(board(p.KNIGHTS_LINE[: -len(" h3")]), "g4", "f3", "d1")


def test_review_corrections_hold_on_the_board():
    # After Qe2 the f3-knight is still pinned, now to the queen on e2.
    queen = board(p.STRIKE + " Bg4 Qe2")
    assert pins_to(queen, "g4", "f3", "e2") and attacks(queen, "e2", "f3")
    # After Qxd2 the c3-knight is pinned to the queen and defended by it.
    bishop = board(p.STRIKE_BISHOP)
    assert pins_to(bishop, "b4", "c3", "d2") and attacks(bishop, "d2", "c3")
    # Black's f7-pawn is still on the f-file; White has no f-pawn.
    castled = board(p.STRIKE_KNIGHT)
    assert piece(castled, "f7") == "p" and piece(castled, "f1") == "R"
    # The c1-bishop has not developed in the 2...Nc6 main line.
    assert piece(board(p.KNIGHTS_LINE), "c1") == "B"
    # Qh4+ is still legal after Nf3, and the knight takes the queen.
    check = board(p.RETREAT + " Qh4+", beyond=True)
    assert check.is_check() and attacks(check, "f3", "h4")
    # After 9...dxc3, Black's queen attacks White's queen on d1.
    hit = board(p.CHECK + " c6 Bc4 exd4 Bxf4 dxc3")
    assert attacks(hit, "d8", "d1") and piece(hit, "d1") == "Q"
    # In the Bd7 side trip the real threat is Qxe5+, and c7 is guarded by the queen.
    block = board(p.BLOCK)
    assert attacks(block, "e2", "e5") and piece(block, "e5") == "p"
    assert "d8" in attackers(block, chess.BLACK, "c7")
    taken = board(p.BLOCK + " Bd6 Qxe5+", beyond=True)
    assert taken.is_check()
    # The f6-knight is safe after Qe7 because the e5-pawn is pinned.
    pinned = board(p.PUSHED + " Qe7")
    assert not pinned.is_legal(chess.Move(sq("e5"), sq("f6")))
    # After 10...Bh5 in the d5 main line, Bxh7+ is a check.
    greek = board(p.STRIKE_LINE + " Bh5 Bxh7+", beyond=True)
    assert greek.is_check()
    # In the 3...Nc6 side trip, Nf6 is legal but the e5-pawn would take it.
    defended = board(p.DEFENDED)
    assert defended.is_legal(defended.parse_san("Nf6")) and attacks(defended, "e5", "f6")
    # Black attacks the g5-bishop with h6.
    asked = board(p.VIENNA + " Bc5 Nf3 d6 d4 exd4 Nxd4 Nf6 Bg5 h6")
    assert attacks(asked, "h6", "g5") and piece(asked, "g5") == "B"
    # Named pieces behind the attacks in the lessons.
    jump = board(p.PUSHED + " Qe7 Qe2 Ng8 d4 d6 Nd5")
    assert piece(jump, "e7") == "q" and piece(jump, "c7") == "p"
    assert piece(board(p.STRIKE_LINE), "g4") == "b"


def test_second_review_corrections_hold_on_the_board():
    # After 7.dxe5 Qxd1+, the c3-knight can take back and White keeps castling rights.
    trade = board(p.CENTER + " dxe5 dxe5 Qxd1+ Nxd1", beyond=True)
    assert trade.has_kingside_castling_rights(chess.WHITE)
    # Material is level only once Black takes the knight on e7.
    after = board(p.KING_BACK + " Bxe7", beyond=True)
    values = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
    total = {
        color: sum(v * count(after, kind, color) for kind, v in values.items())
        for color in chess.COLORS
    }
    assert abs(total[chess.WHITE] - total[chess.BLACK]) <= 1
