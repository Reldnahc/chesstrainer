"""Ordering/comparison of saved Stockfish facts, without converting mate into centipawns."""

from trainer.chess_core import Score


def score_order(score):
    if score.kind == "cp":
        return 1, score.value
    return (2, -abs(score.value)) if score.outcome() == 1 else (0, abs(score.value))


def strongest_alternative(report):
    second = Score.model_validate(report["second_score"]) if report.get("second_score") else None
    if second is None:
        return None  # A single restricted move is not a searched runner-up.
    if report["actual"]["uci"] != report["best"]["uci"]:
        played = Score.model_validate(report["actual"]["score"])
        # Restricted-root analysis may reveal a good alternative absent from MultiPV.
        # It disproves an only-move claim even when the original runner-up was poor.
        if score_order(played) > score_order(second):
            second = played
    return second
