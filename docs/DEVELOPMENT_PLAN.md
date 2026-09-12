# Development plan

See [FEATURE_STATUS.md](FEATURE_STATUS.md) for the current inventory mapped to the original specification, including partial features, local classification and outstanding validation. This plan tracks milestone sequencing; the feature inventory describes actual behavior.

## Repository assessment

Inspected all files including hidden entries on 2026-09-11. Workspace was empty; no Git repository, AGENTS.md, application, tests or reusable infrastructure. Node 24 was present; Python/Stockfish were not on PATH. Located Python 3.12.10, created a workspace virtual environment, and installed official Stockfish 18 in ignored .tools for native verification.

## Structure and strategy

`backend/trainer/` contains domain services and API; `backend/tests/` contains deterministic and native engine fixtures; `migrations/` owns Alembic revisions; `frontend/src/` contains the thin application; `docs/` contains living specifications; `scripts/` contains local run/backup support. `data/`, `.env`, runtimes and dependencies are ignored.

SQLite relational tables link imports, games, learner decisions, engine analyses, jobs, skills/evidence, courses/units/lessons, exercises/answers, review sessions, FSRS states and review history. Immutable engine/classification/FSRS payloads may use JSON; historical model audits remain archived. Schema changes require migrations.

One engine per configured worker, one thread by default, bounded analysis limits, persistent cache. Queue jobs in SQLite, recover interrupted work on startup, commit decisions independently, allow cancellation between bounded engine operations. Local rules process meaningful saved evidence with bounded workers and versioned caches. Failure retains objective evidence. OpenAI connectivity is removed.

Course generation aggregates independent evidence and prioritizes recurrence/severity/recency, evidence weights and review outcomes. Keep source links; provisional single-example practice must be labeled honestly. Wrap maintained py-fsrs behind an adapter and derive Again/Hard/Good from behavior. Retain raw timing independently.

## Milestones

| Milestone | Deliverable | Status |
|---|---|---|
| 0 | Inspect, design, document | Complete |
| 1 | Configuration, migrations, rules, scores, engine/cache, correctness tests | Implemented and verified |
| 2 | Learner PGN → queued native analysis → evidence | Implemented and verified |
| 3 | Controlled audited classification | Replaced by local rules; v1 deployed, independent precision/recall evaluation pending |
| 4 | Evidence aggregation and personalized lessons | Saved sequences preserved; development paused, model generation removed |
| 5 | Board, move policy, persisted first-failure review | Implemented; desktop/mobile tests pass |
| 6 | FSRS queue and behavior-based grades | Implemented and verified |
| 7 | Multi-game import, restart/cancel, resource controls | Implemented; large-volume profiling remains |
| 8 | Curated repertoire and manual positions | Implemented and tested |
| 9 | LAN/mobile UX, backup, install docs, hardening | Initial delivery; deployment hardening remains |

Validate each stage before expanding. First establish native-engine vertical coverage, then browser verification. Native vertical tests use LocalClassifier; injected classification fixtures test failure/concurrency boundaries. Integration tests skip explicitly only when Stockfish is absent.

## Risks / bounded initial scope

* Mate sign and black perspective can silently poison learning: explicit score types and dedicated tests.
* Geometric attacks do not prove tactical loss: label facts narrowly, replay verified PVs, avoid motif inventions.
* MultiPV does not cover every legal answer: evaluate unknown legal moves under the stored policy.
* Repetition history differs from display identity: separate engine key from exercise key.
* Rule coverage is intentionally incomplete. A finite engine continuation does not prove universal causality; unsupported patterns remain unclassified. Independent label accuracy remains unmeasured.
* Single-process restart recovery is deliberate. Multi-process queue ownership is a future requirement, not implied support.
* No exact Elo/centipawn conversion. Rating affects teaching priorities only.

## Initial delivery verification (before Chess.com import)

