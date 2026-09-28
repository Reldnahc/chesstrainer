"""Legal mainlines and synthetic evaluations through the production context graph."""

import json

from test_game_context import reviewed
from trainer.contracts.games import GameDetail
from trainer.game_review import position


def recovery_game(learner):
    parsed, reports, context = reviewed([-300, 0, 0] if learner == "white" else [0, 300, 0, 0])
    board = parsed.board()
    frames = [position(board) | dict(san="Start", uci=None, number=1, actor=None, report=None)]
    for ply, move in enumerate(parsed.mainline_moves(), 1):
        san, number, actor = board.san(move), board.fullmove_number, board.turn
        board.push(move)
        frames.append(
            position(board)
            | dict(
                san=san,
                uci=move.uci(),
                number=number,
                actor="white" if actor else "black",
                report=reports[ply],
            )
        )
    return GameDetail.model_validate(
        dict(
            id=f"perspective-{learner}",
            white="Learner" if learner == "white" else "Opponent",
            black="Learner" if learner == "black" else "Opponent",
            orientation=learner,
            frames=frames,
            context=context,
            result="*",
            played_on=None,
            rating=1000,
            white_rating=1000,
            black_rating=1000,
            accuracy=None,
            job=dict(
                id=f"review-{learner}",
                status="completed",
                completed=8,
                total=8,
                error=None,
                cancel_requested=False,
                phase="complete",
            ),
        )
    )


if __name__ == "__main__":
    print(
        json.dumps([recovery_game(color).model_dump(mode="json") for color in ("white", "black")])
    )
