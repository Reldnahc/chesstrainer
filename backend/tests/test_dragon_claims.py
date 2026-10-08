"""Pin the board facts behind the authored Sicilian Dragon explanations."""

import chess
from course_claims import Boards, attackers, attacks, count, minor, piece, sq
from trainer.study_lessons.courses import dragon_positions as p
from trainer.study_lessons.courses.dragon import course

board = Boards(course())


def test_course_loads_with_every_chapter_ending_in_a_rehearsal():
    built = course()
    assert built.learner_color == "black"
    assert [chapter.id for chapter in built.chapters] == [
        "dragon-setup",
        "dragon-yugoslav",
        "dragon-bg5",
        "dragon-second-moves",
        "dragon-third-moves",
    ]
    for chapter in built.chapters:
        assert chapter.steps[-1].kind == "rehearsal"
    assert all(line.repertoire for line in built.lines)


def test_setup_chapter_claims():
    pinned = board(p.OPEN + " Qxd4 Nc6 Bb5")
    assert pinned.is_pinned(chess.BLACK, sq("c6"))
    guarded = board(p.OPEN + " Qxd4 Nc6 Bb5 Bd7")
    assert attacks(guarded, "d7", "c6")
    recaptured = board(p.OPEN + " Qxd4 Nc6 Bb5 Bd7 Bxc6 Bxc6")
    assert attacks(recaptured, "c6", "e4")
    developed = board(p.OPEN + " Qxd4 Nc6 Bb5 Bd7 Bxc6 Bxc6 Nc3 Nf6")
    assert attackers(developed, chess.BLACK, "e4") == {"c6", "f6"}
    assert "c3" in attackers(developed, chess.WHITE, "e4")
    queen_end = board(p.QUEEN_RECAPTURE)
    assert attacks(queen_end, "g5", "f6")
    assert piece(queen_end, "e7") is None and piece(queen_end, "g7") == "p"
    assert count(queen_end, chess.BISHOP, chess.BLACK) == 2
    assert count(queen_end, chess.BISHOP, chess.WHITE) == 1

    c4 = board(p.QUIET_C4)
    assert attacks(c4, "c4", "f7")
    assert attackers(c4, chess.BLACK, "f7") == {"f8", "g8"}

    queenside = board(p.QUIET + " Be3 O-O Qd2")
    assert queenside.has_queenside_castling_rights(chess.WHITE)
    assert all(queenside.piece_at(sq(name)) is None for name in ("b1", "c1", "d1"))
    early = board(p.EARLY_E3)
    assert attacks(early, "d5", "e4")
    assert piece(early, "f6") == "n" and not attacks(early, "g7", "b2")
    assert chess.square_distance(sq("b2"), early.king(chess.WHITE)) == 1

    d2 = board(p.QUEEN_D2)
    assert attackers(d2, chess.BLACK, "e4") == {"d5", "f6"}
    assert attackers(d2, chess.WHITE, "e4") == {"c3"}

    recaptured = board(p.OPEN + " Nxd4")
    assert [piece(recaptured, name) for name in ("d6", "e7")] == ["p", "p"]
    assert piece(recaptured, "e4") == "P" and piece(recaptured, "d2") is None
    assert "c3" in attackers(board(p.CENTER), chess.WHITE, "e4")
    dragon = board(p.DRAGON)
    assert all(piece(dragon, name) == "p" for name in ("d6", "e7", "f7", "g6", "h7"))
    castled = board(p.QUIET + " O-O O-O Be3")
    assert attacks(castled, "e3", "d4")
    knight = board(p.CLASSICAL_KNIGHT)
    assert attackers(knight, chess.BLACK, "d4") == {"c6"}
    assert attackers(knight, chess.WHITE, "d4") == {"e3", "d1"}
    exchanged = board(p.CLASSICAL_KNIGHT + " Nxc6 bxc6 Qd2")
    assert attacks(exchanged, "c6", "d5")
    final = board(p.CLASSICAL)
    assert "c6" in attackers(final, chess.BLACK, "d5")
    assert attacks(final, "d5", "e4")
    assert not final.pieces(chess.PAWN, chess.BLACK) & chess.BB_FILE_B
    assert piece(final, "b2") == "P"
    pushed = board(p.CLASSICAL + " e5 Ng4", beyond=True)
    assert attacks(pushed, "g4", "e3") and attacks(pushed, "c8", "g4")