* 27 backend tests pass, including real Stockfish UCI/cache and an asynchronous HTTP import ? engine ? injected classifier ? course ? review ? restart flow.
* Six production-browser tests pass: desktop/mobile-emulated manual review, first failure, reload/retry, PGN import/progress, native dragging and underpromotion selection. Screenshots visually inspected.
* TypeScript/Vite production build passes; Python Ruff checks pass; Alembic reports no schema drift.
* SQLite backup/restore round trip and secret exclusion pass. Native engine is Stockfish 18; FSRS is pinned to 6.3.2. Python and frontend dependency locks are checked in.
* In-app browser connection was unavailable after two attempts; repeatable project Playwright tests used local Chromium instead.
* Sandbox process execution stalled during browser tests; later checks ran with approved local execution and isolated workspace temporary directories. This is an environment issue, not a required production workflow.
* Two upstream TestClient deprecation warnings remain. No live OpenAI calls were made.

## Current priority: Chess.com username import

User explicitly requested this before further curriculum work, superseding the original deferred Chess.com integration non-goal. Reuse the existing PGN parser, learner matching, deduplication, job queue and Stockfish pipeline.

Plan: (1) bounded serial public-API adapter and persisted import/checkpoint tables; (2) background username-import endpoint with default 100 rapid games / last 3 calendar months, selectable limits; (3) Import-screen username form and fetching/analysis progress; (4) mock-HTTP regressions, native pipeline and browser tests, read-only live endpoint smoke check; (5) update privacy/configuration docs and restart local application. No Chess.com login, scraping, OAuth, live games, or LLM dependency. Preserve downloaded PGNs per committed archive; retry/restart skips completed archives. Deduplication stays shared with manual PGN uploads.

Implemented and verified: all five steps above, including the subsequently requested From/To completion-date filters. Explicit dates override lookback; mode and game limits still apply. The expanded suite passes 44 backend tests and 10 desktop/mobile browser tests. Date fixtures cover midnight boundaries, inclusive final days, open-ended periods, archive pruning, reversed ranges and persisted request identity. Both import screenshots were visually inspected. Build, Ruff and Alembic schema checks pass; the local application was migrated and restarted. No real player's games were inserted by tests. The existing TestClient deprecations and a Windows pytest-cache permission warning do not affect test results.

## Legal-move board interaction

Implemented server-provided legal destinations in the cold review payload. Selection/drag displays quiet-move dots and capture rings; tapping the selected square clears it, and tapping another movable piece switches selection. Invalid destinations are not submitted, while the backend still revalidates every submitted move. Promotion choices now also come from python-chess. No engine answers, labels or scores are exposed by these markers. Verification covers pins, castling, en passant, both promotion colors and desktop/mobile review interaction.

Current verification: 49 backend tests and 12 desktop/mobile browser tests pass, including selected-square styling and marker reset after a failed or completed move. Production build and Ruff pass. Screenshots are saved in docs/screenshots. No schema migration was needed.

## Incremental import and cancellation verification

Implemented `import_games.is_new` with migration `6b9d45ae2210`, preserving existing job scope and all data. Future imports analyze only newly inserted games; duplicate-only imports do not regenerate the course. Chess.com's limit now counts new valid games and may scan past duplicates for unsaved history within the selected dates. Older interrupted work is resumed explicitly through its original job, not through a new import. UI explains this behavior and classification cancellation/caching.

Validation: 52 backend tests and 12 desktop/mobile browser tests pass. Added a 100-existing-plus-20-new regression, duplicate-limit coverage and a native-engine/injected-classifier cancellation/retry check with one request per distinct meaningful decision. Existing archive resume, rate-limit, engine cache and board regressions remain green. No paid calls are made by these tests. See CHESSCOM_IMPORT.md for the distinction between downloading monthly archives and recomputing analysis.

