# Game insights

**Games → Insights** (`/games/insights`) summarizes patterns across the learner's
saved games. It is read-only: `GET /api/insights` recomputes everything from saved
PGNs and completed original-game reviews on each request, stores nothing and
never starts Stockfish. Filters choose a speed (from the speeds present) and a
period (all time, 30, 90 or 365 days); weekday and time of day use the viewer's
UTC offset.

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
