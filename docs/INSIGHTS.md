# Game insights

The Insights screen has two levels: Overview (`/insights`) and Weaknesses, whose categories sit in the
same tab bar after a divider (stacked as a second row on phones): Tactical patterns (`/insights?section=patterns`, where the Weaknesses link
lands) and Material & mate (`/insights?section=outcomes`). Library statistics
and practice targets stay visibly separate. Old `/weaknesses` links,
including `?category=outcomes`, and `/games/insights` redirect without an extra
history entry.

**Insights → Overview** (`/insights`) summarizes patterns across the learner's
saved games. `GET /api/insights` computes everything from saved PGNs and
completed original-game reviews and never starts Stockfish. Each game's facts are
replayed once and saved in `insight_facts`, compactly (about 1.7 KB for an 80-ply
game), under a key of everything they are built from: the PGN, players, dates,
learner colour, rating, the completed review's revision (which a saved report or
an adopted refinement bumps), the python-chess and pydantic versions, and a digest
of the application's code and bundled data, so an upgrade rebuilds them (the first
Insights request after it replays the library once). A request reads the saved facts back and replays
only games whose key changed or whose row cannot be read, saving rebuilt facts
every 500 games. No library is replayed per request, the facts survive a restart,
and nothing is held in memory between requests; each request still unpacks the
library's facts while it summarizes them (about 15 KB per game). Filters are
applied to those facts on every request. Filters choose a speed (from the speeds present) and a
period (all time, 30, 90 or 365 days); weekday and time of day use the viewer's
UTC offset.

Unrated games stay out of every Insights number, including the Weaknesses
rankings; they remain in the library, reviews, puzzles and drills. `games.rated`
comes from the Chess.com and Lichess APIs on import (a re-import fills it in for
games already saved) or from a Lichess-style `Event` header ("Rated ..." or
"Casual ...") in a PGN. Games whose source does not say, including Chess.com games
saved before the flag existed, count as rated until a re-import supplies it.

## Data each section uses

PGN-only sections use every selected game: results by weekday and time of day,
how games end, winning and losing runs, the highest-rated win, rating series per
site and speed, openings by side and score, clock pressure and think time.
Evaluation-based sections use only games whose review completed with every ply
evaluated, and name how many games that is. The page says so when reviewed games
are a subset. Games saved from Play count everywhere except the rating sections:
their Elo headers hold the bot's setting and the learner's fitted model level, not
ratings, so they never become a highest-rated win or a rating series point.

| Section | Definition |
| --- | --- |
| Speed | Each provider's own rating pool from the estimate base + 40 × increment. Chess.com: under 180 s bullet, under 600 s blitz, else rapid. Lichess and other PGNs: under 180 s bullet, under 480 s blitz, under 1500 s rapid, else classical. `1/…` controls are daily. |
| How games end | A mate, stalemate or insufficient material on the final board wins over the header; otherwise keywords in Chess.com's sentence (with the players' names removed, so a username is never read as a keyword) or Lichess's `Termination`. `Normal` decisive games count as resignations; a `Normal` draw is a repetition when the final position has occurred three times, a fifty-move draw when the fifty-move count is reached, else agreement. |
| Openings | The deepest named position reached in the bundled Lichess opening list, grouped by family (text before `:`) and the learner's side. Score counts a draw as half. |
| Leaving the book | The learner's own move that leaves the book for good (the move after the game's last catalogue move, the review's departure rule), counted as costly when it is a Mistake-sized loss (100 cp or more) or a Blunder. |
| Clearly winning / lost | A learner-relative evaluation of ±300 cp or a forced mate at any ply. |
| Where the win slipped | In clearly winning games not won, the ply after which the evaluation never returned to +300. |
| Game shapes | One per reviewed game, in this order: let slip, comeback, stayed ahead (won, reached +150 and never back to 0 or below after that, never below −100), back and forth (the ±150 lead changed sides twice), otherwise unsettled. |
| Move accuracy | The mean of Lichess's per-move accuracy for the learner's moves. It is usually higher than the volatility-weighted game accuracy, though not always, and is not a substitute for it. |
| Phases | The shared phase rule that decision facts and puzzle themes use (`chess_core.game_phase`): 26 or fewer points of material on the board, counting pawns 1, knights and bishops 3, rooks 5 and queens 9, is an endgame; otherwise moves 1–10 are the opening and later moves the middlegame. |
| Blunders | The game review's own Blunder rule (`blunder_kind`) with the same rating the review's badges use (`game_library.mover_rating`): the moving player's PGN rating, else the review's stored rating. |
| After a loss | The next game when it started within 90 minutes of the previous one's start. Start times come from the PGN's `UTCDate`/`UTCTime`, since a synced game's saved time is when it ended. A rematch is that next game against the same opponent. |
| Clock | `[%clk]` annotations through the shared clock facts. Time trouble is 30 s or less, or a tenth of the starting time, after a learner move. |
| Mistakes and replies | A move losing 100 cp or more. The reply punishes it, or fails to, by keeping at least half of the evaluation swing, measured from the mistake's own search (its best move's score) as its loss is. |
| Endgames | The class at the first endgame position: queen, rook or minor-piece endings have only that kind of piece besides kings and pawns, pawn endings none, and any other combination is mixed. Held when the result is at least as good as the evaluation of that position, before its first move (±300 cp). |

