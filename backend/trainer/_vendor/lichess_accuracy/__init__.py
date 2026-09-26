"""Python port of Lichess accuracy (AGPL-3.0); see README.md and LICENSE files.

The only algorithm extension is an explicit initial_cp for custom starting boards.
"""

from math import exp, sqrt


def win_percent(cp: int) -> float:
    cp = max(-1000, min(1000, cp))
    return 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)


def move_accuracy(before: float, after: float) -> float:
    if after >= before:
        return 100.0
    raw = 103.1668100711649 * exp(-0.04354415386753951 * (before - after)) - 3.166924740191411
    return max(0.0, min(100.0, raw + 1))  # Upstream analysis uncertainty allowance.


def game_accuracy(
    cps: list[int], *, start_white: bool = True, initial_cp: int = 15
) -> dict[str, float] | None:
    """White-perspective evaluations after each ply; both players must have moved."""
    if len(cps) < 2:
        return None
    wins = [win_percent(cp) for cp in [initial_cp, *cps]]
    window_size = max(2, min(8, len(cps) // 10))
    windows = [wins[:window_size]] * (window_size - 2)
    windows += [wins[i : i + window_size] for i in range(len(wins) - window_size + 1)]
    weights = []
    for window in windows:
        mean = sum(window) / len(window)
        deviation = sqrt(sum((value - mean) ** 2 for value in window) / len(window))
        weights.append(max(0.5, min(12.0, deviation)))

    by_color: dict[str, list[tuple[float, float]]] = {"white": [], "black": []}
    for index, (before, after, weight) in enumerate(zip(wins, wins[1:], weights)):
        white = (index % 2 == 0) == start_white
        accuracy = move_accuracy(before, after) if white else move_accuracy(after, before)
        by_color["white" if white else "black"].append((accuracy, weight))

    result = {}
    for color, moves in by_color.items():
        weighted = sum(value * weight for value, weight in moves) / sum(w for _, w in moves)
        # Lichess floors each denominator at 1, including zero-accuracy moves.
        harmonic = len(moves) / sum(1 / max(1, value) for value, _ in moves)
        result[color] = (weighted + harmonic) / 2
    return result
