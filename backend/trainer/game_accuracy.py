"""Score completed original-game reviews using the pinned Lichess calculation."""

from collections.abc import Mapping

import chess

from trainer._vendor.lichess_accuracy import game_accuracy
from trainer.chess_core import Score

VERSION = "lichess-2e653ad1-1"


def accuracy_cp(score: Score) -> int:
    # Match Lichess's saturated mate conversion, including our signed zero mates.
    return score.outcome() * 1000 if score.kind == "mate" else score.value


def review_accuracy(
    reports: Mapping[int, dict], *, total: int, starting_board: chess.Board, completed: bool
) -> dict | None:
    if not completed or total < 2 or set(reports) != set(range(1, total + 1)):
        return None
    try:
        cps = [
            accuracy_cp(Score.model_validate(reports[ply]["white_score"]))
            for ply in range(1, total + 1)
        ]
        initial_cp = 15
        if starting_board.fen() != chess.STARTING_FEN:
            initial = Score.model_validate(reports[1]["best"]["score"])
            initial_cp = accuracy_cp(initial if starting_board.turn else initial.negate())
    except (KeyError, TypeError, ValueError):
        # Missing/corrupt evidence is unavailable, never a perfect or partial score.
        return None
    scores = game_accuracy(cps, start_white=starting_board.turn, initial_cp=initial_cp)
    return {"version": VERSION, **scores} if scores else None