These are descriptions of saved evidence, not ratings of skill or mastery. No
section presents a mastery score or diagnoses what the player was thinking.

## Not yet built

- Tactics found out of the chances available, by motif. The classifier labels the
  learner's mistakes; counting found chances needs motif detection on positions
  the learner played well.
- Coach commentary. Insights show no coach and need no dialogue; any future coach
  reaction would need new meanings written and recorded first.

## Weakness priorities and archived curriculum

The Weaknesses section organizes recurring weaknesses and focused practice.
Legacy generated courses, lesson progression and curriculum navigation are
retired. Authored [Study lessons](STUDY.md#guided-lessons) do not use those
historical tables or settings.

### Evidence and classification

The latest successful local rule run determines active SkillEvidence. ClassificationRun preserves current and historical responses with provider/version provenance. Failed or malformed runs preserve current labels; a successful abstention removes earlier asserted labels. Cached runs restore the matching projection without recomputation.

The learner can reject unsupported findings through an audit. Rejected responses remain saved but inactive; identical rejected rule/evidence/configuration results are not automatically revived. Objective analysis, accepted answers and review history remain unchanged. Old model evidence is inactive, with audits retained.

Outcomes and mechanisms use controlled IDs. Local findings carry aggregation weights, not measured probabilities. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for current taxonomy and evidence gates.

### Current priority calculation

The live Weaknesses route calls priorities() in weaknesses.py. It uses these explicit heuristics:

1. Independence means distinct game IDs. Each game contributes its maximum evidence weight multiplied by bounded severity and recency.
2. Mate transitions have severity 3. Ordinary loss scales by 150 cp, capped at 3. Recency halves over 90 days using decision analysis time, not the historical game's date.
3. Listed foundational skills receive a 1.4 multiplier for target ratings up to 1600. This is a pedagogical preference, not an Elo-to-centipawn conversion.
4. Up to 30 recent ordinary SRS recalls add failure and slow-response fractions: multiply by 1 + failure fraction + 0.2 times slow fraction.
5. For compatibility, up to 30 completed **historical lesson attempts** still contribute a bounded multiplier of 1 + 0.25 times their failure fraction. New attempts in that legacy domain cannot be created by the app; authored Study lessons do not contribute to this multiplier.
6. Five or more recent SRS recalls with no failures reduce priority by 20%. The label is improving retention, not proven chess mastery.

New local evidence uses weight 1. Recurring groups sort before provisional groups; default recurrence requires two independent games. A recurring card's badge names its game count ("Across 2 games"), and its **Recent reviews** figure is the number of those latest recalls, at most 30. The priority is rounded to one decimal and used for ordering, not presented as a scientific mastery score. Supporting evidence and decision IDs remain available for audit.

Focused attempts have separate recent attempt/failure counts. They do not change the ordinary recall fractions above or become evidence of blind recall.

### Focused practice

Weaknesses separates outcomes from supported tactical mechanisms, displays distinct positions and game diversity, and exposes all supporting examples. Choosing a skill selects up to 12 distinct nonretired, eligible game positions.

Selection rotates through source games. Within a game it favors more recorded lapses, then recent evidence. Different decisions with the same legal-position key appear once per batch. The batch lives in the browser; reopening a skill may deliberately repeat practice while resuming an unfinished attempt.

First-failure/reveal history, raw first-response time and completion time are persisted separately from ordinary reviews. Focused practice shares grading and playback with Review but never changes FSRS. See [spaced repetition](STUDY.md#spaced-repetition).

### Archived compatibility

Historical course grouping, Diagnose/Teach/Drill/Check/Retain revisions and lesson
progress remain in database records for compatibility. Their generation and
progression are not active workflows. Imports and classification do not build
courses or withhold new cards. Legacy course/lesson product routes return HTTP
410, and old lesson review sessions cannot accept moves or reveals.

Nonretired cards once held by lessons are eligible for Due (migration d17b63e02a48); their schedules, attempts and reviews are kept, and lesson attempts stay as review sessions with `mode="lesson"`. The lesson, course and teaching tables themselves were dropped (migration 4ca1e88adf37). Teaching routes return 410.

A future generated-curriculum redesign requires separate product work. Current
priorities, focused practice and authored Study lessons do not re-enable legacy
lesson generation.
