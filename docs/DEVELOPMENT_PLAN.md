# Development plan

See [FEATURE_STATUS.md](FEATURE_STATUS.md) for the current inventory mapped to the original specification, including partial features, OpenAI-off behavior and outstanding validation. This plan tracks milestone sequencing; the feature inventory describes actual behavior.

## Repository assessment

Inspected all files including hidden entries on 2026-09-11. Workspace was empty; no Git repository, AGENTS.md, application, tests or reusable infrastructure. Node 24 was present; Python/Stockfish were not on PATH. Located Python 3.12.10, created a workspace virtual environment, and installed official Stockfish 18 in ignored .tools for native verification.

## Structure and strategy

`backend/trainer/` contains domain services and API; `backend/tests/` contains deterministic and native engine fixtures; `migrations/` owns Alembic revisions; `frontend/src/` contains the thin application; `docs/` contains living specifications; `scripts/` contains local run/backup support. `data/`, `.env`, runtimes and dependencies are ignored.

SQLite relational tables link imports, games, learner decisions, engine analyses, jobs, skills/evidence, courses/units/lessons, exercises/answers, review sessions, FSRS states and review history. Immutable engine/model/FSRS payloads may use JSON. Schema changes require migrations.

One engine per configured worker, one thread by default, bounded analysis limits, persistent cache. Queue jobs in SQLite, recover interrupted work on startup, commit decisions independently, allow cancellation between bounded engine operations. OpenAI runs only on meaningful evidence with bounded retries and versioned cache identity. Failure retains objective evidence.

Course generation aggregates independent evidence and prioritizes recurrence/severity/recency, classification confidence and review outcomes. Keep source links; provisional single-example practice must be labeled honestly. Wrap maintained py-fsrs behind an adapter and derive Again/Hard/Good from behavior. Retain raw timing independently.

## Milestones

| Milestone | Deliverable | Status |
|---|---|---|
| 0 | Inspect, design, document | Complete |
| 1 | Configuration, migrations, rules, scores, engine/cache, correctness tests | Implemented and verified |
| 2 | Learner PGN → queued native analysis → evidence | Implemented and verified |
| 3 | Controlled audited LLM classification; mock tests | Implemented; live API untested |
| 4 | Evidence aggregation and basic course | Basic scaffold implemented and tested |
| 5 | Board, move policy, persisted first-failure review | Implemented; desktop/mobile tests pass |
| 6 | FSRS queue and behavior-based grades | Implemented and verified |
| 7 | Multi-game import, restart/cancel, resource controls | Implemented; large-volume profiling remains |
| 8 | Curated repertoire and manual positions | Implemented and tested |
| 9 | LAN/mobile UX, backup, install docs, hardening | Initial delivery; deployment hardening remains |

Validate each stage before expanding. First establish native-engine vertical coverage, then browser verification. Normal tests never call live OpenAI; use an injected schema-valid mock. Integration tests skip explicitly only when Stockfish is absent.

## Risks / bounded initial scope

* Mate sign and black perspective can silently poison learning: explicit score types and dedicated tests.
* Geometric attacks do not prove tactical loss: label facts narrowly, replay verified PVs, avoid motif inventions.
* MultiPV does not cover every legal answer: evaluate unknown legal moves under the stored policy.
* Repetition history differs from display identity: separate engine key from exercise key.
* LLM explanations remain model-produced interpretation: label and retain audit records; low confidence stays unclassified.
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

## Remaining product work

## Current work: bounded pipeline concurrency

Assessment: STOCKFISH_WORKERS currently starts whole-job workers, so a single 100-game import remains serial. Each meaningful decision waits for its OpenAI request before Stockfish continues. Existing atomic per-decision evidence/cache persistence is reusable; progress increments and exercise creation need explicit concurrency handling.

Plan: use one persistent-job coordinator, a bounded pool analyzing games with independent Stockfish processes, and a separate bounded OpenAI pool accepting meaningful saved decisions. Allow multiple positions from one import and multiple classification requests at once. Preserve serial Chess.com downloads, per-call evidence/cache identity, short serialized application writes, atomic progress updates and cooperative cancellation. Stop submitting on cancellation and drain in-flight calls before final status. Verify overlap, configured caps, cancellation/cache reuse, native engine lifecycle and end-to-end persistence with deterministic fixtures before enabling local settings. No broker or distributed workers; no changes to analysis depth or move policy.

The usable first vertical slice is complete. Basic courses currently use controlled titles, deterministic ordering, user-marked stages and immediate SRS enrollment. Rich mixed-example teaching sequences, automatic stage/graduation criteria, LLM course-level prose/planning, model-version evidence reconciliation, larger-game-volume profiling, standalone wheel packaging and engine-upgrade reanalysis remain future work.

Settings are centralized/read-only in UI and edited through .env, then restart. No physical LAN/mobile device or Linux/macOS run has been verified here. CI is provided but has not run remotely. Dragging and underpromotion now have dedicated browser coverage, including a regression for post-drag click suppression. No user account, public hosting, synthetic positions or cloud database was added.
