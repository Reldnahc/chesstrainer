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


def test_a_pin_the_combination_creates_is_credited_to_it():
    # ...Qxg2+ drags the rook onto the long diagonal, where the b7 bishop pins it
    # to the king; ...Re1+ and ...Rxf1# follow (Lichess 04ccX).
    boards = line(
        "6k1/pb3p2/6pQ/3q4/8/3Br3/PPP3PP/6RK b - - 2 29", "Qxg2+", "Rxg2", "Re1+", "Bf1", "Rxf1#"
    )
    assert "pin" in {skill for skill, _ in recognized(boards)}


def test_an_existing_pin_the_line_exploits_is_credited():
    # The queen on f7 already pins the d7 bishop to the king on c7; the line goes
    # on to take it with Bxd7 (Lichess 1mukg).
    boards = line(
        "3r3r/2kb1Q1p/p1nb1p2/4p3/4P1B1/8/PpP2PPP/1K1R4 w - - 4 21",
        "Rxd6",
        "Kxd6",
        "Bxd7",
        "Rxd7",
        "Qxf6+",
        "Kc7",
        "Qxh8",
    )
    assert "pin" in {skill for skill, _ in recognized(boards)}


def test_an_existing_pin_that_stops_the_answer_to_mate_is_credited():
    # The queen on f8 pins the e8 rook, which could otherwise take on e7 (Lichess SU9uA).
    boards = line("r1bkrQ2/ppqn2pp/4P3/n7/2B5/5N2/PP3PPP/2KR3R w - - 2 19", "e7#")
    assert "pin" in {skill for skill, _ in recognized(boards)}


def test_a_new_pin_along_another_line_is_the_lines_own():
    # Be6 pins f7 at the start; after Kg7 that pin is gone and Qxc7 pins f7 along
    # the seventh rank, so fxe6 is impossible (Lichess 4GRBz).
    boards = line(
        "6k1/2rr1p1p/4BQp1/1q6/p7/2R4P/P4PP1/6K1 w - - 0 1", "Rxc7", "Rxc7", "Qd8+", "Kg7", "Qxc7"
    )
    assert "pin" in {skill for skill, _ in recognized(boards)}


def test_moving_the_pinner_along_its_line_does_not_exploit_an_old_pin():
    # Finding 13's position: Ba4 only slides the pinning bishop back.
    boards = line("4k3/ppp1ppp1/2n5/1B2R2r/8/8/PPP2PP1/4K2Q w - - 0 1", "Qxh5", "a6", "Ba4", "b6")
    assert "pin" not in {skill for skill, _ in recognized(boards)}


def test_a_pinned_piece_cannot_answer_a_double_check():
    # Bg6+ is double check: only a king move answers, so the pinned d7 knight's
    # interposition square is irrelevant and its old pin is not exploited.
    boards = line("4k3/3n4/5R2/1B6/4B3/8/8/4R1K1 w - - 0 1", "Bg6+", "Kd8")
    assert "pin" not in {skill for skill, _ in recognized(boards)}


def test_an_old_pin_beside_a_mating_attack_it_does_not_change_is_declined():
    # The g3 rook pins the g6 pawn, which attacks the h5 rook; but after the checks
    # Black must answer them, so Qh6+ Kg8 Qh7# mates with or without the pin
    # (Lichess Y7ACL).
    boards = line("2r2r2/2p2pk1/p3pqp1/1p5R/1P1P4/P5RP/3Q1P2/6K1 w - - 1 28", "Qh6+", "Kg8", "Qh7#")
    assert "pin" not in {skill for skill, _ in recognized(boards)}


def test_an_old_pin_that_keeps_a_recapturing_guard_alive_is_credited():
    # Rg1 pins the g6 pawn, which cannot take the h5 knight; after Qxf6 exf6 that
    # knight retakes with check and forks (Lichess icvcT).
    boards = line(
        "2r3k1/pp1qpp1p/5np1/4Q2N/8/2P2P2/PP5P/2K3R1 w - - 0 1",
        "Qxf6",
        "exf6",
        "Nxf6+",
        "Kg7",
        "Nxd7",
    )
    assert "pin" in {skill for skill, _ in recognized(boards)}


def test_a_pinner_leaving_the_line_while_a_rear_piece_keeps_the_pin_uses_it():
    # Rg5-h5 leaves the g-file, but the g1 rook keeps the g6 pawn pinned, so the
    # pawn cannot take on h5, where the rook attacks the queen (Lichess b05S8).
    boards = line(
        "r4r2/2p2pkp/2npbNp1/6R1/1PP4q/pP6/P2Q1P1P/2K3R1 w - - 0 1", "Rh5", "Kxf6", "Rxh4"
    )
    assert "pin" in {skill for skill, _ in recognized(boards)}


def test_a_guarded_landing_a_cheaper_piece_can_take_is_not_a_pin_exploit():
    # Qg5 just loses the queen to ...hxg5; nothing retakes, guard or not.
    boards = line("4k3/4p3/2n4p/1B2R3/8/8/8/K5Q1 w - - 0 1", "Qg5")
    assert "pin" not in {skill for skill, _ in recognized(boards)}


def test_sliding_the_pinner_along_its_line_does_not_make_a_new_pin():
    boards = line("4k3/ppp1ppp1/2n5/1B2R2r/8/8/PPP2PP1/4K2Q w - - 0 1", "Ba4", "a6")
    found = recognized_patterns(boards, 1, len(boards) - 1, "line", "missed_opportunity")
    assert "pin" not in {f.skill_id for f in found}


def test_a_replacement_pin_witness_names_what_the_pinned_piece_cannot_take():
    # Upstream's first pin is the old Bb5 pin of c6, which the line never uses;
    # Re1 creates a new pin of e7, which then cannot capture on d5.
    from trainer.lichess_patterns import recognize

    boards = line("4k3/4n3/2r5/1B1P4/5N2/8/8/R6K w - - 0 1", "Re1", "Kd8")
    pins = [w for w in recognize(boards, 1, len(boards) - 1, "line").witnesses if w.theme == "pin"]
    assert pins and all(w.rule == "pin_prevents_attack" for w in pins)
    assert pins[0].roles["pinned_defender"] == ["e7"] and "cannot capture" in pins[0].explanation


def test_a_retake_after_losing_the_queen_is_not_a_pin_exploit():
    # Qg5 hxg5 Rxg5 gives the queen for a pawn; the guard's retake is no idea.
    boards = line("4k3/4p3/2n4p/1B2R3/8/8/8/K5Q1 w - - 0 1", "Qg5", "hxg5", "Rxg5")
    assert "pin" not in {skill for skill, _ in recognized(boards)}
