"""The bad-trade cause follows the whole exchange on the square, not two captures."""

import chess
from trainer.move_causes import move_causes


def line(fen, *sans):
    boards = [chess.Board(fen)]
    for san in sans:
        board = boards[-1].copy()
        board.push_san(san)
        boards.append(board)
    return boards


def skills(boards):
    return {finding.skill_id for finding in move_causes(boards, "analysis")}


def test_a_recapture_that_wins_the_exchange_is_not_a_bad_trade():
    # 25...Rxc4 Qxc4 Bxc4: Black nets +5 on c4 (the line then loses the queen to Rxe7).
    fen = "2r3k1/1p2qpp1/1p1pb2p/pP3B2/2PP4/P1Q3P1/5P1P/4R1K1 b - - 1 25"
    assert "avoiding_bad_trades" not in skills(line(fen, "Rxc4", "Qxc4", "Bxc4", "Rxe7"))


def test_an_exchange_that_ends_down_material_is_a_bad_trade_with_the_net_amount():
    fen = "2r3k1/1p2qpp1/1p1p3p/pP3B2/2PP4/P1Q3P1/5P1P/4R1K1 b - - 1 25"
    (finding,) = [
        f
        for f in move_causes(line(fen, "Rxc4", "Qxc4", "Qe5"), "analysis")
        if f.skill_id == "avoiding_bad_trades"
    ]
    assert "gives up 4 material points" in finding.explanation