Deployment: created a local backup, applied the migration, verified no Alembic schema drift, and gracefully restarted the backend. The pre-existing user-started classification job resumed with saved responses retained. Actual Terra requests have returned successful responses during that user job; pedagogical quality evaluation remains outstanding.

## Bounded pipeline concurrency

Initial assessment: STOCKFISH_WORKERS started whole-job workers, so a single 100-game import remained serial. Each meaningful decision waited for its OpenAI request before Stockfish continued. Existing atomic per-decision evidence/cache persistence is reusable; progress increments and exercise creation need explicit concurrency handling.

Plan: use one persistent-job coordinator, a bounded pool analyzing games with independent Stockfish processes, and a separate bounded OpenAI pool accepting meaningful saved decisions. Allow multiple positions from one import and multiple classification requests at once. Preserve serial Chess.com downloads, per-call evidence/cache identity, short serialized application writes, atomic progress updates and cooperative cancellation. Stop submitting on cancellation and drain in-flight calls before final status. Verify overlap, configured caps, cancellation/cache reuse, native engine lifecycle and end-to-end persistence with deterministic fixtures before enabling local settings. No broker or distributed workers; no changes to analysis depth or move policy.

Implemented the plan above. Verification: 59 backend tests pass, including native multi-process analysis, shared-cache coalescing, concurrent classification from a single game, cancellation/cache reuse and recovery after worker failure. Twelve desktop/mobile browser tests, production build and Ruff checks pass. No schema change is needed. Actual throughput improvement has not yet been benchmarked. Local deployment was gracefully restarted with four Stockfish workers (one thread each) and four classification workers; health and effective settings were verified. The prior classification job had completed before restart.

Published source, tests and documentation at https://github.com/Reldnahc/chesstrainer. Private configuration/data and local runtimes remain ignored. GitHub Actions run 34675280916 passed both backend and frontend jobs on Ubuntu.

## Remaining product work

The initial vertical slice and core sequenced lesson/classification flow are implemented. Remaining work includes semantic teaching-quality evaluation, broader deterministic motif evidence, larger-game-volume profiling, standalone wheel packaging, management UI and engine-upgrade reanalysis. Grouping and ordering deliberately remain controlled pedagogical heuristics.

Settings are centralized/read-only in UI and edited through .env, then restart. No physical LAN/mobile device or Linux/macOS run has been verified here. The first public GitHub Actions run passed both backend and frontend jobs on Ubuntu. Dragging and underpromotion now have dedicated browser coverage, including a regression for post-drag click suppression. No user account, public hosting, synthetic positions or cloud database was added.

## Review restart investigation and feedback

Confirmed existing completed reviews and FSRS due dates survive restart; short learning intervals were returning positions without explaining why. Added saved next-review times and scheduling-reason copy, persistent last-recall avoidance, and clearing completed direct-exercise URLs. No scheduling policy change, database repair or migration was required. Regression tests restart the application before/at the due boundary for correct, failed-then-solved and revealed outcomes, and check repeat avoidance versus unfinished-session recovery.

Validation: 63 backend tests and 12 desktop/mobile browser tests pass, with production build and Ruff checks passing. Review progress is retained; completed attempts still return at their FSRS due times.

## Visual redesign

Replace the original beige/green serif treatment with graphite surfaces, cool neutral board squares, orange interaction accents and locally bundled IBM Plex Sans/Mono. Restructure the application header, navigation and review instructions, simplify page copy, and add an SVG app mark/favicon through Vite assets. Keep the board dominant and all chess/scheduling authority unchanged. Verify every screen at desktop/mobile widths, font/icon delivery and existing interaction regressions before delivery.

Implemented the redesign across all six screens, including board notation, legal-move markers, feedback, forms, course stages, evidence dialogs and empty states. Added keyboard skip navigation, visible focus, reduced-motion styles and mobile input sizing. Verified local font/favicon delivery and all-screen viewport fit; 14 desktop/mobile browser tests and production build pass. Browser skill connection timed out twice; project Playwright and local screenshots were used for visual inspection.

