# Architecture

React/TypeScript/Vite is a thin same-origin client for FastAPI. Python 3.12+ owns chess rules, evaluation, grading, local classification, reviews and scheduling. SQLAlchemy 2 and Alembic manage SQLite with foreign keys, WAL and a busy timeout. Run one application process; no Redis, external worker service or cloud database is needed.

## HTTP interface ownership

Shared hosting uses one database with explicit `user_id` ownership across private
tables. Account-bound ORM sessions enforce reads and writes for both HTTP routes
and background workers. The shared engine cache and skill taxonomy are global;
account credentials and revocable device sessions live in that same SQLite file.
See [ACCOUNTS.md](ACCOUNTS.md) for migration and recovery.

Recent-game sync uses a separate fetch-only worker lane. It remembers the account's
Chess.com username, checks at most once a minute while Games/Settings is visible,
and fetches up to 50 completed games from the current and previous month. Repeated
checks reuse a checkpoint rather than accumulating duplicate raw PGNs or gradually
backfilling older games. Game ordering uses completion time from Chess.com, with
PGN UTC date/time as the upload fallback. Sync never invokes the analysis pipeline.
Whole-game review and training analysis are separately requested from the game.

| Module | Responsibility |
|---|---|
| backend/trainer/api.py | One application and router graph, shared resources, database maintenance and lifespan |
| multiuser.py | Cookie authentication, account/profile endpoints and request authentication; no child applications |
| workspaces.py | Explicit account scopes for requests/jobs, bound sessions and locks retained only during active work |
| jobs.py / job_queue.py / job_execution.py | Bounded host workers, scheduling metadata, and account-bound job execution |
| backend/trainer/web.py | LAN token/origin middleware, HTTP error translation, production assets and SPA fallback |
| engine_health.py | Thread-safe last-observed engine availability shared across interactive requests and workers; no native process starts during a health read |
| routes/workspace.py | Health, effective settings and statistics |
| routes/imports.py | Bounded PGN upload and Chess.com import requests |
| routes/jobs.py | Progress, cancellation and retry |
| routes/review.py | Cold/focused queues, session start, move/reveal/explanation requests and archived-session guards |
| routes/games.py | Game library, saved both-color reports, review jobs and history-preserving variation analysis |
| routes/classification.py | Saved classification/enrichment jobs, weaknesses, evidence and classification audits |
| routes/compatibility.py | Course/lesson/repertoire tombstones, historical teaching audits and retained manual exercise creation |
| contracts/ | Explicit HTTP response schemas grouped by endpoint domain; reused chess evidence types retain their original owners |

Each router is registered once and receives shared configuration/services explicitly.
Handlers receive a `CurrentWorkspace` FastAPI dependency derived from the authenticated
request (or reserved `local` identity). It carries an account-bound session factory,
mutation/variation locks and a lazy interactive engine handle. Account scopes are not
cached applications and contain no workers. Lock leases are released when the last
request/job for that account finishes. HTTP handlers continue to delegate chess and
scheduling behavior to existing domain functions.

The composition root performs migrations, global skill seeding and retirement
reconciliation once, and owns worker/engine shutdown. Hosted retirement maintenance
only visits enabled accounts, leaving disabled/local history unchanged. Administrative sessions are
restricted to startup maintenance and job scheduling metadata; request handlers and
job execution always use bound sessions. `app.state.sessions` remains the local
workspace factory for offline/test use. Hosted scopes are obtained through
`app.state.workspaces.open(user_id)`. The public MoveRequest/ManualRequest imports
remain compatible. Concurrent requests and jobs for one account share its mutation
lock, while other accounts have independent locks.

## Frontend ownership

