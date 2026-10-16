"""Tactic witnesses credit only what the move actually does (chess truthfulness audit)."""

import chess
from trainer.tactical_patterns import detect_patterns, recognized_patterns


def line(fen, *sans):
    boards = [chess.Board(fen)]
    for san in sans:
        board = boards[-1].copy()
        board.push_san(san)
        boards.append(board)
    return boards


def recognized(boards):
    found = recognized_patterns(boards, 1, len(boards) - 1, "line", "missed_opportunity")
    return {(f.skill_id, f.mechanism) for f in found}


def detected(boards):
    found = detect_patterns(
        boards,
        1,
        len(boards) - 1,
        "line",
        "missed_opportunity",
        material_supported=True,
        mate_supported=True,
    )
    return {(f.skill_id, f.mechanism) for f in found}


def test_a_pin_that_already_existed_is_not_credited_to_an_unrelated_capture():
    # Bb5 already pins the c6 knight; Qxh5 just takes a hanging rook (finding 13).
    boards = line("4k3/ppp1ppp1/2n5/1B2R2r/8/8/PPP2PP1/4K2Q w - - 0 1", "Qxh5", "a6")
    assert not {skill for skill, _ in recognized(boards)} & {"pin"}


def test_castling_with_check_is_not_a_discovered_check():
    # Lasker-Thomas: the castling rook gives the check itself (finding 27).
    boards = line("rn3r2/pbppq1p1/1p2pN2/8/3P2NP/6P1/PPP1BP1R/R3K1k1 w Q - 5 18", "O-O-O#")
    assert ("discovered_attack", "discovered_check") not in recognized(boards)
    assert ("discovered_attack", "discovered_check") not in detected(boards)


def test_defenders_are_judged_pinned_after_the_capture():
    # Qxf6 captures the pinner itself, releasing the pin: gxf6 recaptures (finding 12).
    boards = line("r5k1/1ppq2p1/1b2PrQB/1N6/8/8/5PPP/5RK1 w - - 1 30", "Qxf6", "gxf6", "exd7")
    assert ("pin", "pin_defenders_no_recapture") not in detected(boards)
    # A defender pinned by another piece still cannot recapture.
    boards = line("4k3/8/2n5/1B2b3/8/8/8/4R1K1 w - - 0 1", "Rxe5+")
    assert ("pin", "pin_defenders_no_recapture") in detected(boards)


def test_an_opponent_back_rank_mate_on_the_movers_line_is_not_an_error():
    # Both moves lose to mate; upstream sees the opponent's mate (finding 14).
    boards = line("8/4R2p/8/8/8/2NN4/p4PPP/k5K1 b - - 0 1", "h6", "Re1#")
    assert recognized(boards) == set()


def test_a_pinner_sliding_along_an_existing_pin_makes_no_new_pin():
    # Bb5 already pins the c6 knight to its king; Ba4 keeps that pin and later
    # collects the knight, which uses the pin rather than making one.
    boards = line("4k3/ppp2ppp/2n5/1B6/8/8/PPPP1PPP/4K3 w - - 0 1", "Ba4", "h6", "Bxc6+")
    assert ("pin", "pin_collected") not in detected(boards)
    # From f1 the same bishop move makes the pin itself.
    boards = line("4k3/ppp2ppp/2n5/8/8/8/PPPP1PPP/4KB2 w - - 0 1", "Bb5", "h6", "Bxc6+")
    assert ("pin", "pin_collected") in detected(boards)


def test_a_pin_already_on_the_board_is_marked_as_existing():
    from trainer.review_intelligence.event_facts import pinned_before

    # The c6 knight is pinned by Bb5 before 1.h3; a line that wins with Nxd4
    # uses that pin, it does not create one.
    existing = "4k3/5ppp/2n5/1B6/3q4/5N2/5PPP/6K1 w - - 0 1"
    assert pinned_before(existing, {"pinned_defender": ["c6"]}) is True
    # Here Bb5 itself makes the pin.
    created = "4k3/p7/2n5/3P4/8/8/P7/4KB2 w - - 0 1"
    assert pinned_before(created, {"pinned_defender": ["c6"]}) is False
    assert pinned_before(created, {}) is False


def test_a_capture_with_check_does_not_make_a_defended_piece_undefended():
    # Nxc6+ uncovers check; b7 still defends c6, though bxc6 must wait.
    boards = line("4k3/1p6/2r5/4N3/8/8/8/4R1K1 w - - 0 1", "Nxc6+", "Kd7")
    assert ("missed_tactical_capture", "undefended_capture_gain") not in detected(boards)
    # A defender behind the capturing piece (an x-ray) still defends.
    boards = line("b5k1/8/8/8/R7/7P/3Q2K1/r7 w - - 0 1", "Rxa8+", "Rxa8")
    assert ("missed_tactical_capture", "undefended_capture_gain") not in detected(boards)


def test_a_poisoned_capture_followed_by_mate_is_not_a_hanging_piece():
    # Opera game: 16.Qb8+ Nxb8 17.Rd8#. The queen is undefended, but taking it is mated.
    board = chess.Board()
    for san in (
        "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 "
        "Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+"
    ).split():
        board.push_san(san)
    boards = [board.copy()]
    for san in ("Nxb8", "Rd8#"):
        after = boards[-1].copy()
        after.push_san(san)
        boards.append(after)
    assert not {skill for skill, _ in recognized(boards) | detected(boards)} & {
        "missed_tactical_capture",
        "hanging_piece",
    }
    # Without the mate the same capture still counts.
    assert ("missed_tactical_capture", "undefended_capture_gain") in detected(boards[:2])