def test_yugoslav_chapter_claims():
    early_queen = board(p.YUGOSLAV_BISHOP + " Qd2")
    assert not early_queen.is_attacked_by(chess.WHITE, sq("g4"))
    retreat = board(p.YUGOSLAV_BISHOP + " Qd2 Ng4 Bf4")
    assert attackers(retreat, chess.WHITE, "d4") == {"d2"}
    assert attacks(retreat, "g7", "d4")
    assert attacks(board(p.YUGOSLAV_BISHOP + " Qd2 Ng4"), "g4", "e3")
    fork = board(p.YUGOSLAV_BISHOP + " Qd2 Ng4 Bf4 Bxd4 Qxd4 e5")
    assert attacks(fork, "e5", "d4") and attacks(fork, "e5", "f4")
    hit = board(p.YUGOSLAV_BISHOP + " Qd2 Ng4 Bf4 Bxd4 Qxd4 e5 Bxe5")
    assert attacks(hit, "e5", "h8") and piece(hit, "h8") == "r"
    assert board(p.YUGOSLAV_BISHOP + " Qd2 Ng4 Bf4 Bxd4 Qxd4 e5 Bxe5 dxe5 Qxd8+").is_check()
    traded = board(p.YUGOSLAV_QUEEN)
    assert minor(traded, chess.BLACK) == minor(traded, chess.WHITE) + 1
    assert count(traded, chess.PAWN, chess.WHITE) == count(traded, chess.PAWN, chess.BLACK) + 1
    assert not traded.pieces(chess.QUEEN, chess.WHITE) and not traded.pieces(
        chess.QUEEN, chess.BLACK
    )

    c4 = board(p.YUGOSLAV_CASTLED + " Bc4")
    assert attacks(c4, "c4", "f7")
    blocked = board(p.YUGOSLAV_CASTLED + " Bc4 Nc6 Qd2 Nxd4 Bxd4 Be6")
    assert not attacks(blocked, "c4", "f7")
    c4_end = board(p.YUGOSLAV_C4)
    assert attacks(c4_end, "e6", "d5") and attacks(c4_end, "e6", "f5")
    assert attacks(c4_end, "a5", "a2") and attacks(c4_end, "a5", "c3")
    assert c4_end.king(chess.WHITE) == sq("c1")

    exchange = board(p.YUGOSLAV_EXCHANGE)
    assert attacks(exchange, "e6", "d5") and attacks(exchange, "e6", "a2")

    queen_takes = board(p.GAMBIT_QUEEN[: -len(" Qc7")])
    assert (
        count(queen_takes, chess.PAWN, chess.WHITE)
        == count(queen_takes, chess.PAWN, chess.BLACK) + 1
    )
    assert attacks(queen_takes, "d5", "a8")
    offer = board(p.GAMBIT_QUEEN)
    assert attacks(offer, "c7", "c2") and attacks(offer, "g7", "b2")
    assert attacks(board(p.GAMBIT_QUEEN + " Qxa8 Bf5"), "f5", "c2")
    gambit = board(p.YUGOSLAV_GAMBIT)
    assert (
        count(gambit, chess.QUEEN, chess.BLACK) == 1
        and count(gambit, chess.QUEEN, chess.WHITE) == 0
    )
    assert (
        count(gambit, chess.ROOK, chess.WHITE) == 2 and count(gambit, chess.ROOK, chess.BLACK) == 0
    )
    assert count(gambit, chess.PAWN, chess.WHITE) == count(gambit, chess.PAWN, chess.BLACK) + 1
    assert (
        attacks(gambit, "g7", "b2") and attacks(gambit, "f5", "c2") and attacks(gambit, "c7", "c2")
    )
    assert piece(gambit, "f1") == "B" and {piece(gambit, "d1"), piece(gambit, "h1")} == {"R"}

    late = board(p.YUGOSLAV_RECAPTURE + " Nxc6")
    assert attacks(late, "d8", "d5")
    same = board(p.YUGOSLAV_RECAPTURE + " Nxc6 bxc6 Nxd5 cxd5 Qxd5")
    assert same.board_fen() == queen_takes.board_fen() and same.turn == queen_takes.turn

    supported = board(p.YUGOSLAV_CASTLED)
    assert attacks(supported, "f3", "g4") and attacks(supported, "f3", "e4")
    recapture = board(p.YUGOSLAV_RECAPTURE)
    assert attacks(recapture, "d5", "c3") and attacks(recapture, "d5", "e3")
    assert attacks(recapture, "g7", "d4")
    queen = board(p.YUGOSLAV_RECAPTURE + " Nxd5 Qxd5")
    assert attackers(queen, chess.BLACK, "d4") == {"c6", "d5", "g7"}
    facing = board(p.YUGOSLAV_RECAPTURE + " Nxd5 Qxd5 Nxc6")
    assert attacks(facing, "d2", "d5")
    final = board(p.YUGOSLAV)
    assert attacks(final, "c6", "c2") and attacks(final, "e6", "a2")
    material = {
        kind: count(final, kind, chess.WHITE) - count(final, kind, chess.BLACK)
        for kind in chess.PIECE_TYPES
    }
    assert material[chess.PAWN] == 0 and material[chess.QUEEN] == 0 and material[chess.ROOK] == 0
    assert minor(final, chess.WHITE) == minor(final, chess.BLACK)
    assert piece(final, "g2") == "P" and piece(final, "h2") == "P"


