# Practical difficulty and human naturalness

`review_intelligence/difficulty.py` derives `practical-2` from saved Stockfish and
human evidence. It performs no search, changes no grades, and uses no coach
identity. Full-game and variation reports expose the same typed assessment.
Legacy Stockfish-only reports retain structural facts and explicitly abstain
from human interpretations. Cold SRS does not expose this payload.

## Separate questions

- **Played naturalness:** preferred, plausible, unusual, or unknown to the model.
- **Best-find difficulty:** natural, challenging, difficult, unknown, or a forced
  legal reply. This describes finding the engine's preferred move, not how hard
  it is to find *any* playable move, win the game, or what the player thought.
- **Objective pressure:** saved candidate separation, near-best candidate count
  lower bound, search coverage and a narrow defensive-resource flag.
- **Supported structure:** contiguous forcing prefix (up to six saved plies),
  supported finding horizon, verified sacrifice and typed mate transition.

The API's `acceptable_count_lower_bound` counts root candidates known to stay
within 50 cp without losing/allowing a mate. This is a near-best threshold, not a
claim that other moves are unplayable. Baseline MultiPV=2 does not enumerate every
acceptable choice; `alternatives_complete=false` and an explicit limitation
preserve that distinction. Missing runner-up evidence cannot establish an only
move. `only_good_move_at_depth` requires a nonlosing best move and a runner-up at
least 150 cp worse that reaches -150 cp or a losing mate. A missed forced win
while retaining +5 is **not** a sole defensive resource. These are bounded-search
and rule conclusions, not proof against perfect play.

Version 2 also includes a separately searched played move when comparing
alternatives. If that move is different from the engine's first choice and also
holds the position, it disproves an only-good-move claim even if the unrestricted
MultiPV runner-up scored poorly. The same Stockfish-only comparison protects the
Fieldwork Great rule. A missing runner-up is still unknown, never proof of a sole
resource. Version 1's recorded benchmark below remains a historical measurement.

## Conservative bands and confidence

The initial fixed probe has 12 synthetic positions and four rating pairs:
600/800, 1200/1400, 1800/2000 and 2400/2600. It cannot calibrate population success
or justify five precise difficulty levels. We retain three descriptive bands.

An exact policy is **preferred** at rank 1–3 with at least 0.10 model probability;
**unusual** requires rank 7 or worse and below 0.03. Everything between is
plausible. These coarse gates were chosen after inspecting the fixed probe:
lower-quartile played probabilities were approximately 0.027, 0.047, 0.045 and
0.036 across its rating pairs. Combining rank and mass prevents low-rank choices
in diffuse policies from being called dominant, and avoids treating a rank just
outside top three as rare. This is a heuristic interpretation, **not an empirical
finding about player success**. Thresholds/version are explicit and boundary-tested.

Preferred best moves receive the natural band. Other modeled moves are
challenging; difficult additionally requires unusual model policy and an actual
supported tactical horizon of at least three plies, a verified sacrifice of that
best move, or the narrow defensive resource. Rarity alone cannot earn difficult.
A single legal reply is structural and never praised as a difficult discovery.
There is no exceptional band or fabricated numerical difficulty score.

Rank-only providers can identify their top choice, but unseen moves and absent
probabilities remain unknown. They cannot manufacture unusual-policy claims.
Related Lichess-blitz evidence is still heuristic and uncalibrated. Cross-platform
or unknown domains, missing rating fallbacks, unknown setup history, incomplete
policy, and ratings outside the probe range lower confidence further. Neither
confidence level licenses “X% of players at your rating.” The inspected ranges
are role-specific: 600–2400 for the mover, 800–2600 for the opponent. Even inside
those ranges the small synthetic probe establishes no population calibration.

## Inspection results

Replaying the exact M0 deep Stockfish baseline and M1 pinned 79M policies gave:

| Self rating | Natural best finds | Challenging | Difficult | Unusual played moves |
|---|---:|---:|---:|---:|
| 600 | 8 | 3 | 1 | 3 |
| 1200 | 10 | 2 | 0 | 2 |
| 1800 | 10 | 2 | 0 | 1 |
| 2400 | 10 | 2 | 0 | 1 |

The queen offer is unusual at 600 (rank 7, probability 0.0202) with a verified
sacrifice, and model-preferred at 2400 (rank 2, 0.2968). The move allowing Fool's
Mate is preferred at 600 (rank 1, 0.2049), demonstrating **natural error**. The quiet
retreat Nb8 in the Ruy Lopez is unusual at 600 (rank 24, 0.00305) while retaining
nearly the same objective position; at 2400 it is rank 2 with 0.2998. Repeated-root
history changes policy markedly. These are synthetic model probes, not real
player data or validation that the model is calibrated on Chess.com.

Deterministic interpretations include natural error, unusual strong move,
natural near-best move, hard-to-find defensive resource, immediate mate missed
and forced reply. They describe observable/model-supported facts, never an
individual's thought process. Strong/poor move checks still use Stockfish loss
and mate types only. Human evidence does not influence the existing grading code.

## Reproduce and inspect

Generate the input artifacts using the baseline/feasibility commands in
[REVIEW_INTELLIGENCE.md](REVIEW_INTELLIGENCE.md) and
[MAIA_FEASIBILITY.md](MAIA_FEASIBILITY.md), then:

```sh
python scripts/benchmark_difficulty.py --stockfish-report data/review-benchmark/baseline-1.json --human-report data/maia-benchmark/79m-isolated.json --output data/review-benchmark/difficulty-NEW.json
```

This command runs offline without Torch. It validates corpus identity, complete
legal policy and provider method, records both input-file hashes, and retains
per-position/rating components, limitations and evidence references for developer
inspection. Output is ignored generated analysis data. The product payload has a
version and deterministic input digest. Persona or prose changes do not alter it.

The sample is deliberately small and synthetic. Broader calibration remains a
non-blocking research follow-up; uncertainty and fewer bands are part of the
production contract, not a claim that such validation already happened.
