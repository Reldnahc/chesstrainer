"""Real positional projections: an unplayed change versus the same move played."""

import json

import chess
from review_intelligence_fixtures import move_report
from trainer.game_review import public_report

CASES = [
    ("doubled_files", "doubled", "7k/8/8/8/8/2n5/1PP5/K7 w - - 0 1", "b2c3", "b2b3"),
    ("bishop_pair", "bishops", "7k/8/8/8/3b4/2B5/8/K4B2 b - - 0 1", "d4c3", "h8h7"),
]


def position_reports(feature, black=False):
    _, code, fen, alternative, played = next(row for row in CASES if row[0] == feature)
    board = chess.Board(fen)
    if black:
        board = board.mirror()

        def mirrored(uci):
            move = chess.Move.from_uci(uci)
            return chess.Move(
                chess.square_mirror(move.from_square), chess.square_mirror(move.to_square)
            ).uci()

        alternative, played = mirrored(alternative), mirrored(played)
    assert board.is_valid()
    assert all(chess.Move.from_uci(uci) in board.legal_moves for uci in (alternative, played))
    return {
        "feature": feature,
        "code": code,
        "mirrored": black,
        "alternative": public_report(
            move_report(board, played, best=alternative, before=0, after=-150), 1000
        ),
        "actual": public_report(move_report(board, alternative), 1000),
    }


if __name__ == "__main__":
    print(
        json.dumps(
            [position_reports(feature, black) for feature, *_ in CASES for black in (False, True)]
        )
    )