def test_bg5_chapter_claims():
    check = board(p.DRAGON + " Bb5+ Bd7 Bxd7+ Nbxd7")
    assert attacks(check, "f6", "e4")
    c4 = board(p.BG5 + " Bc4 O-O")
    assert attackers(c4, chess.BLACK, "f7") == {"f8", "g8"}
    for san in (p.BG5_C4, p.BG5_H4):
        retreated = board(san)
        assert attacks(retreated, "h4", "f6")
        assert {"e7", "g7"} <= attackers(retreated, chess.BLACK, "f6")
    traded = board(p.BG5_F6)
    assert (
        count(traded, chess.BISHOP, chess.BLACK) == 2
        and count(traded, chess.KNIGHT, chess.BLACK) == 1
    )
    assert (
        count(traded, chess.BISHOP, chess.WHITE) == 1
        and count(traded, chess.KNIGHT, chess.WHITE) == 2
    )
    assert {"c6", "f6"} <= attackers(traded, chess.BLACK, "d4")
    fork = board(p.BG5_F4)
    assert attacks(fork, "e5", "d4") and attacks(fork, "e5", "f4")

    defended = board(p.BG5)
    assert {"e7", "g7"} <= attackers(defended, chess.BLACK, "f6")
    assert attacks(board(p.BG5_ASK), "h6", "g5")
    retreat = board(p.BG5_ASK + " Be3")
    assert attacks(retreat, "h6", "g5") and piece(retreat, "f3") is None
    jump = board(p.BG5_ASK + " Be3 Ng4")
    assert attacks(jump, "g4", "e3")
    forked = board(p.BG5_ASK + " Be3 Ng4 Bf4 e5")
    assert attacks(forked, "e5", "d4") and attacks(forked, "e5", "f4")
    chased = board(p.BG5_ASK + " Be3 Ng4 Bf4 e5 h3")
    assert attacks(chased, "h3", "g4")
    taken = board(p.BG5_ASK + " Be3 Ng4 Bf4 e5 h3 exd4 hxg4")
    assert count(taken, chess.KNIGHT, chess.WHITE) == count(taken, chess.KNIGHT, chess.BLACK)
    assert attacks(taken, "d4", "c3")
    final = board(p.BG5_LINE)
    assert (
        count(final, chess.KNIGHT, chess.WHITE) == 0
        and count(final, chess.KNIGHT, chess.BLACK) == 1
    )
    for recapture in ("bxc3", "Qxc3"):
        after = board(p.BG5_LINE + " " + recapture, beyond=True)
        assert minor(after, chess.BLACK) == minor(after, chess.WHITE) + 1
        assert count(after, chess.PAWN, chess.WHITE) == count(after, chess.PAWN, chess.BLACK) + 1


def test_second_move_chapter_claims():
    dragon = board(p.DRAGON)
    closed = board(p.SECOND_KNIGHT)
    assert closed.board_fen() == dragon.board_fen() and closed.turn == dragon.turn

    alapin = board("e4 c5 c3")
    assert piece(alapin, "c3") == "P"
    exchanged = board("e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 cxd4")
    assert not exchanged.pieces(chess.PAWN, chess.WHITE) & chess.BB_FILE_C
    assert not exchanged.is_attacked_by(chess.WHITE, sq("d5"))
    final = board(p.ALAPIN)
    assert attacks(final, "c6", "d4") and attacks(final, "c6", "e5") and attacks(final, "d6", "e5")

    queen = board("e4 c5 d4 cxd4 Qxd4 Nc6")
    assert attacks(queen, "c6", "d4")
    assert piece(board(p.EARLY_QUEEN), "d7") == "p"

    morra = board(p.MORRA)
    assert count(morra, chess.PAWN, chess.BLACK) == count(morra, chess.PAWN, chess.WHITE) + 1
    assert not attacks(morra, "c4", "f7")

    blocked = board("e4 c5 Bc4 e6")
    assert not attacks(blocked, "c4", "f7")
    attack = board("e4 c5 Bc4 e6 Nf3 Nc6 O-O Nf6")
    assert attacks(attack, "f6", "e4")
    strike = board("e4 c5 Bc4 e6 Nf3 Nc6 O-O Nf6 d3 d5")
    assert attacks(strike, "d5", "c4") and attacks(strike, "d5", "e4")
    second = board(p.SECOND)
    assert attacks(second, "d5", "c4")
    assert (
        piece(second, "e7") is None and piece(second, "e6") is None and piece(second, "d7") is None
    )