## Complete lessons and classification: implementation plan

Assessment: course rebuild currently archives all progress, four stage buttons open one example, all exercises enter SRS immediately, and model changes can leave conflicting labels active. Reuse engine grading, verified PVs, cold board interaction, FSRS, classification audits and bounded local workers.

Milestone A ? Persistent curriculum. Add a migration for stable grouped units, course revisions, ordered lesson items, lesson-linked practice sessions, SRS eligibility and active/versioned evidence. Preserve reviewed cards and existing history. Rebuild updates evidence/priority without replacing existing sequences. Freeze started sequences; new evidence remains available for subsequent lessons.

Milestone B ? Lesson state machine. Diagnose, Teach, Drill, Check, Retain with server-enforced stage ordering. Practice uses existing legal move/engine policy but does not impersonate an SRS recall. Teaching acknowledges each example, and verified PV playback is generated by python-chess. Check requires a configured fraction of first-attempt successes, with failed rounds repeatable. Completion releases selected cards to SRS. Repeated examples are disclosed when independent examples are insufficient. Include a mixed-review unit across supported skills.

Milestone C ? Classification and teaching. Reconcile active labels when a different model/prompt produces a valid result; preserve old evidence/audits. Expose rejection of unsupported classifications and current quality status. Generate optional cached, schema-validated unit summaries/checklists using only cited selected evidence in a local background job. Reject unknown/unsupported citations; deterministic teaching remains available without OpenAI or on failure. Semantic explanation quality remains reviewable rather than claimed proven.

Milestone D ? UI and verification. Implement a dedicated course player, sequence/progress/check feedback, teaching playback and continuation after reload. Verify repeated imports/course refresh preserve progress, first-failure semantics, SRS graduation, cold payloads, citation/reconciliation/rejection behavior, migration/backup and native-engine vertical flow. Run desktop/mobile browser fixtures, update feature inventory and restart with backup only after checks pass.

Defaults: up to six grouped weakness units plus one mixed unit; up to eight distinct positions per unit; two diagnostic positions, up to three teaching examples, up to five drill positions and up to three check positions; check pass fraction 0.8. Prefer separate check examples when enough real positions exist. These are explicit teaching heuristics, not mastery probabilities. Existing SRS history is never reset.

Status: milestones A-D implemented and verified.

Lesson verification: native import/classification/course tests now complete the lesson sequence before entering SRS. Added restart continuity, failed check/retry, separate lesson/SRS history, version reconciliation, rejected/invalid teaching, cached teaching jobs, fresh follow-up sequences, protection of existing reviewed/open cards and legacy-unit stability. Browser journeys cover the whole lesson flow on desktop/mobile. A copy of the existing database migrated with no schema drift, no invalid foreign keys and unchanged reviewed-card FSRS state/history.

Deployment verification: 75 backend tests and 16 desktop/mobile browser tests pass; the final lesson player was also rechecked after feedback/visual refinements. Ruff and production build pass. Created a local pre-migration backup, applied 92f71bce490a, verified no schema drift/foreign-key failures, built current lesson sequences, and confirmed existing reviewed-card state and review counts were unchanged. The backend was restarted using the existing engine/model configuration. No paid teaching-generation call was made by development tests; live teaching quality remains an explicit evaluation boundary.


### Mobile review follow-up (September 12, 2026)

Implemented a compact phone review header, viewport-aware board sizing, immediate primary action, and expandable answer/history details. Next-position navigation resets optional-detail scrolling. Saved due dates are displayed as readable intervals; no scheduling policy or user history was changed. Added phone viewport regression coverage and an API test verifying increasing FSRS intervals across restarts and shorter relearning after a lapse.


### Automatic review retirement

