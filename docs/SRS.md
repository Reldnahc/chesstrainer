# Spaced repetition

Legal-move selection markers are a board interaction aid, not an answer hint: every legal move is represented regardless of accepted-answer policy. Selecting/reselecting pieces and invalid destination clicks create no attempt or SRS record. Promotion options and capture markers come from python-chess in the cold review response.

FSRSScheduler wraps maintained [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs), pinned/tested at 6.3.2. It uses library defaults, desired retention 0.9 and disabled interval fuzzing for reproducibility. No homegrown scheduling formula.

| Behavior | Rating |
|---|---|
| First legal failure/inaccuracy or reveal | Again |
| First legal success beyond slow threshold | Hard |
| First legal success within threshold | Good |

Easy is not assigned automatically. Illegal inputs never schedule recall. Server-measured raw milliseconds run from persisted session start to submission, before on-demand engine time; all legal attempts are preserved independently. Leaving a page open includes elapsed wall time. Hints are not currently implemented.

First failure schedules Again immediately and leaves the session open for retries. Retries add attempts but not additional reviews; session_id is unique in reviews. A later solution stays failed for scheduling. Reveal schedules Again if needed and closes the session. Completed submissions are idempotent. API mutations are serialized in the single server process.

Unfinished sessions resume even if failure has moved their due date forward. Otherwise due/relearning material precedes new material, ordered by due date. Avoid the previous card when another is available. Explicit ordinary practice can revisit a card before due. Game exercises remain available independently of classification. Lessons no longer withhold cards; migration d17b63e02a48 releases nonretired lesson-held cards without resetting their schedule.

The library card is persisted with queryable due/review/lapse columns. Review records include raw timing/failure/reveal flags, behavior policy version, scheduler version and scheduler log, supporting future policy changes without rewriting history.

## Returning positions and restart behavior

Completing one attempt is not permanent retirement. The library defaults include learning steps of one and ten minutes: an initial Good normally schedules another recall in ten minutes; Again normally returns in one minute. Later successful recall advances the card to longer intervals. Restart does not reset the serialized card, due date or review history.

Completed feedback displays the saved next due time. A returning cold position identifies only its scheduling reason (learning, relearning, due review, extra practice or unfinished attempt), never its chess concept or answer. The queue falls back to the most recent completed recall in SQLite for repeat avoidance when the browser supplies no last card. Unfinished attempts still take precedence. Completed direct exercise links are removed from the browser URL so refresh returns to the due queue.

Historical lesson sessions have a lesson_item_id and never called FSRS. They are now archived and cannot accept moves or reveals through the API. Their attempts remain preserved separately from ordinary recalls.

## Long-term intervals and mobile feedback

The application permanently retires a review card when its scheduled interval is **strictly greater than RETIRE_AFTER_DAYS (default 100)**. This is application policy layered on FSRS, which still computes intervals unchanged. The interval is the saved due date minus the card's last_review timestamp, not the card's age or remaining time until due. Exactly 100 days stays active. Retirement is applied in the same transaction as the recall and also reconciled for existing qualifying cards at startup.

Retirement persists as retired_at and retired_interval_days. Due dates, serialized cards, attempts and reviews remain intact. Retired cards are excluded from automatic queues (including unfinished sessions) and focused practice; direct review starts/submissions are rejected. Saved lesson access has been removed and historical attempts remain archived. Duplicate imports do not reactivate retired cards. Changing the threshold does not undo existing retirements. There is no automatic unretirement or retirement-count shortcut.

Review now shows the saved next due time as a compact relative interval. Expand Answer & review details for its exact local date/time, explanation, alternatives and source evidence. Phone layouts use the full available board width, allow vertical scrolling to the coach and details, and return to the top when loading the next position. Review timing still includes wall time from session start; leaving a tab open may count as a slow answer. Retired feedback shows retirement instead of a next-review date; the underlying historical due date remains stored.

## Shared review presentation

SRS and game review render through `ReviewWorkspace`, which owns the board
columns, metadata/control slots, header placement, sidebar and responsive sizing.
The board has the same size and position at the same viewport in both modes;
there is no separate SRS width limit or sizing calculation. The evaluation gutter
stays empty in SRS so a cold exercise cannot reveal a score. The title is beside
the board on desktop and above it on phones, using the same header slot as Games.
Browser regression checks compare the actual board, heading and coach geometry
between both modes at three desktop and two phone sizes.

