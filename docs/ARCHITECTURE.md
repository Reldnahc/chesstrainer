# Architecture

The authored Study lesson framework lives in `trainer/study_lessons`: content
validation, a pure player reducer, account-owned sessions/progress and narrow
current-position projections. `routes/study_lessons.py` applies the existing
workspace ownership/mutation boundary. On the frontend `LessonLibrary` and
`LessonPlayer` use the existing board/workspace/coach; `useStudyPlayback` shares
display-only frame timing with puzzles. No animation drives durable progress.
See [Study](STUDY.md) for content, session and authority contracts.

`trainer/opening_studies` normalizes pinned catalogue/course lines, projects active
contributions into existing opening exercises, and snapshots each recall's answer
authority. `reviews.py` keeps the common scheduler and first-failure behavior;
opening-specific grading/explanations consult the saved snapshot. Before any new
FSRS call, current eligible authority is checked under the account mutation lock
and a conditional database write. Dedicated line practice constructs a pinned
rehearsal in the existing lesson player. Source-specific frontend coaching avoids
describing an out-of-repertoire move as an objective mistake.

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
| human_models/ | Versioned human-policy contracts, domain provenance, private durable cache, bounded shared native workers and explicit checkpoint setup; independent of Stockfish and grading |
| review_intelligence/ | Versioned difficulty, event/clock/positional facts, game relationships and owned history; bounded refinement planning uses the existing engine authority |
| routes/workspace.py | Health, effective settings, account-owned coach/interface preferences and statistics |
| preferences.py | Validated coach and motion choices in one owned user_preferences row; field-specific writes preserve independent choices and missing/unsupported choices have safe read defaults |
| routes/imports.py | Bounded PGN upload and Chess.com import requests |
| routes/jobs.py | Progress, cancellation and retry |
| routes/review.py | Cold/focused queues, session start, move/reveal/explanation requests and archived-session guards |
| puzzles/ / routes/puzzles.py | Versioned provider definitions, private session snapshots and atomic multi-move practice; no engine or scheduler dependency |
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
| study/ | Study landing, opening catalogue/enrollment, lesson and puzzle players; shared Board/ReviewWorkspace/ReviewCoach presentation over server-committed state |
| Review.tsx / srsReview/ReviewPanel.tsx / ReviewDetails.tsx | SRS workspace composition, coach actions and review details |
| srsReview/useReviewSession.ts | Cold/focused queues, grading, reveal and completion accounting; ignores responses after session disposal |
| srsReview/useReviewPlayback.ts | Counter-reply timer, explanation frames, stable panel height and focus restoration |
| GameReview.tsx / gameReview/GameWorkspace.tsx | Game library and composition of the existing shared board, coach and workspace |
| ReviewCoach.tsx | Common portrait with optional caption, speech bubble, action row and optional context line; both review modes and explanation playback share button geometry |
| gameReview/useGameReviewSession.ts | Original game, automatic review start, incremental polling, pause/resume and progress ownership |
| gameReview/useGameExploration.ts | Variation history, legal-position requests, board navigation and return-to-game behavior |
| gameReview/usePositionAnalysis.ts | Serialized engine requests, per-history cache, browsing debounce and stale-response isolation |
| gameReview/Players.tsx / PositionCoach.tsx / ReviewControls.tsx / ReviewMoves.tsx / ReviewSummary.tsx | Focused player, coach, navigation, notation and progress/quality presentation |
| Import.tsx | Import source selection, PGN form and job polling/actions |
| Settings.tsx | Account, connected games, coach/interface preferences and classification job controls |
| coach/reactions.ts | Typed chess/SRS events translated into semantic expressions; no artwork dependencies |
| coach/CoachProvider.tsx / CoachSettings.tsx | Account-bound preference loading, saving, retry and selection UI |
| useSavedPreferences.ts | Shared account-bound preference load/save lifecycle, failure recovery and stale-response guards |
| MotionProvider.tsx / MotionSettings.tsx / motion.ts / MotionSelect.tsx | Saved piece/interface motion, common device-default override rules and shared motion selector |
| coach/model.ts / registry.ts / motionVocabulary.ts / usePerformance.ts | Coach definitions, explicit display groups, compatibility fallbacks, expression-specific idle pools, event dwell and one-shot reactions |
| useReducedMotion.ts | Shared event-driven device preference, native subscription cleanup and resynchronization for portraits, boards and controls |
| coach/classic/ / coach/human/ | Original character, reusable human expression poses, facial layers and hand artwork |
| coach/studies/ / coach/cast/ / coach/studio/ | Shared registered character artwork, cast-specific SVG rigs and a separate development-only expression/idle comparison entry |
| dialogue/ | Semantic claims and deterministic utterances shared by review, branches and authorized practice; registry-owned personalities rephrase facts with neutral fallback |
| EvidenceDialog.tsx | Evidence/audit display, rejection action and dialog focus lifecycle |
| PageTitle.tsx | Shared title display |
| navigation.ts / Link.tsx | URL routing, browser history, scroll restoration, legacy link cleanup and normal anchor/modifier-click behavior |
| api.ts / api.generated.ts | Same-origin typed OpenAPI client, authentication/error handling and generated request/response contracts |