Implement a persistent retirement marker separate from lesson eligibility. Retire when the saved FSRS interval from last recall to next due is strictly greater than a configurable 100 days. Apply to existing qualifying cards at startup, preserve all history, exclude retired cards from automatic review/new lesson selection, and block stale direct review links. Add boundary, restart, reimport and feedback tests before migrating the local database.

Retirement deployed and verified: migration a38d721c4f90, 82 backend tests and 19 browser tests passed (one desktop skip for the phone-only check). Pre-migration backup preserved; copied database retained all original scheduling/history fields. Effective local threshold is 100 days; zero existing cards qualified at deployment.


### Wrong-answer feedback stability

Reproduced a 28-pixel control jump in a 375x600 phone viewport when the immediate checking message appeared. Replaced separate checking/retry blocks with a shared, reserved feedback area in Review and LessonPlayer. Fast responses do not show a loading message; longer grading requests show one after 350 ms. Retry feedback persists, and a subsequent attempt cannot stack two status messages. Board state, first-failure recording, FSRS and retirement policy are unchanged.


### Review explanations and consequence playback

Implement both outcomes directly in Review; lesson development stays paused. Persist the latest attempt link, select its exact verified engine candidate, and replay with python-chess into annotated frames. Derive concise explanations from check/mate, captures, promotion, castling and material changes; avoid inventing positional claims. Curated answers retain curated authority. Add an on-demand explanation endpoint that never grades or schedules, a mobile-friendly playback dialog with return-to-attempt, and success summary/Show why. Validate wrong and accepted alternatives, Black perspective, special moves, spoilers, restart persistence and unchanged SRS. No paid model calls are required for this deterministic explanation layer.

Review explanations deployed: migration b91a0673de42, 92 backend tests and 25 browser tests passed. Exact-frame screenshot checks and 10 explanation tests passed after final metadata cleanup. The migrated copy preserved SRS/retirement history, and 77 real attempts produced 1,348 legal replay moves. Live health and the explanation endpoint were verified over the LAN address.


### Immediate counter-reply feedback

On a failed engine answer, include only the submitted-move and first opponent-reply frames from saved verified analysis. Preview them immediately in Review, add Try again to reset locally, and open deeper playback at the reply. Move all explanation return actions below the board. Retain original-position backend grading, one failed SRS event, and curated/missing-evidence fallbacks. Test both colors, the phone preview controls, deeper playback entry point and return-button geometry.

Implemented and deployed on the existing LAN address. All 92 backend tests and 25 browser tests passed (one intentional desktop skip); production build and Ruff passed. Phone screenshots confirmed the immediate counter preview and return control below the board. Restarted backend health reports database ready and Stockfish available; the LAN origin serves the updated frontend bundle.

Show move follow-up: the reveal endpoint now applies the saved primary answer with python-chess and returns the resulting board and highlights, so revealing actually plays the move on the main board. This works without deeper engine evidence and preserves one failed recall after retries/reveal. All 98 backend tests and four focused desktop/phone playback checks passed; production build and Ruff passed.

### Local classification research (September 12, 2026)

Completed research into Lichess's deterministic tagger, python-chess primitives and reuse of existing engine evidence. [CLASSIFICATION_RESEARCH.md](CLASSIFICATION_RESEARCH.md) documents supported scope, causal-verification limits, independent quality evaluation and a staged migration away from paid model calls. Recommendation only: no connectivity, configuration, active labels or application behavior changed. Next proposed milestone is a local classifier benchmark against saved game evidence; lesson work remains paused.

### Local classification replacement — in progress

User authorized removal of LLM functionality. Implement in verified stages:

