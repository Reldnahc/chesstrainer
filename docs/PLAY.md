# Play: a game against the selected coach

The Play page starts a game against the coach the account has selected. The coach
is the opponent and, by default, the live commentator: every move gets the same
label, evaluation, reaction and graph point the game review produces, while the
game is still in progress. A finished game is saved into Games like any imported
game and reviewed there with no play-specific code.

This document records the design decisions, the measurements behind them, the
HTTP surface and the spoken meanings the feature still needs. It builds on
[Game review](GAME_REVIEW.md), [Human move evidence](HUMAN_MODELS.md) and
[Evidence-led coach dialogue](COACH_DIALOGUE.md).

## Strength levels

Two kinds of opponent exist and the setup page names them plainly.

**Human-like (600 to 2500).** The move comes from the pinned Maia-3 policy,
conditioned on the chosen rating for the bot and on the learner's fitted rating
for the opponent, with the real move history. The move is *sampled* from the
policy, not taken as its most likely move: sampling is what produces the variety
and the error rate of a player at that level. Stockfish is used only as a
guardrail. After a move is drawn, one triage search (the review's own settings)
scores the engine's top four candidates and, if needed, the drawn move; the draw
is rejected only when it does something players at that rating practically never
do, and the next sample is tried. The rules are a table by rating, from each
rating upward (`trainer/play/bot.py`, `GUARDS`):

| From rating | Rejected |
|---|---|
| 1200 | A move that allows a forced mate |
| 1400 | A move that loses at least 900 cp against the engine's best |
| 1800 | A move that loses at least 500 cp |
| 2200 | A move that loses at least 300 cp |

Up to five draws are checked. If every one fails, the least damaging checked
human move is played rather than the engine's move, so the bot never switches
character. Draws are seeded by game and ply, so a retried request plays the same
reply. Above 2500 the policy's rating dial stops improving play, so the range
ends there.

**Engine (1800 to 2600).** Stockfish's own `UCI_LimitStrength` and `UCI_Elo`,
through `Stockfish.play_limited`, never cached or graded. Stockfish's limiter
cannot imitate anyone weaker than a strong club player, so the setup page does
not offer it below 1800.

### Why not a weakened engine, and why not a blend

Measured on 2026-10-03 on 240 positions from the learner's own games (his move to
play, plies 8 to 70), with Stockfish at depth 13 scoring every legal move:

| Setting | Mean loss (cp) | Best move | Loses 300+ cp |
|---|---:|---:|---:|
| Maia 1000, sampled | 92 | 46% | 10% |
| Maia 1600, sampled | 64 | 53% | 6% |
| Maia 2200, sampled | 43 | 61% | 4% |
| Stockfish UCI_Elo 1320 (its minimum) | 49 | 43% | 3% |
| Stockfish Skill Level 0 | 56 | 47% | 5% |

Maia's rating dial changes strength smoothly and monotonically across the whole
range. Stockfish at its weakest plays about as accurately as Maia at 1800 to
2000, and gets there by playing nearly half of its moves perfectly and then
dropping a piece: the shape users complain about on every weakened-engine bot.
A weighted average of a Maia policy and engine scores reproduces that shape, so
the design uses the engine as a veto, never as a blend.

### Reply timing

The learner's move is saved and shown at once; the move request does no engine
or model work. The page then asks for the bot's reply (`/reply`) and for the
review's report on the learner's move in parallel. The reply is revealed only
after the coach has had its say: once that report has arrived and the coach's
voice line, if one plays, has finished, plus a pause of 2.5 seconds. If no report
arrives within 20 seconds the reply shows anyway. A repeated reply request after
the bot has moved returns the same move.

### No resignation, no draw offers

The coach never resigns; it plays on until the board decides. There is no draw
offer. Threefold repetition and the fifty-move rule end the game automatically,
and the learner can resign.

## Match my level

Platform ratings do not transfer to Maia's Lichess-blitz scale: the learner's
723-rated Chess.com rapid games are best predicted by Maia conditioned at 1000 to
1200, and the review's own measurements show the same offset. So "Match my level"
never copies a PGN rating. `trainer/play/level.py` samples 60 of the learner's own
decisions from the library (fixed seed, plies 8 to 70), asks the human model for
the policy at each rating on a 800 to 2200 grid with both sides set equal, and
keeps the rating with the highest mean log-probability of the moves actually
played. The result, its sample size and the median platform rating are stored in
`play_profiles` and refreshed in the background whenever the library's game count
changes. Without the model, or before the fit finishes, games use 1200. The fit is
a conditioning value with its evidence shown beside it, not a rating claim.

## Commentary

Commentary is always on. Each ply is sent to the same per-move pipeline as a
review variation (deep Stockfish search, human evidence, public report), in
order, and the coach panel, badge, evaluation bar, Maia popover and graph update
as results arrive. The coach's verdict on the learner's move arrives, and is
spoken, before the bot replies; that is the point. Reports produced during play
are saved on the play game so a reload shows them again; the saved library game
is reviewed afresh by the ordinary review job.

The coach speaks only recorded meanings, exactly as in the review. Nothing is
spoken for moments the catalogue does not cover.

## Hand-off into Games

When a game ends (checkmate, draw by rule, or the learner resigning) the moves
are written as a PGN with the coach as the opponent and both conditioning ratings
as the Elo headers, imported through the ordinary import path with the learner's
side explicit, and queued for analysis like any imported game. The finished
page links to that review. Starting a new game while one is active marks the old
one abandoned without saving it.

## HTTP surface

| Method and path | Purpose |
|---|---|
| `GET /api/play/profile` | The level fit, starting or refreshing it in the background when stale |
| `POST /api/play/profile/refresh` | Recompute the fit |
| `GET /api/play/active` | The account's game in progress, if any |
| `POST /api/play` | Start a game: coach, color, opponent kind and rating |
| `GET /api/play/{id}` | Game state with review-shaped frames |
| `POST /api/play/{id}/move` | Save the learner's move at an expected ply; no engine work |
| `POST /api/play/{id}/reply` | The bot's answer, computed now, or repeated if it has already moved |
| `POST /api/play/{id}/analyze` | The review's report for one played ply, saved on the game |
| `POST /api/play/{id}/resign` | The learner resigns |

Engine and model work runs between database transactions, serialized per
account by the existing variation lock, on the account's warm engine (the shared
local engine, or a pooled process in account mode).

## Spoken meanings the game still needs

Chandler owns all coach writing and recording. The game plays today with the
existing 195 meanings, which cover every graded move, Book lines, clock
observations, checkmate and automatic draws. These moments have no catalogue
entry yet, so they currently show plain page text or stay silent:

| Proposed meaning | When it would play | Notes |
|---|---|---|
| `game-start` | Once, when a game against the coach begins | The existing opener is review wording ("let's walk through this game") |
| `game-resigned-learner` | The learner resigns | Learner-perspective result line |
| `game-review-ready` | The finished game's review opens | Bridges playing and looking back |
| `game-start-black` (optional) | The bot moves first because the learner has Black | Could share `game-start` |

That is three or four recordings per coach. Plain-clip rules apply (no squares,
digits or owner words on clips that can play on either side). Until they are
recorded, the page shows the result in a notice and the coach keeps the last
graded move's line.

## Limits

No clock or time control, no rated play, no games seeded from the learner's
weakness positions (planned after the puzzle-mining pipeline owns those
positions), and no per-player imitation model. Strength labels are measured
conditioning values; the measurement above is of raw Maia and of Stockfish, not of
the final bot with its guardrail, which should be re-measured on the learner's
positions before any label is presented as calibrated.
