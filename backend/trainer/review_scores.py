"""Ordering/comparison of saved Stockfish facts, without converting mate into centipawns."""

from trainer.chess_core import Score

# Centipawns lost at each label boundary of game review's grades. Review labels,
# events, practical difficulty, refinement, game context and Insights all read
# these, so a boundary changes in one place.
NEAR_BEST_CP = 20  # At most this: near best, eligible for Great.
INACCURACY_CP = 50
MISTAKE_CP = 100
BLUNDER_CP = 200  # For a mover rated BLUNDER_RATING or more.
BLUNDER_CP_LOW_RATED = 300  # Below that rating, an ordinary pawn loss is not a Blunder.
BLUNDER_RATING = 1200
GRADE_BOUNDARIES = (INACCURACY_CP, MISTAKE_CP, BLUNDER_CP, BLUNDER_CP_LOW_RATED)


def mate_changed(loss):
    return loss.allows_mate or loss.mate_lost


def is_poor(loss):
    """Inaccuracy or worse: a mate given up or allowed, or INACCURACY_CP lost."""
    return mate_changed(loss) or (loss.cp or 0) >= INACCURACY_CP


def is_near_best(loss):
    return not mate_changed(loss) and (loss.cp or 0) <= NEAR_BEST_CP


def is_mistake(loss):
    """Mistake-sized or worse: a mate given up or allowed, or MISTAKE_CP lost."""
    return mate_changed(loss) or (loss.cp or 0) >= MISTAKE_CP


def blunder_cp(rating):
    return BLUNDER_CP_LOW_RATED if rating < BLUNDER_RATING else BLUNDER_CP


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