| Module in frontend/src | Responsibility |
|---|---|
| App.tsx | Navigation, connection/token form, shared errors, health and selected evidence/deep link |
| Review.tsx / srsReview/ReviewPanel.tsx / ReviewDetails.tsx | SRS workspace composition, coach actions and review details |
| srsReview/useReviewSession.ts | Cold/focused queues, grading, reveal and completion accounting; ignores responses after session disposal |
| srsReview/useReviewPlayback.ts | Counter-reply timer, explanation frames, stable panel height and focus restoration |
| GameReview.tsx / gameReview/GameWorkspace.tsx | Game library and composition of the existing shared board, coach and workspace |
| gameReview/useGameReviewSession.ts | Original game, automatic review start, incremental polling, pause/resume and progress ownership |
| gameReview/useGameExploration.ts | Variation history, legal-position requests, board navigation and return-to-game behavior |
| gameReview/usePositionAnalysis.ts | Serialized engine requests, per-history cache, browsing debounce and stale-response isolation |
| gameReview/Players.tsx / PositionCoach.tsx / ReviewControls.tsx / ReviewMoves.tsx / ReviewSummary.tsx | Focused player, coach, navigation, notation and progress/quality presentation |
| Import.tsx | Import source selection, PGN form and job polling/actions |
| Settings.tsx | Effective settings display and local classification job controls |
| EvidenceDialog.tsx | Evidence/audit display, rejection action and dialog focus lifecycle |
| PageTitle.tsx | Shared title display |
| navigation.ts / Link.tsx | URL routing, browser history, scroll restoration, legacy link cleanup and normal anchor/modifier-click behavior |
| api.ts / api.generated.ts | Same-origin typed OpenAPI client, authentication/error handling and generated request/response contracts |

Existing Board, MoveStatus, ReviewExplanation, ChessComImport and Weaknesses components remain separate. The frontend renders backend-provided legal moves, scores and witness frames; it implements no authoritative chess rules. Review session hooks own requests and state transitions, while presentation components compose the shared Board, ReviewCoach and ReviewWorkspace without duplicating their sizing or animations. SRS playback never submits another recall; game variation analysis never changes the original game. Request generations and effect cleanup prevent disposed or superseded work from updating the current session. Inline explanation playback reuses the board, header and layout; the evidence audit is a separate native dialog.

`styles.css` is the stylesheet entry point. `base.css` owns application chrome,
element defaults and common form/surface utilities. `board.css` owns the shared
board, legal-move markers, tactical highlights, rating animation and retry effects;
`review-presentation.css` owns shared review geometry, coaching and rating colors.
SRS and game-specific panels live in `srs-review.css` and `game-review.css`.
History, imports, account/sync forms and evidence each have their own stylesheet.
Keep a component's normal and responsive rules together, with one block per
breakpoint, rather than appending overrides to the entry point. Shared review
presentation precedes the base element defaults to preserve the established
cascade. Board dimensions and motion remain common to both review experiences.

Navigation is Review, Games, Weaknesses, Import, Settings. A small History API
router renders `/review`, `/games`, `/games/:id`, `/weaknesses`, `/import` and
`/settings`. Screen/game links push history entries; `popstate` restores the
destination. The root URL aliases `/review` with `replaceState`, preserving old
`?exercise=` bookmarks. Removed `?unit=` links return to mixed Review without
starting a lesson. Unknown paths show a recoverable not-found screen.

`?focus=<skill>` selects focused practice, `?page=N` records the library page
(also retained on game links), and `?ply=N` records a game's selected half-move.
Move selection and completed-exercise URL cleanup replace the current entry
without remounting the view or adding history. Variations stay in memory while
the URL retains their original-game return point. Scroll positions are kept per
history entry; restoration waits for asynchronously loaded page content and
yields to user scrolling. Links retain native new-tab behavior and browser
keyboard shortcuts are not intercepted by the game board.

Production already serves `index.html` for frontend paths on the API origin,
including direct game URLs; `/api/` and `/assets/` retain their existing handling.
No reverse-proxy rewrite is needed when forwarding the whole site to the app.
The Vite development proxy targets 127.0.0.1:8000.

## API contract ownership

FastAPI response models validate all active success payloads. New response models
reject undeclared fields; optional fields use `response_model_exclude_unset` to
preserve existing omissions. Cold SRS responses have their own schemas and cannot
accidentally acquire answers from a richer feedback response. Historical audit
responses and saved fact dictionaries intentionally contain versioned JSON, while
their surrounding response fields are explicit.

