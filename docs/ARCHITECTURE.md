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
| backend/trainer/api.py | Application composition, injected factories, per-app resources, shared mutation lock, lifespan and router registration |
| backend/trainer/web.py | LAN token/origin middleware, HTTP error translation, production assets and SPA fallback |
| routes/workspace.py | Health, effective settings and statistics |
| routes/imports.py | Bounded PGN upload and Chess.com import requests |
| routes/jobs.py | Progress, cancellation and retry |
| routes/review.py | Cold/focused queues, session start, move/reveal/explanation requests and archived-session guards |
| routes/games.py | Game library, saved both-color reports, review jobs and history-preserving variation analysis |
| routes/classification.py | Saved classification/enrichment jobs, weaknesses, evidence and classification audits |
| routes/compatibility.py | Course/lesson/repertoire tombstones, historical teaching audits and retained manual exercise creation |

Each router is an ordinary factory receiving its existing resources explicitly. Session factories, engine, scheduler, runner and locks belong to one app instance; there is no global dependency container. HTTP handlers delegate chess and scheduling behavior to existing domain functions.

The composition root retains migration/skill seeding/retirement reconciliation, engine health checks, worker startup and shutdown. Existing app.state settings/sessions/runner and the public MoveRequest/ManualRequest imports remain compatible. All mutations that previously shared the application lock still use that same lock.

## Frontend ownership

| Module in frontend/src | Responsibility |
|---|---|
| App.tsx | Navigation, connection/token form, shared errors, health and selected evidence/deep link |
| Review.tsx | Review/focus session state, answer/reveal actions, counter timer, queue transitions and board composition |
| GameReview.tsx | Game library, illustrated coach, timeline, move selection, in-session variation branches and stale-response isolation |
| Import.tsx | Import source selection, PGN form and job polling/actions |
| Settings.tsx | Effective settings display and local classification job controls |
| EvidenceDialog.tsx | Evidence/audit display, rejection action and dialog focus lifecycle |
| PageTitle.tsx / navigation.ts | Shared title display / existing exercise-and-legacy-unit URL cleanup |
| api.ts | Same-origin HTTP client and response types |

Existing Board, MoveStatus, ReviewExplanation, ChessComImport and Weaknesses components remain separate. The frontend renders backend-provided legal moves, scores and witness frames; it implements no authoritative chess rules. Review keeps its related state and timers together. Inline explanation playback reuses the board, header and layout; the evidence audit is a separate native dialog.

Navigation is Review, Games, Weaknesses, Import, Settings. Removed unit links return to Review. Production serves frontend assets on the API origin; the Vite development proxy targets 127.0.0.1:8000.

## Domain boundaries

- chess_core.py: python-chess rules, legal-position identity, deterministic facts and explicit score types.
- engine.py: native UCI lifecycle, bounded searches and compatible persistent cache; no training policy.
- policy.py: configurable move acceptance over verified scores.
- game_review.py: independent game-review labels, both-color coaching evidence, saved per-ply reports and variation replay. See [Game review](GAME_REVIEW.md); these reports never create training Decisions or scheduled recalls.
- imports.py / chesscom.py: learner resolution, provenance, deduplication and bounded serial public-game download.
- jobs.py / pipeline.py / work_pool.py: persistent ordered jobs, bounded worker pools, cancellation and atomic progress.
- classification.py / local_classifier.py: validated versioned findings, immutable runs, cache identity and active skill evidence.
- curriculum.py: **active weakness priorities**, alongside archived course grouping/sequence helpers. lessons.py contains archived progression helpers.
- reviews.py / explanations.py / scheduling.py / retirement.py: move grading, verified playback, FSRS adapter and persistent retirement.
- practice.py: distinct game-position selection and focused sessions separate from scheduled recall.
- models.py / db.py: relational persistence, SQLite configuration and migrations.

## Local execution and evidence

One coordinator processes queued jobs in order. Within an analysis job, STOCKFISH_WORKERS games run in parallel, each with its own native process and database session. Moves within a game stay ordered. Meaningful decisions flow to CLASSIFICATION_WORKERS local tasks. Each pool admits at most twice its worker count. Cancellation stops new work and lets started tasks save; a game is complete after its classification tasks settle.

Short writes share a lock; rule computation runs outside it. Progress uses atomic SQL increments. Engine cache lock stripes coalesce identical concurrent searches. Interactive grading has a separate serialized engine. Startup recovers unfinished jobs; multiple Uvicorn application processes are unsupported.

Training identity ignores clocks but preserves legal en passant and castling. Engine cache identity also preserves rule clocks and move history. Scores are learner-relative with mate separate from centipawns. Classification caches include saved evidence, rules, parameters and taxonomy; classification weights are not calibrated probabilities.

Classification-only backfills launch no background engines and cannot create/enroll exercises. Optional enrichment uses native workers and stores supplemental references separately from original grading evidence. Focus sessions save attempts/timing but cannot create Review rows or mutate SRSState.

## Classification and audit modules

diagnosis_types.py defines immutable outcomes, findings, square roles and cues. continuations.py owns legal replay, bounded forward endpoint selection and exact tail joins. lichess_patterns.py reconstructs upstream inputs; lichess_witnesses.py records successful predicate moves/squares from the pinned AGPL source in _vendor/lichess_puzzler. tactical_patterns.py owns the application episode/outcome admission boundary. verified_patterns.py, tactical_geometry.py, combination_patterns.py and move_causes.py retain detailed collection witnesses and independent causal/native extensions. explanations.py uses witnesses only from the selected answer's own line.

defensive_probes.py proposes legal counterfactual queries and checks matched native results. enrichment.py owns capped task/query planning and persistence. coverage.py counts current distinct outcomes and mechanisms independently of cumulative run counts. Response schema v3 and rule version 4.0-lichess-8d9faff6 are separate version boundaries.

classification_quality.py and the read-only report script support blinded exports and annotated comparisons. Human and assistant cohorts remain separate; changed evidence cannot inherit stale annotations. Offline assistant assessment is a development activity, not an application dependency or automatic label source. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md).

## Archives, privacy and deployment

Lesson/course and repertoire product routes are tombstones. Due/unfinished-session queries exclude repertoire exercises; direct archived practice is rejected. A one-time migration released nonretired lesson-held cards without resetting their schedules. Historical rows, manual exercises and audit access remain. No production job invokes lesson generation/progression.

OpenAI runtime integration is removed: no model SDK or network calls remain. Historical classification and teaching responses stay local. Only explicit Chess.com imports need outbound network access.

Production LAN binding and an optional shared token are configuration. Do not expose the application directly to the internet. The supported deployment is a source checkout with one Python process serving the built frontend; standalone wheel/static-asset packaging remains future work.

The frontend build generates a public-source snapshot with scripts/source_archive.py, served by the existing /assets mount and linked in Settings. Git-listed public source and licenses are included; private data, secrets and untracked files are excluded. See NOTICE.md and LICHESS_REUSE.md for the GPL/AGPL combination and source-offer workflow.
