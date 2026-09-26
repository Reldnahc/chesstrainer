# Game accuracy proposal

Status: researched, not implemented. The review UI cleanup is separate from this
proposal. Accuracy should be a compact 0–100 score for each player, independent of
Elo and of the existing move-label thresholds.

## Research

[Chess.com's CAPS2 explanation](https://support.chess.com/en/articles/8708970-how-is-accuracy-in-analysis-determined)
describes engine agreement and a friendlier distribution of scores, but does not
provide the exact formula. We should not promise matching Chess.com numbers.

[Lichess documents an open method](https://lichess.org/page/accuracy): transform
evaluations into a winning-chance proxy, measure the loss for each move, then blend
a volatility-weighted mean with a harmonic mean. This gives consequential mistakes
more influence than a simple average. Its
[linked implementation](https://github.com/lichess-org/lila/blob/2e653ad1e2b9fad31b4a092394019ef8fafdedb8/modules/analyse/src/main/AccuracyPercent.scala)
includes a one-point uncertainty allowance in the move score. Treat that pinned
implementation as the reference when implementing and testing the arithmetic.

## Recommended Fieldwork behavior

- Use each saved report's `best.score` and `actual.score`, both evaluated from the
  mover's perspective at the same position. Do not turn Best/Good/Blunder labels
  into points. This uses the comparisons already supporting our coaching and
  avoids attributing differences between adjacent searches to a player's move.
- Start with Lichess's conversion and aggregation. Using paired candidate scores
  instead of adjacent position scores makes this a Fieldwork adaptation, not an
  exact reproduction of either site's accuracy.
- Keep full precision internally and display one decimal place. A played move
  evaluated at least as well as the best candidate receives 100; search noise must
  not create negative loss or scores above 100.
- For volatility, use the original game's White-perspective evaluation sequence,
  beginning with the first report's best score normalized to the actual starting
  color. Use the reference window alignment, window sizes of 2–8, and weights
  bounded to 0.5–12. Aggregate each player's own moves separately.
- Use a fixed conversion for every player. No rating adjustment, inferred Game
  Rating, or change to the existing move labels.

The [score conversion reference](https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/eval.scala)
caps centipawn inputs at ±1000 and maps mate outcomes to those endpoints. Preserve
Fieldwork's typed mate semantics: `mate_given` distinguishes a delivered mate at
zero from being mated at zero. Mate distance should not reverse that outcome.

## UI and completion

Put accuracy alongside each player's existing name, without another large report
panel. Reserve a small stable space for the value. Until every original-game ply
has a valid report, show an em dash with an accessible explanation that the review
is incomplete. Paused, failed, and partly saved reviews must not appear final.

Branch exploration must not change either player's game accuracy. Board orientation
only changes where the players appear. A player with no analyzed moves has no score,
not a default 100. Keep all played moves, including forced moves, in the first version.

## Implementation scope and verification

All necessary candidate scores, White-perspective scores, and move ownership are
already saved or reconstructed by `game_review.py` and `routes/games.py`. Implement
a pure backend scoring helper and return a versioned accuracy summary with game
detail and completed review progress. Compute from the existing reports; this needs
no additional engine searches, database, or schema migration. Existing completed
reviews should receive scores immediately when opened.

Meaningful checks before shipping:

- Known numerical fixtures against the pinned reference; bounded, finite scores;
  zero-loss moves; weighted and harmonic aggregation, including zero accuracy.
- Symmetry under swapping colors, plus games starting with Black from a custom FEN.
- Positive/negative mate and both zero-mate cases; no moves, one move, missing
  reports, and short games where the volatility window exceeds available positions.
- Identical accuracy after changing rating, rotating the board, or exploring a
  branch. No engine invocation when scoring saved reports.
- Completion arriving through progress polling matches a freshly opened review.
  Desktop and mobile score placement does not resize the board or jump the layout.

Before finalizing the policy, inspect synthetic examples with one decisive mistake,
many small inaccuracies, and a long already-decided ending. Accuracy summarizes
engine evidence; it must not replace the coach's concrete explanations.
