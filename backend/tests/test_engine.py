import chess
import pytest
from trainer.chess_core import Candidate
from trainer.engine import Stockfish


@pytest.mark.stockfish
def test_native_engine_cache_and_shutdown(settings, sessions, stockfish_path):
    settings.stockfish_path = stockfish_path
    engine = Stockfish(settings, sessions)
    board = chess.Board("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1")
    try:
        result = engine.analyze(board, deep=True)
        candidates = [Candidate.model_validate(c) for c in result.candidates]
        assert len(candidates) == settings.multipv
        assert candidates[0].score.kind == "mate" and candidates[0].score.value > 0
        assert engine.analyze(board, deep=True).id == result.id
        assert engine.hits == 1
        assert "Stockfish" in result.engine_version
    finally:
        engine.close()
    assert engine.process is None
    restarted = Stockfish(settings, sessions)
    try:
        assert restarted.analyze(board, deep=True).id == result.id
        assert restarted.hits == 1
    finally:
        restarted.close()