Existing Board, MoveStatus, ReviewExplanation, ChessComImport and Weaknesses components remain separate. The frontend renders backend-provided legal moves, scores and witness frames; it implements no authoritative chess rules. Review session hooks own requests and state transitions, while presentation components compose the shared Board, ReviewCoach and ReviewWorkspace without duplicating their sizing or animations. SRS playback never submits another recall; game variation analysis never changes the original game. Request generations and effect cleanup prevent disposed or superseded work from updating the current session. Inline explanation playback reuses the board, header and layout; the evidence audit is a separate native dialog.

`styles.css` is the application stylesheet entry point. `foundation.css` owns
shared fonts, tokens, element defaults and common form/surface utilities;
`base.css` owns application chrome and page-specific layout. `board.css` owns the shared
board, legal-move markers, tactical highlights, rating animation and retry effects;
`review-presentation.css` owns shared SRS/game workspace geometry, while
`coach-presentation.css` owns the coach bubble, actions, evaluation and rating colors.
SRS and game-specific panels live in `srs-review.css` and `game-review.css`.
History, imports, account/sync forms and evidence each have their own stylesheet.
Keep a component's normal and responsive rules together, with one block per
breakpoint, rather than appending overrides to the entry point. Shared review
presentation precedes the base element defaults to preserve the established
cascade. Board dimensions and motion remain common to both review experiences.
`interface-motion.css` applies the resolved account motion choice to all interface CSS
animations/transitions, excluding coach portrait subtrees with their independent
choice. `Board` uses that same resolved state for native piece movement. Browser
reduced motion supplies the default; explicit Animated/Still choices take
precedence. Preferences remain still while loading or after a failed initial load.
`motion.css` contains only the application Settings controls for those preferences.

Development entrypoints declare their own styles instead of importing the
application stylesheet. The coach studio uses the foundation, coach presentation,
interface motion and its own shell; the intelligence laboratory additionally
uses the board stylesheet. Character components retain their shared artwork CSS.
The normal frontend build verifies these boundaries through Vite's real dependency
graph, including CSS imports, so a page stylesheet cannot silently become a
studio dependency. The same boundary manifest drives CI's application-style
exclusions; shared foundations and unknown styles retain broad coverage.

`ReviewCoach` owns one action row: 44px minimum-height buttons share the available
width with an 8px gap, capped at half the row per button. A single action retains
that same half-width, so adding a second action does not resize it. Callers provide
buttons directly; game review's best move uses the `portraitCaption` slot beneath
the character, while human insight uses the separate `context` slot. The portrait
caption does not change bubble or action geometry and is absent in cold SRS.
SRS and game styles must not override shared action dimensions.

When the shared review workspace has no evaluation bar, its board is centered
within the board row on desktop and mobile. The unused gutter is split equally
between both sides, retaining the same board size as game review. SRS does not
display an evaluation.

On mobile, both review modes place the coach and its action buttons together
above the board. SRS explanation playback uses the same placement; supporting
details, game move lists and evaluation graphs remain below the board. Desktop
retains its board-and-sidebar layout.
Game review does not add a temporary exploration-hint row while analysis is
pending, so receiving the best move cannot collapse a row above the mobile board.
The All games link uses the same button styling as board navigation. On mobile,
it stays in that single row while the move and flip buttons share the remaining
width; all buttons retain their 44px height.

The [animated coach](COACH.md) uses the same `ReviewCoach` presentation in both
review experiences. Artwork-specific poses, styles and finite CSS animations stay
with the registered character; semantic reaction and preference code are shared.
The registry derives one stable selectable roster from authoring collections.
Presentation groups order the unified Settings grid but never filter it or decide
which coach IDs are valid. Every registered family resolves an anatomy- and
expression-compatible idle repertoire from shared gestures and authored signatures.
The same channel coordinator and canonical timings serve production and studio
previews; CSS/SVG animate frames while one deadline timer coordinates safe overlap.
Resting eyes settle separately from the semantic reaction without changing feedback.
Retired selection aliases are explicit read-only mappings shared in behavior with
the API; no account rows or stored chess evidence are rewritten on load.
The provider lives inside the account boundary, so switching users discards the
previous preference state. Selection and motion use the existing owned SQLite
database, including the reserved local user, with no new container settings.
The independent piece/interface preference uses `/api/preferences/motion` and
the `interface_motion` column in that same row. Both providers share the saved
preference lifecycle and reset when the account boundary unmounts. The root CSS
motion attribute is also removed on unmount; login screens use the device default.

