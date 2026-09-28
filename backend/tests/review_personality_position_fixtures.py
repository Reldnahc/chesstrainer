"""Legal counterexamples for personality wording, not engine-quality benchmarks."""

import json

import chess
from review_intelligence_fixtures import move_report
from trainer.game_review import public_report


def reports():
    blocked = chess.Board("7k/4n3/4p3/3P4/8/8/8/K7 w - - 0 1")
    stationary = chess.Board("7k/8/8/4p3/3P4/8/8/3R3K w - - 0 1")
    cases = []
    for name, board, uci, code in (
        ("blocked_passer", blocked, "d5e6", "passed"),
        ("stationary_rook", stationary, "d4e5", "rook_file"),
    ):
        move = chess.Move.from_uci(uci)
        assert board.is_valid() and move in board.legal_moves
        after = board.copy()
        after.push(move)
        if name == "blocked_passer":
            assert after.piece_at(chess.E6) == chess.Piece(chess.PAWN, chess.WHITE)
            assert after.piece_at(chess.E7) == chess.Piece(chess.KNIGHT, chess.BLACK)
            probe = after.copy()
            probe.turn = chess.WHITE
            assert chess.Move.from_uci("e6e7") not in probe.legal_moves
        else:
            assert board.piece_at(chess.D1) == after.piece_at(chess.D1)
            assert after.piece_at(chess.D1) == chess.Piece(chess.ROOK, chess.WHITE)
        cases.append(
            dict(
                name=name,
                code=code,
                fen=board.fen(),
                after=after.fen(),
                report=public_report(move_report(board, uci), 1000),
            )
        )
    return cases


if __name__ == "__main__":
    print(json.dumps(reports()))