1. Rename classification audit persistence to provider-neutral names with native SQLite renames, retain legacy model metadata and course snapshots, and add rule provenance. Preserve all review/SRS rows.
2. Implement bounded, conservative detectors on saved best/actual lines: mate transitions, settled material consequences, immediate hanging captures, exploited forks and promotion. Store direction and supporting plies/squares; abstain on unclear evidence. Extend motifs only with tested fixtures.
3. Replace runtime classifier and settings, delete paid teaching generation and OpenAI dependency/configuration/UI. Preserve historical audits for export; lessons remain paused.
4. Test detector positive/negative cases, both colors, migrations, cancellation/cache/restart, API and mobile review. Run a read-only report against saved game evidence; report coverage separately from unmeasured accuracy.
5. Back up and migrate the live database, backfill classifications locally, and verify LAN operation plus unchanged reviews and retirement.

Completed the initial local replacement and LAN deployment. Native migration c42d1738a9bf preserves audit IDs/foreign keys; the live backfill processed all 100 saved games and 395 meaningful decisions. It produced labels for 96 decisions and abstained on 299, with no failed runs. This measures coverage only, not precision. Historical model responses remain archived and inactive; independent human-reviewed quality evaluation is still outstanding.

Validation: 117 backend tests passed after physically uninstalling the OpenAI SDK; 27 existing browser checks passed (one intentional desktop skip), plus both desktop/mobile local-classification audit checks. Production build, Ruff, dependency consistency and Alembic metadata checks passed. The new browser fixture initially deduplicated across projects; distinct Round headers fixed the fixture without changing production deduplication.

Fresh pre-cutover backup: data/backups/before-local-cutover-20260912.zip. Live hash comparison confirmed unchanged game/decision/engine/exercise/answer/course/lesson/review/session/attempt/SRS records, including retirement and all 31 existing recalls. All 395 historical audit payloads/metadata were preserved. The existing LAN origin is healthy and serves the new frontend. SDK, .env model settings, paid generation jobs and model controls are removed; the host's unrelated environment credentials are unused.

Next work: an independent human-reviewed benchmark, more conservative motif detectors (pins/skewers/defender removal), and better review explanations from those findings. Lesson redesign remains deferred. No precision target has been claimed as achieved.


### Mobile workspace and lesson removal - completed

Bring Import, Weaknesses, Repertoire and Settings into the compact Review layout: one shared mobile navigation bar, small headings, tighter forms, expandable secondary options and job history, and accessible evidence playback. Keep primary actions visible without lengthy explanatory text. Remove Course navigation, lesson components and lesson API entry points; old unit links return to Review. Preserve historical course/lesson records. Release only nonretired SRS cards held by lesson items through a migration, leaving scheduling and recall history intact. Verify the migration on a backup copy, test archived lesson sessions cannot mutate, and run desktop/phone browser checks plus review regression tests before LAN deployment.


Deployed September 12, 2026 on the existing private LAN origin. Import, Weaknesses, Repertoire and Settings share compact sticky navigation, smaller headings, tighter forms and touch-sized controls. Custom dates, import help, older completed activity, classification notes and technical settings expand on request. Evidence uses a native modal with a reachable close control and restored opener focus. Course/lesson components and active routes are removed; old unit links open Review.

Validation: 115 backend checks passed in the full run; a missing orientation argument in the new migration fixture was corrected and all four archive tests then passed (116 total backend cases). The full browser run passed 30 cases with one intentional desktop skip; the mobile evidence-label selector was corrected, and both desktop/mobile evidence tests passed with added scrolling/focus assertions. Four screen/disclosure checks and six screenshot/review checks also passed after fixes. Build, Ruff and formatting checks passed. Updated screenshots use isolated fixture data.

Backup data/backups/before-mobile-lesson-removal-20260912.zip was restored and migrated separately before deployment. Whole-database comparison allowed exactly 39 eligibility changes for nonretired lesson-held positions. Live migration d17b63e02a48 then matched the expected copy exactly: all 31 recalls, FSRS payloads/due dates, retirement markers, games, exercises and lesson history preserved. LAN health, new frontend asset and HTTP 410 for Course verified. The backend was restarted; reload the browser to use the new interface.


### Remove repertoire - completed