`scripts/export_api_contract.py` exports the hosted API's OpenAPI contract without
starting the application lifespan, opening a database or starting Stockfish. Local
and hosted API snapshots are both verified against it. `frontend/scripts/api-types.mjs`
uses pinned openapi-typescript to derive `api.generated.ts`, including binary
multipart upload types. The openapi-fetch client infers response types from literal
endpoint paths and checks request bodies, path parameters and query parameters.
UI aliases refer to generated schemas; they do not repeat server field definitions.
Game session state explicitly accepts compact polling reports alongside the richer
initial reports. Explanation square-role overlays remain transient UI state.

Backend CI detects schema drift. Frontend builds reject stale generated types and
compile negative type tests that verify invalid endpoints, missing parameters,
incompatible request values and missing response fields remain errors. Regeneration
commands and the intentional-change review process are in [TESTING.md](TESTING.md).

## Domain boundaries

- chess_core.py: python-chess rules, legal-position identity, deterministic facts, explicit score types and shared legal-move interaction serialization. Callers retain termination policy: whole-game review stops legal options at an outcome, while SRS exposes all legal interaction aids.
- engine.py: native UCI lifecycle, bounded searches and compatible persistent cache; no training policy.
- policy.py: configurable move acceptance over verified scores.
- game_review.py: independent game-review labels, both-color coaching evidence, saved per-ply reports and variation replay. See [Game review](GAME_REVIEW.md); these reports never create training Decisions or scheduled recalls.
- review_cues.py: projects saved immediate witnesses into current-board arrows and square roles without new engine searches; skips later witnesses and checks attack geometry with python-chess. Cues are derived when reports are read, so existing reviews need no reanalysis.
- imports.py / chesscom.py: learner resolution, provenance, deduplication and bounded serial public-game download.
- jobs.py / job_queue.py / job_execution.py / pipeline.py / work_pool.py: persistent ordered jobs, host-wide scheduling, account-bound execution, bounded worker pools, cancellation and atomic progress.
- classification.py / local_classifier.py: validated versioned findings, immutable runs, cache identity and active skill evidence. `classification_stages.py` separates root validation, line outcome admission, defense checks, provenance and abstention reasons; the classifier preserves ordered aggregation and primary-skill selection.
- weaknesses.py: active weakness priorities with read-only historical attempt statistics; no course generation or progression.
- reviews.py / explanations.py / scheduling.py / retirement.py: move grading, verified playback, FSRS adapter and persistent retirement.
- practice.py: distinct game-position selection and focused sessions separate from scheduled recall.
- models.py / db.py: relational persistence, SQLite configuration and migrations.

## Local execution and evidence

In account mode, one host-wide runner has `ENGINE_SLOTS` analysis coordinators and
one fetch-only coordinator, independent of the number of registered accounts. Local
mode retains one analysis coordinator and one fetch-only coordinator. Idle polling
is bounded by that fixed worker count. The queue selects the oldest eligible job
and allows only one analysis job per account at a time; busy accounts do not block
other accounts from free workers. The fetch lane remains independent of analysis.
Disabled accounts are excluded in hosted mode, including the reserved local user.

The scheduler reads only scheduling metadata across accounts. Each claimed job's
owner is captured before creating its short-lived account scope; that session
factory is explicitly passed into every pipeline worker and engine handle. There
is no mutable global/current-account identity. Startup recovers unfinished jobs
without login or creating per-user runtimes. Shutdown signals all active work,
drains coordinators and their child pools, then closes the shared engines.

Within an analysis job, STOCKFISH_WORKERS games run in parallel with independent
database sessions. Native processes come from the shared engine pool in account
mode and belong to the job in local mode. Moves within a game stay ordered.
Meaningful decisions flow to CLASSIFICATION_WORKERS local tasks. Each pool admits
at most twice its worker count. Cancellation stops new work and lets started tasks
save; a game is complete after its classification tasks settle.

Full-game review jobs instead parallelize independent move evidence, with at most
`min(STOCKFISH_WORKERS, ENGINE_SLOTS)` outstanding moves. The coordinator commits
their reports and progress together in game order, supplying the preceding score
for Great labels. It reuses saved reports and drains active work on cancellation.
This uses the existing account engine pool and does not change search/cache policy.
The UI starts/resumes once per game opening and receives incremental display reports
from `GET /api/games/:id/review?after=N`; the cursor advances only through reports
actually received. Ordinary mainline browsing uses those reports instead of starting
duplicate searches while the job runs; manual variations remain interactive.

