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
