"""Project a complete policy onto a played move and the current objective best."""

import math


def policy_summary(policy, played, best):
    probabilities = [row.probability for row in policy.moves]
    exact = policy.complete and all(p is not None for p in probabilities)
    entropy = (
        -sum(p * math.log(p) for p in probabilities if p) / math.log(len(probabilities))
        if exact and len(probabilities) > 1
        else 0.0
        if exact
        else None
    )
    lookup = {row.uci: row for row in policy.moves}
    return dict(
        provenance=policy.provenance,
        played=lookup.get(played),
        engine_best=lookup.get(best),
        top_moves=policy.moves[:5],
        normalized_entropy=min(1.0, max(0.0, entropy)) if entropy is not None else None,
        top_three_mass=min(1.0, sum(probabilities[:3])) if exact else None,
    )
