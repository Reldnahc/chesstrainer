import chess
import chess.engine
import pytest
from trainer.chess_core import (
    Candidate,
    Score,
    board_facts,
    engine_context,
    evaluation_loss,
    legal_move,
    material,
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


def test_rules_special_moves_and_facts():
    castle = valid_board("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
    move = legal_move(castle, "e1g1")
    assert castle.san(move) == "O-O"
    assert board_facts(castle, move, ["e1g1"])["castling_move"]
    promote = valid_board("4k3/P7/8/8/8/8/8/4K3 w - - 0 1")
    assert promote.san(legal_move(promote, "a7a8n")) == "a8=N"
    ep = valid_board("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
    ep.push(legal_move(ep, "e5d6"))
    assert ep.piece_at(chess.D5) is None
    assert material(ep, chess.BLACK) == 0
    with pytest.raises(ValueError):
        valid_board("8/8/8/8/8/8/8/8 w - - 0 1")
    with pytest.raises(ValueError):
        legal_move(chess.Board(), "e2e5")
    with pytest.raises(ValueError):
        legal_move(chess.Board(), "0000")


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


def test_target_rating_does_not_change_chess_evaluation(settings):
    before = MovePolicy.from_settings(settings)
    settings.target_rating = 2200
    assert before == MovePolicy.from_settings(settings)
