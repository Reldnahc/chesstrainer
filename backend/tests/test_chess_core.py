import chess
import chess.engine
import pytest
from trainer.chess_core import (
    Candidate,
    Score,
    engine_context,
    evaluation_loss,
    legal_move,
    position_key,
    valid_board,
)
from trainer.policy import MovePolicy


def test_position_identity():
    board = chess.Board()
    clocks = chess.Board(board.fen().rsplit(" ", 2)[0] + " 49 80")
    assert position_key(board) == position_key(clocks)
    assert engine_context(board) != engine_context(clocks)
    no_castling = chess.Board(board.fen().replace("KQkq", "-"))
    assert position_key(board) != position_key(no_castling)
    board.push_uci("e2e4")
    assert position_key(board) == position_key(chess.Board(board.fen(en_passant="fen")))
    ep = chess.Board("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
    assert position_key(ep) != position_key(chess.Board(ep.fen().replace("d6", "-")))
    pinned_ep = chess.Board("k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
    assert position_key(pinned_ep) == position_key(chess.Board(pinned_ep.fen().replace("d6", "-")))


def test_history_not_lost_in_engine_key():
    board = chess.Board()
    for uci in ["g1f3", "g8f6", "f3g1", "f6g8"]:
        board.push_uci(uci)
    assert position_key(board) == position_key(chess.Board())
    assert engine_context(board) != engine_context(chess.Board(board.fen()))


@pytest.mark.parametrize("black", [False, True])
def test_legal_move_canonicalizes_castling_without_accepting_bogus_promotions(black):
    board = valid_board("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
    if black:
        board = board.mirror()
    rank = "8" if black else "1"
    before = board.fen()
    for target, canonical_target in (("g", "g"), ("h", "g"), ("c", "c"), ("a", "c")):
        uci = f"e{rank}{target}{rank}"
        assert legal_move(board, uci).uci() == f"e{rank}{canonical_target}{rank}"
        for promotion in "qrbnkp":
            with pytest.raises(ValueError, match="^Move is not legal in this position$"):
                legal_move(board, uci + promotion)
    assert board.fen() == before and board.move_stack == []


@pytest.mark.parametrize("black", [False, True])
def test_legal_move_preserves_all_real_promotions(black):
    board = valid_board("4k3/P7/8/8/8/8/8/4K3 w - - 0 1")
    if black:
        board = board.mirror()
    prefix = "a2a1" if black else "a7a8"
    for promotion in "qrbn":
        assert legal_move(board, prefix + promotion).uci() == prefix + promotion
    for promotion in "kp":
        with pytest.raises(ValueError, match="^Move is not legal in this position$"):
            legal_move(board, prefix + promotion)


def test_terminal_mate_zero_keeps_winner():
    lost = Score.from_engine(chess.engine.PovScore(chess.engine.Mate(0), chess.WHITE), chess.WHITE)
    won = Score.from_engine(chess.engine.PovScore(chess.engine.Mate(0), chess.WHITE), chess.BLACK)
    assert lost.outcome() == -1 and won.outcome() == 1
    assert lost.value == won.value == 0
    assert lost.negate() == won and won.negate() == lost


@pytest.mark.parametrize("color,expected", [(chess.WHITE, 125), (chess.BLACK, -125)])
def test_score_perspective(color, expected):
    score = chess.engine.PovScore(chess.engine.Cp(125), chess.WHITE)
    assert Score.from_engine(score, color) == Score(kind="cp", value=expected)


def test_mates_are_explicit():
    score = chess.engine.PovScore(chess.engine.Mate(3), chess.BLACK)
    assert Score.from_engine(score, chess.BLACK) == Score(kind="mate", value=3)
    assert Score.from_engine(score, chess.WHITE) == Score(kind="mate", value=-3)
    cp = Score(kind="cp", value=500)
    won = Score(kind="mate", value=3)
    lost = Score(kind="mate", value=0)
    assert evaluation_loss(won, cp).mate_lost
    assert evaluation_loss(cp, lost).allows_mate
    assert evaluation_loss(won, lost).cp is None
    assert not evaluation_loss(Score(kind="mate", value=-2), lost).allows_mate


def test_practical_accepts_sound_alternatives():
    best = Candidate(uci="g1f3", san="Nf3", score=Score(kind="cp", value=52), pv=["g1f3"])
    assert MovePolicy().grade(best, "d2d3", Score(kind="cp", value=38)) == "acceptable"
    assert MovePolicy(mode="best_only").grade(best, "d2d3", Score(kind="cp", value=38)) == "failure"
    assert MovePolicy().grade(best, "d1h5", Score(kind="cp", value=-180)) == "failure"
    assert MovePolicy().grade(best, "d2d3", Score(kind="mate", value=-3)) == "failure"
    assert not MovePolicy().meaningful(best.score, Score(kind="cp", value=38))
