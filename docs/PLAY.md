# Play: a game against the selected coach

The Play page starts a game against the coach the account has selected. The coach
is the opponent and, by default, the live commentator: every move gets the same
label, evaluation, reaction and graph point the game review produces, while the
game is still in progress. A finished game is saved into Games like any imported
game and reviewed there with no play-specific code; its review job is queued at the
front, as when a learner opens a game.

This document records the design decisions, the measurements behind them, the
HTTP surface and the spoken meanings the feature still needs. It builds on
[Game review](GAME_REVIEW.md), [Human move evidence](REVIEW_INTELLIGENCE.md#human-move-evidence) and
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

Measured on 240 positions from the learner's own games (his move to
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
review's report on the learner's move in parallel. The reply is revealed 0.4
seconds after that report arrives; it does not wait for the coach's voice. If no
report arrives within 20 seconds the reply shows anyway. A repeated reply request
after the bot has moved returns the same move.

The coach's line about the learner's move keeps playing over the reply: the coach
panel stays on that move until its line finishes (or, with no voice, for 2.5
seconds after the grade), then follows the board and says its one line about the
reply. The learner may move as soon as the reply is on the board; their move, or
navigating the game, cuts any line still playing. Each ply gets one automatic
playback.

### Going back

During a game the learner can step back to any earlier position where it was their
move and play a different move there. That move replaces the rest of the game: the
later moves and their reports are dropped, the bot answers the new move as usual, and
the saved game holds only the line actually finished. There is no variation tree and
no confirmation; the player row says "Moving replaces the rest"
while the board is on such a position. Positions where the bot was to move only show
the game. In opening practice the book is replayed through the kept moves, so the
practice picks up where it stood; a spot the learner had already answered (off book,
or the end of the line) followed by more moves counts as playing on. A bot reply or
book verdict still being computed when the learner goes back is discarded.

### No resignation, no draw offers

The coach never resigns; it plays on until the board decides. There is no draw
offer. Threefold repetition and the fifty-move rule end the game automatically
once they have happened: the third occurrence of the position, or fifty moves by
each side without a capture or pawn move. A draw the side to move could only claim
with its next move does not end the game. The learner can resign.

## Match my level

Platform ratings do not transfer to Maia's Lichess-blitz scale: the learner's
723-rated Chess.com rapid games are best predicted by Maia conditioned at 1000 to
1200, and the review's own measurements show the same offset. So "Match my level"
never copies a PGN rating. `trainer/play/level.py` samples 60 of the learner's own
decisions from the library (fixed seed, plies 8 to 70), asks the human model for
the policy at each rating on a 800 to 2200 grid with both sides set equal, and
keeps the rating with the highest mean log-probability of the moves actually
played. The result, its sample size and the median platform rating are stored in
`play_profiles` and refreshed whenever the library's game count changes, by a
`level_fit` job of the account (queued first, cancellable, drained on shutdown, and
kept out of the import activity list). Without the model, or before the fit finishes, games use 1200. The fit is
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

## Opening practice

The setup page can start a game that practices an opening instead: "Practice an
opening" lists every Lessons course with repertoire lines (the Italian for each
color, the King's Gambit, the Sicilian Dragon and the Vienna). The learner plays
the course's side; the color choice shows it but cannot change it.

The course's repertoire lines from the standard start are merged into one tree keyed
by position without move counters (`trainer/play/book.py`), so a transposition joins
the line it reaches: the Dragon's 2.Nc3 and 3.Nc3 lines meet the main Dragon. While
the game is in that tree the bot answers from it. With one book move it plays that;
with several it samples them by the Maia policy at the chosen rating restricted to the
book moves, each keeping at least a 10% share so rarer lines still come up. Book
replies do no engine work and are shown without waiting for the learner's grade.

Nothing about the practice is shown above the board. While the learner is in book,
**Show book** among the coach's actions draws the book move (every book move, where the
course has several) as an arrow; it stays available right after an off-book move.

When the learner leaves the book, the move stays on the board and the bot waits.
The coach's own bubble says it is not the line, with **Take back** and **Play on**
in place of its usual actions. The reply request compares the move with the best
book move in one restricted Stockfish search: within 0.3 pawns it is "decent, but
not the line", otherwise it "costs something", with the loss in pawns. The question
appears even when the move is fine. Play on turns the game into an ordinary one
against the usual bot.