Remove the Repertoire destination and its manual-position form. Keep Review, Import, Weaknesses and Settings. Tombstone repertoire list/import APIs; filter archived repertoire exercises from both due and unfinished-session queues, and reject old direct starts/moves/reveals. Preserve all database rows and schedules without a migration. Keep the existing manual-position API as a low-level review input and deterministic test seam, with no creation UI. Verify removal and restart persistence, retain promotion/drag/retry browser coverage through API fixtures, update current documentation, then restart the existing LAN backend.


Deployed with four tabs: Review, Import, Weaknesses and Settings. Repertoire import/list and archived card starts/moves/reveals return 410; both queue paths exclude repertoire cards. Manual creation is absent from the interface. Validation: 117 backend tests and 31 desktop/phone browser tests passed (one intentional desktop skip); build, Ruff and formatting passed. LAN backend restarted, health ready, new bundle and HTTP 410 verified. The archive regression test preserves every database row across restart. Live checks confirmed all backed-up recalls preserved and non-review table hashes unchanged; review/session/attempt/SRS tables changed because live reviewing continued during deployment. No migration or data rewrite was performed. The live database had no repertoire cards, so this removal does not change its queue. Backup: data/backups/before-repertoire-removal-20260912.zip. Current screenshots and feature documentation updated.


### Keep Review stable during explanations - completed

Replace the full-screen explanation dialog with inline playback controls and reuse the original review board. Keep navigation, page title, board dimensions and position stable through loading, playback, errors and return. Preserve Escape/back behavior, keyboard focus, backend explanation authority and unchanged scheduling. Add geometry assertions for phone/desktop, including a delayed explanation response. Build, browser-test and deploy the frontend to the existing LAN origin.


Implemented inline explanation controls using the original mounted Board. Navigation and page title remain visible; no full-screen dialog, second board, body scroll lock or board resize. Saved frames drive only the board position/highlights. Loading and errors keep the current board visible; Escape and Back restore the review controls with focus and no automatic scrolling. On phones playback and return stay below the board; desktop uses the existing adjacent practice panel.

Validation: production build passed; seven focused desktop/mobile browser cases passed with one intentional desktop skip. Assertions cover identical header/title/board geometry, one preserved board DOM node, delayed/error responses, successful/failure/revealed lines, return focus, compact phone controls and unchanged recall count. Phone screenshot inspected. LAN origin serves the new bundle without restarting the unchanged backend; no database or scheduling changes.


### Clear wrong-move feedback - completed

Add a steady red outline and light red board tint after a backend-graded failure, paired with explicit Mistake text. Keep pieces and the automatic opponent counter visible, with no size change or flashing animation. Clear the cue when retrying, starting another attempt, showing the answer or opening playback; preserve first-failure scheduling. Check failure/counter/retry/success and request-error behavior on desktop and phone.


Deployed a steady red outline/light tint and explicit Mistake heading/status for failed answers. CSS uses an outline and a pointer-transparent overlay, so board geometry and interaction remain unchanged. The cue clears on retry, another submission, successful/revealed answer, playback and a new position. HTTP grading errors do not activate it. First-failure scheduling is unchanged. Build passed; 11 focused desktop/phone browser checks passed (one intentional desktop skip), including repeated misses, successful retry, counter preview, playback, short-phone geometry, fast/slow grading and service-error behavior. Phone screenshot inspected; live LAN bundle and backend health verified. No backend restart or database change was needed.


### Reveal wording and explanation duplication - completed

Rename the answer action to Reveal move. The explanation summary sometimes reuses the exact current-frame annotation; display that sentence once while retaining distinct whole-line context and live move narration. Update the matching backend guidance, verify playback changes and reveal behavior on phone/desktop, then deploy.