Navigation is Study, Games, Weaknesses, Settings. A small History API router
renders `/study`, its Due/openings/puzzles subpages and saved session/source
links, `/games`, `/games/:id`, `/weaknesses` and `/settings`. Screen/game links
push history entries; `popstate` restores the destination. The root URL aliases
`/study` with `replaceState`; old `/review` and root exercise/focus/session
bookmarks resolve to `/study/due`. Removed `?unit=` links discard the archived
unit/exercise identity without starting a lesson. Opening recalls pin their
saved session in the URL so refresh resumes the same answer snapshot. Unknown
paths show a recoverable not-found screen.
Legacy `/import` URLs replace their history entry with `/settings`. Settings owns
the saved provider connections, filtered imports, PGN uploads and import activity.
Games keeps only a compact Update games control using the same sync component and
polling behavior; without a connection it links to Settings. Sync still fetches
games without starting engine analysis.
Weaknesses opens directly with its title and supported pattern/outcome lists;
introductory copy and the classification-coverage summary are not shown there.

The coach studio is a separate development process (`npm run dev:coach`, port
5174), using its own HTML entry and the same character catalogue as production.
It has no production route or Settings link. Character, family and expression
URLs restore a study; switches cancel sequences and reset unsupported idle choices.
The studio does not access account preferences or start analysis.

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

Legacy generated lesson/course and repertoire product routes are tombstones. Due/unfinished-session queries exclude archived repertoire exercises; direct archived practice is rejected. A one-time migration released nonretired lesson-held cards without resetting their schedules. Historical rows, manual exercises and teaching audit/rejection access remain. Legacy course generation and lesson progression code have been removed; active review cannot start, resume or finish an archived lesson attempt, including through direct domain calls. Normal review feedback no longer carries a `lesson_result` field. Tests seed explicit historical rows rather than keeping an unused course builder alive. The new authored Study domain and `source="opening"` recall have their own explicit contracts described above.

OpenAI runtime integration is removed: no model SDK or model network calls remain.
Historical classification and teaching responses stay local. Explicit Chess.com
imports and enabled recent-game synchronization use the public Chess.com API.

Supported installations include the published Docker image and a source checkout,
both with one Python process serving the built frontend. Local mode shares one
workspace; hosted mode uses app accounts behind an HTTPS reverse proxy. See
[ACCOUNTS.md](ACCOUNTS.md) and [CONFIGURATION.md](CONFIGURATION.md). A standalone
wheel with packaged static assets is not currently supported.

Review-intelligence authority boundaries and measurement rules are recorded in
[REVIEW_INTELLIGENCE.md](REVIEW_INTELLIGENCE.md). Human move behavior must never
replace objective Stockfish evaluation or directly assign move-quality labels.

The frontend build generates a public-source snapshot with scripts/source_archive.py, served by the existing /assets mount and linked in Settings. Git-listed public source and licenses are included; private data, secrets and untracked files are excluded. See NOTICE.md and LICHESS_REUSE.md for the GPL/AGPL combination and source-offer workflow.

Full-game scheduling lives in `review_jobs`; `review_refinement` runs a finite
optional pass after the unchanged deep baseline. `review_intelligence/refinement_*`
own nominations and bounded questions; `review_reports` resolves compatible
saved evidence for presentation. The existing native cache and shared engine
pool remain the compute authority. See [REVIEW_REFINEMENT.md](REVIEW_REFINEMENT.md).

`review_intelligence/events`, `event_facts`, `context` and `clocks` derive typed,
traceable semantic events from saved chess facts and PGN annotations. No character
prose enters this layer. [REVIEW_EVENTS.md](REVIEW_EVENTS.md) specifies gates and
clock abstention; `review_scores` shares Stockfish-only alternative comparisons.
## Positional review evidence

The review-intelligence layer adds versioned immediate board-change facts for
quiet moves using existing python-chess legality and pin-aware tactical geometry.
It does not infer strategic causes from centipawn loss. See
[POSITIONAL_EVIDENCE.md](POSITIONAL_EVIDENCE.md) for supported definitions and
abstention rules; played and alternative lines remain distinct.

## Context and communication

The detail and progress endpoints share `review_intelligence/presentation.py`.
Compatible saved reports become versioned move events, mainline nodes/relationships,
owned cross-game references. Links require matching PGN/FEN/move
provenance; gaps and inconsistent adjacent searches cause abstention. These are
structured facts, never conversational memory. See [game context](GAME_CONTEXT.md),
[history](CROSS_GAME_CONTEXT.md).

The client builds a `DialogueIntent` before selecting a personality. `CoachUtterance`
retains claim/template provenance and future-neutral delivery metadata, without a
speech provider or runtime. The existing coach catalogue owns both artwork and
writing definitions; account preferences need no new field. Character changes
perform no native work. Cold practice gates precede all dialogue selection.
See [dialogue](COACH_DIALOGUE.md) and [character writing](COACH_PERSONALITIES.md).

React's framework code has a separately cached production chunk; all registered
coach definitions remain synchronous. The offline intelligence lab and expression
studio have separate loopback entry points and do not enter production navigation
or executable assets. Their source remains in the downloadable public source.

## Public game providers

Chess.com and Lichess share one checkpointed ingestion pipeline, job lanes, and account-owned connections. Provider clients supply normalized PGNs and stable batch keys; the shared importer owns legality, learner matching, deduplication and atomic progress. Discovery drives the same Settings forms and multi-provider Games refresh. See [provider integration and extension contract](GAME_PROVIDERS.md).