def test_third_move_chapter_claims():
    moscow = board("e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Nxd7 O-O Ngf6")
    assert attacks(moscow, "f6", "e4")
    assert "e1" in attackers(
        board("e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Nxd7 O-O Ngf6 Re1"), chess.WHITE, "e4"
    )

    dragon = board(p.DRAGON)
    knight = board(p.THIRD_KNIGHT)
    assert knight.board_fen() == dragon.board_fen() and knight.turn == dragon.turn

    c3 = board("e4 c5 Nf3 d6 c3 Nf6 d4")
    assert piece(c3, "c3") == "P"
    assert not c3.is_attacked_by(chess.WHITE, sq("e4"))
    won = board(p.THIRD_C3)
    assert count(won, chess.PAWN, chess.BLACK) == count(won, chess.PAWN, chess.WHITE) + 1

    jump = board(p.THIRD_BISHOP + " Ng5")
    assert attackers(jump, chess.WHITE, "f7") == {"c4", "g5"}
    assert attackers(jump, chess.BLACK, "f7") == {"e8"}
    assert not attacks(board(p.THIRD_BISHOP + " Ng5 e6"), "c4", "f7")
    strike = board(p.THIRD_JUMP)
    assert attacks(strike, "d5", "c4") and attacks(strike, "d5", "e4")
    assert not attacks(board(p.THIRD_C4_KNIGHT), "c4", "f7")

    defended = board(p.THIRD_BISHOP + " d3 Nc6 O-O g6 Bg5 Bg7")
    assert {"e7", "g7"} <= attackers(defended, chess.BLACK, "f6")
    final = board(p.THIRD)
    assert final.king(chess.BLACK) == sq("g8") and piece(final, "g7") == "b"
    assert piece(final, "d3") == "P" and piece(final, "e4") == "P"
    assert piece(final, "d6") == "p" and piece(final, "e7") == "p"


def test_review_corrections_hold_on_the_board():
    # The c6-knight prepares d5 but does not guard it.
    assert not attacks(board(p.YUGOSLAV_KNIGHT), "c6", "d5")
    # Against 10.Qa4+ in the Qd2 side trip, Bd7 blocks and attacks the queen.
    check = board(p.YUGOSLAV_BISHOP + " Qd2 Ng4 Bf4 Bxd4 Qxd4 e5 Qa4+", beyond=True)
    assert check.is_check()
    blocked = board(p.YUGOSLAV_BISHOP + " Qd2 Ng4 Bf4 Bxd4 Qxd4 e5 Qa4+ Bd7", beyond=True)
    assert attacks(blocked, "d7", "a4") and piece(blocked, "a4") == "Q"
    # After Bf5 in the rook offer, Qxc2 would be checkmate.
    threat = board(p.GAMBIT_QUEEN + " Qxa8 Bf5")
    threat.push(chess.Move.null())
    threat.push_san("Qxc2")
    assert threat.is_checkmate()
    # White's knights stand on the g7-bishop's long diagonal.
    early = board(p.EARLY_E3)
    assert [piece(early, name) for name in ("f6", "d4", "c3")] == ["n", "N", "N"]
    # The other long diagonal runs from a8 to h1 through c6 and e4.
    assert sq("c6") in chess.SquareSet.ray(sq("a8"), sq("h1"))
    # Bg5 chapter: same rank, the knight's escape and the c3-pawn's attack.
    retreat = board(p.BG5_ASK + " Bf4")
    assert chess.square_rank(sq("f4")) == chess.square_rank(sq("d4")) == 3
    escape = board(p.BG5_F4 + " Ndb5", beyond=True)
    assert attacks(escape, "b5", "d6") and piece(escape, "d6") == "p"
    final = board(p.BG5_LINE)
    assert attacks(final, "c3", "d2") and piece(final, "d2") == "Q"
    assert piece(retreat, "d4") == "N"
    # Second moves: Re1+ is a check that Be7 blocks.
    rook = board(p.SECOND + " Re1+", beyond=True)
    assert rook.is_check()
    rook.push_san("Be7")
    assert not rook.is_check()
    # Third moves: after Ng5, Nxe4 loses to Bxf7+.
    trap = board(p.THIRD_BISHOP + " Ng5 Nxe4 Bxf7+", beyond=True)
    assert trap.is_check()
    assert attacks(board(p.THIRD_BISHOP + " Ng5 Nxe4", beyond=True), "g5", "e4")