At the end of the line the bot waits again and the bubble asks whether to **Keep
playing** (the game goes on as an ordinary one) or **Go again** (a new practice game
with the same course, coach and strength). While the bubble asks, the coach's voice
stays quiet.

The coach's practice messages are text only, one placeholder line per moment shared
by every coach (`PRACTICE_LINES` in `frontend/src/play/PlayGame.tsx`); they have no
catalogue meaning or recording yet. Practice games are saved and reviewed like any
other game.

## Hand-off into Games

When a game ends (checkmate, draw by rule, or the learner resigning) the moves
are written as a PGN with the coach as the opponent and both conditioning ratings
as the Elo headers, imported through the ordinary import path with the learner's
side explicit, and queued for analysis like any imported game. The finished
page shows the result in the page banner with a link to that review; it stays
until closed. Starting a new game while one is active marks the old
one abandoned without saving it.

## HTTP surface

| Method and path | Purpose |
|---|---|
| `GET /api/play/profile` | The level fit, queueing its job when stale |
| `POST /api/play/profile/refresh` | Recompute the fit |
| `GET /api/play/active` | The account's game in progress, if any |
| `POST /api/play` | Start a game: coach, color, opponent kind, rating and optionally a course to practice |
| `GET /api/play/{id}` | Game state with review-shaped frames |
| `POST /api/play/{id}/move` | Save the learner's move at an expected ply; no engine work. With `rewind`, an earlier ply on the learner's turn: the game goes back there first |
| `POST /api/play/{id}/reply` | The bot's answer, computed now, or repeated if it has already moved; off book in practice, the move's comparison with the book instead |
| `POST /api/play/{id}/analyze` | The review's report for one played ply, saved on the game |
| `POST /api/play/{id}/resign` | The learner resigns |
| `GET /api/play/openings` | Courses with repertoire lines to practice |
| `POST /api/play/{id}/takeback` | Opening practice: undo the learner's off-book move |
| `POST /api/play/{id}/carry-on` | Opening practice: keep it and play on as an ordinary game |
| `POST /api/play/{id}/keep-playing` | Opening practice: the line is over; play on as an ordinary game |

Engine and model work runs between database transactions and outside the
account's mutation lock, serialized per account by the variation lock, on the
account's interactive engine (the shared local engine, or a pooled process in
account mode); game review's variation analysis uses the same engine. A reply
re-checks the game under the lock before saving, so a rewind while the bot thinks
answers 409. The game saves each move's engine facts only (`game_review.review_move`,
the same single-move builder variation analysis uses) and renders them with the
current review rules whenever it is read, as the game review does; older rows that
saved rendered reports are stripped back to their facts. The bot's latest reply and
its source are saved, so a repeated reply request returns both. The game's state
machine (rewind, reply, book lookup, take-back) lives in `play/sessions.py`.

## Spoken meanings the game still needs

Chandler owns all coach writing and recording. The game plays with the existing
meanings, which cover every graded move, Book lines, checkmate and automatic draws.

A new game opens with `game-start`, an operational meaning with one line per
coach written for a game against that coach that has not begun. It plays once,
before the first move, for either color (when the learner has Black the bot's
first move waits for it like any other reply); returning to the start of a game
already under way stays quiet, and the review greeting `game-review-opened` is no
longer used in Play. All 30 coaches' clips are recorded; a line without a clip
would show its script line.

Before any game, the setup page shows `play-invitation` in a bubble above the
coach's portrait: one line per coach asking for a game. It claims nothing about
strength, opponent type or color, since the learner has not chosen them yet. All
30 clips are recorded; the clip plays once as the page opens.

These moments have no catalogue entry yet, so they currently show plain page text
or stay silent:

| Proposed meaning | When it would play | Notes |
|---|---|---|
| `game-resigned-learner` | The learner resigns | Learner-perspective result line |
| `game-review-ready` | The finished game's review opens | Bridges playing and looking back |

That is two recordings per coach. Plain-clip rules apply (no squares,
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
