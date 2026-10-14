# Game insights

The Insights screen has two levels: Overview (`/insights`) and Weaknesses, whose categories sit in the
same tab bar after a divider (stacked as a second row on phones): Tactical patterns (`/insights?section=patterns`, where the Weaknesses link
lands) and Material & mate (`/insights?section=outcomes`). Library statistics
and practice targets stay visibly separate. Old `/weaknesses` links,
including `?category=outcomes`, and `/games/insights` redirect without an extra
history entry.

**Insights → Overview** (`/insights`) summarizes patterns across the learner's
saved games. It is read-only: `GET /api/insights` recomputes everything from saved
PGNs and completed original-game reviews on each request, stores nothing and
never starts Stockfish. Filters choose a speed (from the speeds present) and a
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
are a subset.

| Section | Definition |
| --- | --- |
| Speed | Lichess's estimate, base + 40 × increment: under 180 s bullet, under 480 s blitz, under 1500 s rapid, else classical; `1/…` controls are daily. |
| How games end | A mate, stalemate or insufficient material on the final board wins over the header; otherwise keywords in Chess.com's sentence or Lichess's `Termination` (`Normal` decisive games count as resignations). |
| Openings | The deepest named position reached in the bundled Lichess opening list, grouped by family (text before `:`) and the learner's side. Score counts a draw as half. |
| Leaving the book | The learner's own move that first leaves the book, counted as costly when it is a Mistake-sized loss (100 cp or more) or a Blunder. |
| Clearly winning / lost | A learner-relative evaluation of ±300 cp or a forced mate at any ply. |
| Where the win slipped | In clearly winning games not won, the ply after which the evaluation never returned to +300. |
| Game shapes | One per reviewed game, in this order: let slip, comeback, led throughout (won, reached +150, never below −100), back and forth (the ±150 lead changed sides twice), otherwise unsettled. |
| Move accuracy | The mean of Lichess's per-move accuracy for the learner's moves. It is higher than the volatility-weighted game accuracy and is not a substitute for it. |
| Phases | Six or fewer pieces besides kings and pawns is an endgame; moves 1–10 with more than ten pieces are the opening; otherwise middlegame. |
| Blunders | The game review's own Blunder rule (`blunder_kind`), with the review's rating. |
| After a loss | The next game when it started within 90 minutes of the previous one. A rematch is that next game against the same opponent. |
| Clock | `[%clk]` annotations through the shared clock facts. Time trouble is 30 s or less, or a tenth of the starting time, after a learner move. |
| Mistakes and replies | A move losing 100 cp or more. The reply punishes it, or fails to, by keeping at least half of the evaluation swing. |
| Endgames | The class at the first endgame ply (queen, rook, minor piece or pawn); held when the result is at least as good as the evaluation then (±300 cp). |

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

New local evidence uses weight 1. Recurring groups sort before provisional groups; default recurrence requires two independent games. The priority is rounded to one decimal and used for ordering, not presented as a scientific mastery score. Supporting evidence and decision IDs remain available for audit.

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

Nonretired cards once held by lessons are eligible for Due (migration d17b63e02a48); their schedules, attempts, reviews and lesson records are kept. Teaching-generation routes and retries return 410; historical teaching audit reads/rejections remain available. Backups include the archived records.

A future generated-curriculum redesign requires separate product work. Current
priorities, focused practice and authored Study lessons do not re-enable legacy
lesson generation.
