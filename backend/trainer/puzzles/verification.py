"""Verdicts shared by the pack verifier and the game-derived generator.

Scores are integers from the solver's perspective with python-chess's mate
encoding: a mate for the solver in n plies-to-mate moves is ``MATE_SCORE - n``,
being mated in n is ``-MATE_SCORE + n``. The pack verifier and the generator must
not drift apart, so the thresholds and the uniqueness rule live here.
"""

MATE_SCORE = 100_000
# A solution may score this much below the engine's best move and still count.
TOLERANCE_CP = 50
# Every rival must score at least this much worse than the solution.
MARGIN_CP = 100
# After the final solver move the position must be at least this far ahead, or mate.
PAYOFF_CP = 150


def is_mate(score: int) -> bool:
    return abs(score) >= MATE_SCORE - 1000


def describe(score: int) -> str:
    if score >= MATE_SCORE - 1000:
        return f"#{MATE_SCORE - score}"
    if score <= -MATE_SCORE + 1000:
        return f"#-{MATE_SCORE + score}"
    return f"{score:+d}"


def score_int(score) -> int:
    """A saved trainer ``Score`` (root-mover perspective) as a comparable integer."""
    if score.kind == "mate":
        if score.value > 0 or score.mate_given:
            return MATE_SCORE - score.value
        return -MATE_SCORE - score.value
    return score.value


def rival_verdict(solution: int, rival: int, *, margin: int = MARGIN_CP) -> str:
    """How a rival move compares with the solution at the same root.

    ``unique``: the rival is clearly worse. ``slower_mate``: both mate, the rival
    more slowly, which the pack verifier only warns about. ``equal_mate``: the
    rival mates as fast or faster, so a solver choosing it would be marked wrong.
    ``close``: the rival is within the margin.
    """
    if is_mate(solution) and solution > 0 and is_mate(rival) and rival > 0:
        return "equal_mate" if rival >= solution else "slower_mate"
    if solution - rival < margin:
        return "close"
    return "unique"


def payoff_ok(score: int, *, payoff: int = PAYOFF_CP) -> bool:
    return score >= payoff or (is_mate(score) and score > 0)