Reveal move replaces Show move in the action, backend guidance and current product/SRS documentation. Playback suppresses the summary when it exactly matches the current frame annotation (ignoring surrounding whitespace); the live caption remains, and distinct whole-line context is preserved on other frames. Verified forward/back navigation, reveal animation, stable inline playback and phone controls: 16 explanation tests and seven browser cases passed (one intentional desktop skip). Build and Ruff passed. Backend restarted on the existing LAN address, healthy Stockfish/database and updated frontend bundle verified. No grading or scheduling changes.


### Classification usefulness upgrade - completed

Baseline read-only audit: 395 meaningful decisions, 96 labeled / 299 unclassified. Of the unclassified set, 218 have an unusable material endpoint at eight plies; 92 have a relative material difference of at least one point at a settled 16-ply endpoint. These are coverage diagnostics, not accuracy estimates.

Implement incrementally: (1) separate outcomes, motif findings and practice cues, report abstention reasons, inspect longer saved lines and include meaningful pawn/exchange outcomes without absolute-score gating; (2) add verified pin/skewer/defender-removal/back-rank and broaden immediate capture/fork detection with concrete witness frames; (3) opt-in bounded engine enrichment for truncated lines using separate immutable analysis links, without altering decisions/exercise answers; (4) show exact-line findings/affected squares after an answer and expose coverage plus evidence examples; (5) add focused practice by skill with separate session mode and no FSRS writes, deduplicate positions and preserve mixed due priority; (6) export a stratified human-labeling sample and evaluate annotated results separately from coverage. Test each stage, back up and validate migration, run a read-only before/after report, backfill locally and verify LAN deployment.

No lesson/repertoire return, synthetic positions, paid model calls or mastery claims. Unknown mechanisms remain unknown. Focused practice never counts as blind recall; only mixed Review schedules FSRS.


Implemented and deployed rules v2 plus response schema v2, structured outcomes/abstention reasons, practice cues, pin/skewer/defender-removal/back-rank witnesses, bounded supplemental engine jobs, separated coverage, all-example evidence browsing, exact-line playback highlights and focused practice without FSRS writes. Added private CSV sampling and human-annotation metrics; no human accuracy benchmark is claimed.

Measured on 100 saved games / 395 meaningful decisions: v1 labeled 96. V1 had 24 specific-pattern decisions. V2 using existing evidence labeled 171, with 47 specific patterns. A 40-position validation-copy enrichment labeled 185 with 51 patterns; the separate live time-limited engine run labeled 183 with 50 patterns and 212 abstentions. Time-limited Stockfish PVs can differ between independent runs; results are cached thereafter. Live coverage is 46.3%, versus 24.3% before. Outcomes and mechanisms overlap. Unclassified and out-of-scope strategic causes remain a visible limitation.

Validation: 139 backend tests passed in the full suite; targeted compatibility, timing and restart checks passed after final fixes. Thirty-nine desktop/mobile browser cases were validated across the full run and relevant reruns, with one intentional desktop skip. A phone test exposed scrolling to a low pattern button; moving it beside playback fixed the actual layout. Stable screenshots verify restored pieces and highlights. Build, Ruff, dependency consistency, Alembic metadata, SQLite integrity and foreign keys checked.

Final backup: data/backups/classification-v2-rollout-20260912.zip. Additive migration e6294af71b35 preserved all 26 pre-existing tables' contents (only neutral new session columns added). Live reclassification processed 2,780 learner decisions / 395 meaningful records; the optional probe job processed exactly 40 selected positions with no failures. All 59 existing scheduled reviews, 395 FSRS states, saved answers, original analyses, games and archived lessons were checked against the backup after backfill. No synthetic or live-user test reviews were created.

The backend is running on the existing private LAN origin, http://192.168.1.12:8000. Private read-only artifacts: data/classification-v2-live-report.json and data/classification-v2-live-human-sample.csv (60 unlabelled examples). Next quality work is independent human labeling, new guarded motifs from demonstrated misses, and measuring improvement in later real games. Lessons/repertoire remain removed and model connectivity remains absent.
