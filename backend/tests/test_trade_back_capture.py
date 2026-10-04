import chess

from trainer.verified_patterns import detect_patterns


def line(fen, previous, moves):
    """Boards from the reviewed move onward, keeping the game's previous move."""
    board = chess.Board(fen)
    board.push_uci(previous)
    boards = [board]
    for uci in moves:
        following = boards[-1].copy(stack=True)
        following.push_uci(uci)
        boards.append(following)
    return boards


def captures(boards):
    found = detect_patterns(
        boards,
        1,
        len(boards) - 1,
        "analysis",
        "missed_opportunity",
        material_supported=True,
        mate_supported=False,
    )
    return [f for f in found if f.skill_id == "missed_tactical_capture"]


def test_taking_back_a_piece_that_just_captured_is_a_trade_not_a_loose_piece():
    # 11. Nxg6 fxg6: the knight took the bishop, so fxg6 completes the trade.
    boards = line(
        "r2q1rk1/ppp2ppp/2n2nb1/2p1p3/N3P1PN/3P3P/PPP2P2/R2QKB1R w KQ - 5 11",
        "h4g6",
        ["f7g6", "a4c5", "d8e7", "c5b3", "a7a5", "a2a4"],
    )
    assert captures(boards) == []


def test_capturing_a_piece_that_moved_to_an_undefended_square_is_still_loose():
    # 20. Nf8 Rxf8: the knight stepped onto f8 without capturing anything.
    boards = line(
        "r3r1k1/ppp3pp/4Nnp1/4p3/2P1P1P1/3P1P1P/P7/1q1BK2R w K - 4 20",
        "e6f8",
        ["e8f8", "e1g1", "b1d3", "d1b3", "a8e8", "c4c5"],
    )
    assert [f.moves for f in captures(boards)] == [["e8f8"]]
