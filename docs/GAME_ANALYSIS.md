# Automatic game analysis

Every saved game is analyzed without the learner asking. There is no
"also analyze" choice on imports.

## One job per game

Each game has one `game_review` job (linked by `game_reviews.job_id`). It runs
the full-game review (baseline, refinement and human evidence; see
[GAME_REVIEW.md](GAME_REVIEW.md)) and then the training pass for the learner's
moves ([ANALYSIS_PIPELINE.md](ANALYSIS_PIPELINE.md)). Insights reads the review;
Weaknesses and practice read the training decisions. A training failure marks
the job failed, and retrying it reuses the cached review searches.

`trainer.game_analysis.queue_library` runs after every sync, provider import and
PGN upload. It gives the newest `ANALYSIS_RECENT_GAMES` (100) saved games (by play time) the fresh level and
every other game without a job the backfill level. Queuing never lowers a queued
job's level and never restarts a completed, failed or cancelled job.

## Priority

`analysis_jobs.priority` orders the queue; lower runs sooner.

| Level | Value | Source |
| --- | --- | --- |
| Requested | 0 | The learner chose **Start game review**; also every non-game job. |
| Fresh | 10 | One of the 100 most recently played games. |
| Backfill | 20 | Any older game, typically from **Import older games** or a PGN upload. |

Within a level, the most recently played game runs first. One analysis job runs
per account at a time, so a requested game waits at most for the job already
running.

## Polling

The job runner's `sync-poller` thread runs a round every `SYNC_INTERVAL_SECONDS`
(default 60, measured from round start; 0 disables). A round longer than the
interval is followed by the next immediately, so rounds never overlap. A round first asks each provider which saved
connections changed, then queues a sync only for those. A sync reads the
`SYNC_GAMES` (10) newest completed games of all time controls, regardless of month, and imports the
ones not yet saved. Every connection also gets a full sync at least every
`SYNC_FULL_SECONDS` (600 seconds), in case a change marker misses something.

| Provider | Change check | Why it is safe every minute |
| --- | --- | --- |
| Chess.com | `GET` of each player's current-month archive with the saved `ETag` (`If-None-Match`); unchanged answers 304. 404 means no games this month. | Chess.com has no multi-player endpoint, but [serial access is unlimited](https://www.chess.com/news/view/published-data-api); only parallel requests can see 429. Archives carry `max-age=5`. |
| Lichess | One `POST /api/users` per `SYNC_LICHESS_BATCH` (300) players; per-speed game counts plus total play time form the signature. | Lichess asks for [one request at a time](https://lichess.org/page/api-tips) and a minute's pause after 429; a round is a single request for most hosts. |

All provider traffic, including change checks and syncs, is serial under the
runner's host-wide provider lock. A 429 starts that provider's one-minute
cooldown, during which rounds skip it. Markers live in
`provider_connections.poll_state`. Pages no longer trigger provider requests on
their own; **Update games** still asks for an immediate sync, at most once per
minute per connection.

## Away accounts

Every authenticated request records `users.last_seen_at` (written at most every
10 minutes per account). Rounds skip accounts not seen for `SYNC_AWAY_DAYS` (7) days. The first
request after such a gap stores the previous visit in `users.away_since`; the app
shows a welcome-back notice (`GET /api/welcome-back`) saying checks resumed and
that missing older games can be brought in with **Import older games**. Dismissing
it (`POST /api/welcome-back/dismiss`) clears `away_since`. Polling resumes on the
next round; games played while away beyond the 10 newest need a manual import.

## Status

`GET /api/analysis/queue` reports the running game and how many requested, fresh
and backfill games are waiting, plus completed and failed totals. Settings shows
it under the connected accounts. `GET /api/jobs` leaves per-game jobs out so
imports stay visible.
