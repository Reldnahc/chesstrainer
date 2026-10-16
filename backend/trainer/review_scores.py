"""Ordering/comparison of saved Stockfish facts, without converting mate into centipawns."""

from trainer.chess_core import Score, evaluation_loss

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

# Evaluation bands the rules read, in the mover's centipawns.
HOLDING_CP = -50  # At least this: not losing (-0.50 or better).
LEVEL_CP = 150  # Strictly inside plus or minus this: roughly level.
CLEAR_EDGE_CP = 200  # At least this: clearly better; at most -CLEAR_EDGE_CP: clearly worse.
LOSING_ALTERNATIVE_CP = -150  # At most this: a runner-up that loses.
ONLY_GOOD_GAP_CP = 150  # At least this between best and runner-up for an only move.


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


def is_only_good(best, second):
    """The runner-up actually loses, so the best move is the only good one.

    Not merely a smaller advantage: the best move keeps the mover safe (a forced
    win, or -0.50 or better), the runner-up is lost (-1.50 or worse, or mated), and
    the gap is at least 1.50 or a mate. The Great badge and the coach's only-move
    evidence both read this.
    """
    gap = evaluation_loss(best, second)
    safe_best = best.outcome() == 1 or (best.kind == "cp" and best.value >= HOLDING_CP)
    losing_second = second.outcome() == -1 or (
        second.kind == "cp" and second.value <= LOSING_ALTERNATIVE_CP
    )
    return safe_best and losing_second and (mate_changed(gap) or (gap.cp or 0) >= ONLY_GOOD_GAP_CP)


def is_only_good_move(best, actual, second):
    """The played move is the only good one: the runner-up actually loses, and the
    played move itself keeps the position (a forced win, or -0.50 or better), so a
    near-best move that is nonetheless lost is no sole resource. The Great badge and
    the coach's only-move evidence read this one rule, with no searched runner-up
    (``second`` None) never establishing it."""
    return (
        second is not None
        and is_only_good(best, second)
        and (actual.outcome() == 1 or (actual.kind == "cp" and actual.value >= HOLDING_CP))
    )


def numeric(score):
    """A score as centipawns, a mate as 10000 either way. Only for category
    boundaries; mate remains a separate type in all payloads. (Accuracy uses
    Lichess's own 1000 and puzzle verification encodes the mate distance; those
    encodings belong to their calculations.)"""
    return score.value if score.kind == "cp" else score.outcome() * 10000


def is_decisive_swing(best, actual):
    """The mover was not losing (-0.50 or better, or winning by mate) and now is
    (-2.00 or worse, or mated). Mates count, so the review and its events agree."""
    return numeric(best) >= HOLDING_CP and numeric(actual) <= -CLEAR_EDGE_CP


def blunder_cp(rating):
    return BLUNDER_CP_LOW_RATED if rating < BLUNDER_RATING else BLUNDER_CP


def strongest_alternative(report):
    second = Score.model_validate(report["second_score"]) if report.get("second_score") else None
    if second is None:
        return None  # A single restricted move is not a searched runner-up.
    if report["actual"]["uci"] != report["best"]["uci"]:
        played = Score.model_validate(report["actual"]["score"])
        # Restricted-root analysis may reveal a good alternative absent from MultiPV.
        # It disproves an only-move claim even when the original runner-up was poor.
        if played.order_key() > second.order_key():
            second = played
    return second
