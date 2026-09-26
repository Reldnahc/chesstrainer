# Game accuracy

The game detail and review progress APIs expose a versioned accuracy score for each
player after a complete review. Fieldwork uses the published Lichess calculation;
there is no Elo input and move-label thresholds do not affect the score. Scores are
derived from saved reports, requiring no new Stockfish searches or database schema.

## Calculation and provenance

The Python port follows Lichess lila revision
`2e653ad1e2b9fad31b4a092394019ef8fafdedb8`, with its pinned scalachess 17.8.2 and
scalalib 11.8.8 helpers. Sources, local modifications and full AGPL/MIT licenses are
in [the port directory](../backend/trainer/_vendor/lichess_accuracy/README.md).

It converts White-perspective evaluations after successive plies into a winning-chance
proxy and scores each change from the moving player's perspective. The aggregation
combines a volatility-weighted mean with a harmonic mean. It preserves the upstream
uncertainty allowance, population deviation, window alignment and bounds, centipawn
saturation, and harmonic denominator floor. See
[Lichess's explanation](https://lichess.org/page/accuracy) and the pinned source.

The originally proposed best-versus-played candidate adaptation was superseded by
the decision to use Lichess's adjacent-position calculation directly. Standard games
use the reference initial value of +15 centipawns. For a custom starting FEN, use
the first saved report's best evaluation, normalized to White, instead of assuming
an ordinary starting position. Move ownership follows the actual starting color.
Typed mate outcomes saturate at the appropriate endpoint; delivered mate at zero
is distinct from being mated at zero.

The method is Lichess's, but Fieldwork supplies its own engine evaluations. Different
search settings or engine versions can therefore produce different numbers from a
separate review on lichess.org. These scores are not Chess.com's CAPS2 or an Elo
estimate.

## API and completeness

Both `GET /api/games/{id}` and `GET /api/games/{id}/review?after={ply}` return:

```json
{"accuracy": {"version": "lichess-2e653ad1-1", "white": 84.7, "black": 91.2}}
```

The numbers above illustrate the response shape. Full precision is returned.
`accuracy` is `null` until the job is completed and every original-game ply has a
valid evaluation. Missing, extra, or invalid reports do not produce partial scores.
Like the upstream game calculation, games where both sides have not moved receive
no score. The final incremental response includes accuracy even when its move list
is empty. Only completion requires loading all saved evaluations during polling.

Already-completed reviews get scores when reopened, including when Stockfish is
unavailable. Ratings, branch exploration and board orientation cannot modify the
original-game scores. No aggregate is stored in a second table or database.

## Display

Each player's name has an accuracy readout showing one decimal place, using stable
space that does not change board size when analysis finishes. An em dash has an
accessible explanation for incomplete or unavailable results. Accuracy belongs to
the original game even while the player explores a variation. Flipping the board
moves each score with its player.

## Verification

Regression cases use the pinned upstream numerical examples and tolerances,
including decisive mistakes, repeated small losses and Black moving first. Further
tests cover saturation, uncertainty, the harmonic floor, both zero-mate outcomes,
color symmetry at window-size boundaries, custom FENs and incomplete evidence.
Native review tests verify equality between detail and incremental responses,
rating independence, paused reviews, and reopening saved results without an engine.
Browser checks cover completion through incremental polling, placeholders, rounding,
stable board/readout geometry, flipping, branching and reopening on desktop/mobile.