The site shares its width through `--page-width`: 100% up to 1440 CSS pixels for
laptops and smaller screens, and 80% on larger desktops. The header and footer use
the same policy. Review keeps the existing height-based board size and gives the sidebar
the remaining width. If the board and minimum usable sidebar do not fit at 80%,
the centered container expands just enough, up to the viewport width. That
minimum is removed when leaving review so other pages use the shared width. There are
no fixed 1280px/560px page caps.

SRS, focused practice and explanation playback use the same `ReviewCoach`,
`MoveBadge`, `MoveSymbol` and `Board` components as full-game review. Shared styles
live in `frontend/src/review-presentation.css`; `reviewMotion.ts` owns the 280 ms
piece duration, reply delay and live reduced-motion preference. The opponent's
counter starts after the attempted move finishes. Reduced motion disables piece
transitions and badge entrance animations in both modes.

The shared header keeps the SRS title and session count on one row. The coach
reserves title and scrollable message slots in a compact speech bubble, with a
separate action row underneath across checking, retries, success and explanation
playback. Game review adds its evaluation in the bubble's corner; cold SRS keeps
evaluations hidden. Show me why is present but disabled until a
saved attempt exists. Explanation loading preserves the sidebar height to avoid
clamping a phone's scroll position. No additional analysis is requested for these
visual effects.

Training badges say Accepted, Retry or Revealed, based on the existing response;
they do not infer the full-game eight-label classification or an FSRS rating.
Destination badges and highlights appear only after confirmed feedback, on the
corresponding attempted, accepted or revealed move. The opponent's automatic
reply does not inherit the learner's Retry badge. Source, answers, scores and
tactical witnesses remain hidden on a cold board. Scheduling and first-failure
semantics are unchanged.

## Explanation playback

Show me why opens the exact failed move and its saved continuation. Closing Back to attempt restores the same session and original position. Show why after success explains the actual accepted move. Reveal move records Again if needed, applies the primary saved answer on the board and makes its explanation available. GET explanation requests and playback navigation never create attempts, reviews, retirements or scheduling updates; a previous first failure remains failed.

After a failed engine-derived attempt with a verified continuation, Review automatically previews the submitted move followed by the opponent's first PV reply. The board is read-only during this preview. Try again restores the original board without a new review event. Show me why opens deeper playback at the opponent's reply; the return action sits beneath the board alongside playback controls. Missing reply evidence and manual-exercise answer mismatches leave the original board available rather than inventing a counter. Reload resumes the original unfinished attempt.
## Revealing an answer on the board

Reveal move applies the saved primary answer with python-chess and returns the resulting FEN and highlighted squares. The main board animates to that position, including captures, castling, en passant and promotion. Deeper explanation availability does not affect this playback. Revealing after a failed attempt still records only one Again event; returning from the explanation keeps the revealed board displayed.

Archived repertoire positions are excluded from both due and unfinished-session queues. Direct API starts, moves and reveals return 410. Removing repertoire training does not change due dates, card state, eligibility, recall history or retirement; it is not treated as a memory outcome. Existing manual exercises remain reviewable.

## Focused practice is not a scheduled recall

Starting from Weaknesses uses ReviewSession.mode=focus with a validated focus_skill_id. It shares legal move validation, accepted answers, counter previews, reveal and explanation playback with Review, but `record_once` returns without creating a Review or mutating SRSState. Failures, reveals, raw first-response milliseconds, individual attempts and completion time persist separately. New attempts in an old unfinished session recover the original first-response time from its earliest saved attempt.

Focused sessions never enter the unfinished mixed-review queue. Retired positions cannot be practiced through this flow. A focus batch contains at most 12 distinct legal positions and consumes each once before finishing. Reloading the application returns to mixed Review; choosing the skill again may start another practice batch and resume its unfinished attempt. Ordinary mixed reviews retain due/relearning priority, first-failure-once behavior and permanent retirement above 100 days.
