# Spaced repetition

Legal-move selection markers are a board interaction aid, not an answer hint: every legal move is represented regardless of accepted-answer policy. Selecting/reselecting pieces and invalid destination clicks create no attempt or SRS record. Promotion options and capture markers come from python-chess in the cold review response.

FSRSScheduler wraps maintained [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs), pinned/tested at 6.3.2. It uses library defaults, desired retention 0.9 and disabled interval fuzzing for reproducibility. No homegrown scheduling formula.

| Behavior | Rating |
|---|---|
| First legal failure/inaccuracy or reveal | Again |
| First legal success beyond slow threshold | Hard |
| First legal success within threshold | Good |

Easy is not assigned automatically. Illegal inputs never schedule recall. Server-measured raw milliseconds run from persisted session start to submission, before on-demand engine time; all legal attempts are preserved independently. Leaving a page open includes elapsed wall time. Hints are not currently implemented.

First failure schedules Again immediately and leaves the session open on the original board. Retries add attempts but not additional reviews; session_id is unique in reviews. A later solution stays failed for scheduling. Reveal schedules Again if needed and closes the session. Completed submissions are idempotent. API mutations are serialized in the single server process.

Unfinished sessions resume even if failure has moved their due date forward. Otherwise due/relearning material precedes new material, ordered by due date. Avoid the previous card when another is available. Explicit course practice can revisit a card before due. Current game exercises enroll immediately rather than after a gated course graduation step.

The library card is persisted with queryable due/review/lapse columns. Review records include raw timing/failure/reveal flags, behavior policy version, scheduler version and scheduler log, supporting future policy changes without rewriting history.
