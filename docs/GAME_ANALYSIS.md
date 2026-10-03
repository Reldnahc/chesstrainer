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
PGN upload. It gives the newest 100 saved games (by play time) the fresh level and
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

The job runner's `sync-poller` thread queues a sync for every saved provider
connection once it is `SYNC_INTERVAL_SECONDS` old (default 300; 0 disables). It
wakes every 30 seconds at most. A sync scans the newest 100 completed games of all
time controls, regardless of month, and imports the ones not yet saved. Pages
no longer trigger provider requests on their own; **Update games** still asks for
an immediate check, at most once per minute per connection.

## Status

`GET /api/analysis/queue` reports the running game and how many requested, fresh
and backfill games are waiting, plus completed and failed totals. Settings shows
it under the connected accounts. `GET /api/jobs` leaves per-game jobs out so
imports stay visible.