Short writes share an account's lock; rule computation runs outside it. Progress
uses atomic SQL increments. Engine cache lock stripes coalesce identical concurrent
searches. Local interactive grading has a separate serialized engine; hosted
grading and variations use the same bounded native pool as background work.
Multiple Uvicorn application processes are unsupported.

Engine health starts as `unchecked` (`engine_available: null`) until a real startup
or search succeeds or fails. Local mode checks at startup; account mode stays lazy.
One host-wide observer wraps native engines before pooling and explicitly forwards
account-session rebinding. Successful use reports `ready`, failures report
`unavailable`, and the next success clears the error. This describes the last
observed operation, not a background liveness probe or occupied-slot count. Normal
engine cleanup leaves that observation intact. A saved-executable mismatch is a
position-specific verification error, not a host outage. Health errors are generic;
full exception chains belong in server logs. JSON job diagnostics include the job
ID, error type and traceback, while unexpected client errors remain sanitized.

Training identity ignores clocks but preserves legal en passant and castling. Engine cache identity also preserves rule clocks and move history. Scores are learner-relative with mate separate from centipawns. Classification caches include saved evidence, rules, parameters and taxonomy; classification weights are not calibrated probabilities.

Classification-only backfills launch no background engines and cannot create/enroll exercises. Optional enrichment uses native workers and stores supplemental references separately from original grading evidence. Focus sessions save attempts/timing but cannot create Review rows or mutate SRSState.

## Classification and audit modules

diagnosis_types.py defines immutable outcomes, findings, square roles and cues. continuations.py owns legal replay, bounded forward endpoint selection and exact tail joins. lichess_patterns.py reconstructs upstream inputs; lichess_witnesses.py records successful predicate moves/squares from the pinned AGPL source in _vendor/lichess_puzzler. tactical_patterns.py owns the application episode/outcome admission boundary. verified_patterns.py bounds and orders events; verified_motifs.py owns independent capture, fork, promotion, check, pin, skewer, defender-removal and back-rank rules. tactical_geometry.py, combination_patterns.py and move_causes.py retain shared geometry and independent causal/native extensions. explanations.py uses witnesses only from the selected answer's own line.

defensive_probes.py proposes legal counterfactual queries and checks matched native results. enrichment.py owns capped task/query planning and persistence. coverage.py counts current distinct outcomes and mechanisms independently of cumulative run counts. Response schema v3 and rule version 4.0-lichess-8d9faff6 are separate version boundaries.

Geometric detectors construct findings through `tactical_geometry.witness`, which
preserves actor, move/frame, square-role and rule-version metadata. Mate/material
outcomes and pinned upstream witnesses retain their distinct constructors and
provenance. Consumers import replay/endpoint helpers directly from `continuations`;
`local_classifier` does not re-export those helpers.

classification_quality.py and the read-only report script support blinded exports and annotated comparisons. Human and assistant cohorts remain separate; changed evidence cannot inherit stale annotations. Offline assistant assessment is a development activity, not an application dependency or automatic label source. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md).

## Archives, privacy and deployment

Lesson/course and repertoire product routes are tombstones. Due/unfinished-session queries exclude repertoire exercises; direct archived practice is rejected. A one-time migration released nonretired lesson-held cards without resetting their schedules. Historical rows, manual exercises and teaching audit/rejection access remain. Course generation and lesson progression code have been removed; active review cannot start, resume or finish a lesson attempt, including through direct domain calls. Normal review feedback no longer carries a `lesson_result` field. Tests seed explicit historical rows rather than keeping an unused course builder alive.

OpenAI runtime integration is removed: no model SDK or network calls remain. Historical classification and teaching responses stay local. Only explicit Chess.com imports need outbound network access.

Production LAN binding and an optional shared token are configuration. Do not expose the application directly to the internet. The supported deployment is a source checkout with one Python process serving the built frontend; standalone wheel/static-asset packaging remains future work.

The frontend build generates a public-source snapshot with scripts/source_archive.py, served by the existing /assets mount and linked in Settings. Git-listed public source and licenses are included; private data, secrets and untracked files are excluded. See NOTICE.md and LICHESS_REUSE.md for the GPL/AGPL combination and source-offer workflow.