def test_second_review_corrections_hold_on_the_board():
    # The Yugoslav main line ends with no Black knights left.
    assert count(board(p.YUGOSLAV), chess.KNIGHT, chess.BLACK) == 0
    # After Bf5 the f8-rook attacks the a8-queen, and after Qxf8+ Kxf8 Qxc2 is still mate.
    offer = board(p.GAMBIT_QUEEN + " Qxa8 Bf5")
    assert attacks(offer, "f8", "a8") and piece(offer, "a8") == "Q"
    still = board(p.YUGOSLAV_GAMBIT)
    still.push(chess.Move.null())
    still.push_san("Qxc2")
    assert still.is_checkmate()
    # After 9.Ndb5 exf4 10.Nxd6+, White has taken two pawns for the piece.
    two = board(p.BG5_F4 + " Ndb5 exf4 Nxd6+ Kf8 O-O-O Ne8 Qxf4 Nxd6 Rxd6", beyond=True)
    assert minor(two, chess.BLACK) == minor(two, chess.WHITE) + 1
    assert count(two, chess.PAWN, chess.WHITE) == count(two, chess.PAWN, chess.BLACK) + 2


def test_third_review_corrections_hold_on_the_board():
    # 12.Qxc3?? walks into Bxc3+ along the opened long diagonal.
    queen = board(p.BG5_LINE + " Qxc3", beyond=True)
    assert attacks(queen, "g7", "c3") and piece(queen, "c3") == "Q"
    queen.push_san("Bxc3+")
    assert queen.is_check()
    # After 10.Nxd6+ the knight on d6 is guarded by White's queen on d2.
    check = board(p.BG5_F4 + " Ndb5 exf4 Nxd6+", beyond=True)
    assert check.is_check() and attacks(check, "d2", "d6")
    assert check.is_legal(check.parse_san("Kf8"))


def test_fourth_review_corrections_hold_on_the_board():
    # The f2-pawn already guards e3, and the e2-bishop controls g4.
    setup = board(p.QUIET + " Be3 O-O Qd2")
    assert "f2" in attackers(setup, chess.WHITE, "e3")
    assert attacks(setup, "e2", "g4")
    # After 9.Ndb5 the e5-pawn can take the f4-bishop.
    escape = board(p.BG5_F4 + " Ndb5", beyond=True)
    assert attacks(escape, "e5", "f4") and piece(escape, "f4") == "B"
    # 12.Qxd6 can be met by Qxd6.
    raid = board(p.BG5_LINE + " Qxd6", beyond=True)
    assert attacks(raid, "d8", "d6") and piece(raid, "d6") == "Q"


def test_fifth_review_corrections_hold_on_the_board():
    # Against 9.Be3 the e5-pawn takes the d4-knight.
    retreat = board(p.BG5_F4 + " Be3", beyond=True)
    assert attacks(retreat, "e5", "d4") and piece(retreat, "d4") == "N"
    # After 9.Bb5+ Bd7 10.Bxd7+, the queen can take back.
    exchange = board(p.BG5_F4 + " Bb5+ Bd7 Bxd7+", beyond=True)
    assert exchange.is_legal(exchange.parse_san("Qxd7"))


def test_sixth_review_corrections_hold_on_the_board():
    # 9.Bg3 still leaves the d4-knight to the e5-pawn.
    assert attacks(board(p.BG5_F4 + " Bg3", beyond=True), "e5", "d4")
    # 9.Bxh6 Bxh6 10.Qxh6: the h8-rook takes the queen.
    trap = board(p.BG5_F4 + " Bxh6 Bxh6 Qxh6", beyond=True)
    assert attacks(trap, "h8", "h6") and piece(trap, "h6") == "Q"
    # After 10.Nxd6+, Ke7 is legal but the course steers the king to f8.
    check = board(p.BG5_F4 + " Ndb5 exf4 Nxd6+", beyond=True)
    assert check.is_legal(check.parse_san("Ke7")) and check.is_legal(check.parse_san("Kf8"))
