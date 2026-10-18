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


def test_a_recapture_that_promotes_counts_the_new_piece():
    # Rxf1 gxf1=Q+: a knight for the rook and a new queen, ten points down.
    fen = "7k/8/8/8/8/7K/6p1/R4n2 w - - 0 1"
    (finding,) = [
        f
        for f in move_causes(line(fen, "Rxf1", "gxf1=Q+"), "analysis")
        if f.skill_id == "avoiding_bad_trades"
    ]
    assert "gives up 10 material points" in finding.explanation
    # Qxd8 Rxd8 exd8=Q+ nets seven points: no bad trade.
    fen = "3n1r1k/4P3/8/8/8/8/8/3Q2K1 w - - 0 1"
    assert "avoiding_bad_trades" not in skills(line(fen, "Qxd8", "Rxd8", "exd8=Q+"))
