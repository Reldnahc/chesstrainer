# Verification status

The repeatable procedure is in [TESTING.md](TESTING.md). Prior passes remain below with their original scope and results.

## Full-game review: September 25, 2026

- Full backend/native/API suite: **293 passed**, including both-color reports,
  independent practice history, saved review reopening without an engine, cancel/resume,
  setup positions, promotion, en passant, castling, typed mate scores, Great criteria,
  Elo-only Blunder severity, positive fork evidence and a mating queen sacrifice.
- Full Playwright suite: **43 passed, 1 intentional skip** across desktop and phone
  Chromium. Includes coach playback, legal variation branching, undo/return, source
  game preservation, viewport fit and rejection of late analysis responses.
- TypeScript/Vite build and repository-wide Ruff lint/format checks passed.
- Fresh Alembic migration to **04af728d913e** matches SQLAlchemy metadata with no drift.
  The migration adds independent game-review tables; training tables are unchanged.
- The dated recall-restart fixture now starts at the real initialization time used by
  FSRS instead of leaving untouched cards in the future relative to a frozen past clock.

Review rules and conservative evidence limits are documented in [GAME_REVIEW.md](GAME_REVIEW.md).
Tests use isolated databases and synthetic positions. Private games, generated reports,
native engines and test screenshots remain uncommitted. No live database migration,
server restart, public deployment or bulk reanalysis was performed. Start the application
normally to apply the additive migration and use **Games**.

Existing TestClient deprecation and terminal-color warnings remain. Expected provider
error fixtures still log `job_failed`; these are not test failures. The initial browser
run required updating the old four-tab navigation assertion to five. Browser tests run
with host process permissions so Playwright can tear down its isolated Windows server.

## Pinned Lichess integration: September 13, 2026

| Check | Result |
|---|---|
| Upstream predicate/source parity | 19 deterministic tests; every original function AST preserved after removing observers; supporting files/license match original hashes |
| Full frozen upstream output parity | All 12,000 theme sets match unmodified upstream; 17,468 valid witness records |
| Final frozen comparison | 12,000 incidences, zero reconstruction skips; per-theme raw/admitted results and limits in LICHESS_REUSE.md |
| Full backend/native/API suite | **280 passed**, no skips, 26.05 seconds; Stockfish 18 |
| Full Playwright suite | **39 passed, 1 intentional skip**, 49.3 seconds; desktop and phone-emulated Chromium |
| TypeScript / Vite build | Passed, including the local public-source archive |
| Ruff | Repository-wide lint and format checks passed; original vendored source intentionally excluded |
| Fresh and copied Alembic verification | Head f83a90d16c24; no schema drift; all copied rows/schema unchanged across 30 tables |
| SQLite integrity | Both databases ok; zero foreign-key violations |
| Documentation and source ZIP | Local Markdown file links resolve; archive integrity and public-file/license inclusion verified |
| Git whitespace | Passed |

Existing classifier and wrong-label regression assertions were retained. New pin-exploitation cases pass for both colors; a raw double-check observation does not assert a mistake without meaningful engine evidence. No grading, native engine, FSRS or schema logic changed. Two older migration imports were reordered for repository-wide Ruff.

Browser verification caught and fixed a real regression: extra motif buttons could push the return control below a short phone viewport. Return and motif actions now share a compact wrapping row below the board/playback controls, preserving board/header geometry and focused-practice reachability. Existing viewport assertions remain intact. The new download assertion accepts the two platform ZIP MIME types and still checks successful HTTP delivery and ZIP content.

The first browser invocation lacked the installed Chromium path; the final complete run used .tools/playwright through PLAYWRIGHT_BROWSERS_PATH. The source build now selects the checkout virtual environment instead of the broken Windows python alias, with SOURCE_PYTHON override. Two existing TestClient deprecation warnings, terminal-color warnings and expected provider-failure fixture logs remain unsuppressed.

Tests use isolated databases. Migration preservation uses SQLite online backup from a read-only live connection; only the copy was migrated. Source archives exclude private data, secrets and untracked files. No LLM runtime or network dependency was added. Native grading and recall histories remain protected by the full regression suite.

The complete frozen comparison is a partly generator-related compatibility measurement, not independent classifier precision. Remaining gaps and private failure corpora are documented in LICHESS_REUSE.md. Physical-phone and cross-platform install checks remain separate from emulation.

Deployment: restarted the idle LAN backend at 192.168.1.12:8000 after committing the verified code. Health reports Stockfish 18 and classifier 4.0-lichess-8d9faff6. Before/after fingerprints confirm unchanged games, decisions, exercises, accepted answers, review sessions, reviews and SRS states. No bulk reclassification was run; Settings > Classify saved games applies the new version to saved evidence without new engine analysis.

## Lichess benchmark tooling: September 13, 2026

| Check | Result |
|---|---|
| Deterministic benchmark suite | **48 passed**, 0.26 seconds; all optional Zstandard tests ran |
| Full backend/native/API suite | **245 passed**, no skips, 25.28 seconds |
| Ruff lint | Passed for backend and scripts |
| Ruff formatting | Passed for backend, scripts and migrations; 99 files |
| External dataset run | Complete scan of 6,100,952 rows; 1,000 positives per 12 eligible mappings; 12,000 reconstructed incidences, zero skips, 2,260 disagreements |
| Corpus consistency | Counts match metrics; every exported witness move/actor/frame matches solver coordinates; 11,978 unique puzzle IDs |
| Production scope | No changes to trainer runtime, frontend, classifier rules, engine/grading/FSRS, schema, migrations or production dependency locks |

See the [benchmark guide](LICHESS_BENCHMARK.md) and [measured baseline](LICHESS_BENCHMARK_RESULTS.md). The dataset and complete reports/corpora stay under ignored data/lichess-benchmark. The run used Python 3.12, native application tests used the existing Stockfish 18, and the optional offline decoder was zstandard 0.25.0. Benchmark runs themselves use no engine, database, server or network.

Two existing upstream TestClient deprecation warnings remain; neither was suppressed. Fresh workspace basetemp/cache paths avoided Windows shared temporary-directory access problems. Tests and the benchmark did not restart the LAN application or change live data.

This developer-only pass did not rebuild or rerun the unchanged frontend or repeat manual fresh/copied migration verification. Those checks passed immediately before it, as preserved below; migration-related backend regressions still run in the full suite.

These are positive-theme line-detector measurements, not precision from absent tags or full-classifier accuracy. No rule was tuned against benchmark failures.

## Previous pass: interface ownership and documentation

Completed September 13, 2026 for the focused interface refactor and documentation-consistency pass. The repeatable procedure is in [TESTING.md](TESTING.md); previous milestone/deployment results are in [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md).

### Results

| Check | Result |
|---|---|
| Full backend/native/API suite | **197 passed**, no skips, 25.56 seconds |
| Full Playwright suite | **39 passed, 1 intentional skip**, 50.6 seconds; desktop and phone-emulated Chromium |
| TypeScript / Vite production build | Passed; final type-only correction produced the same runtime bundle |
| Ruff lint | Passed for backend and scripts |
| Ruff formatting | Passed for backend, scripts and migrations; 86 files |
| Fresh Alembic chain | Upgrade to f83a90d16c24 passed |
| Alembic schema drift | No new operations for fresh and copied databases |
| Copied-data preservation | All rows and schema unchanged across 30 tables, including alembic_version |
| SQLite validation | Integrity ok and zero foreign-key violations on fresh and copied databases |
| Documentation | Local files/headings resolve; complete original roadmap journal and course design preserved |
| Git whitespace | Passed |

The browser skip is the desktop instance of a test specifically for short phone viewports; that test passes in the mobile project. No test was weakened or removed.

Backend verification used fresh basetemp/cache_dir paths under ignored data to avoid Windows shared temporary-directory permissions. Native tests used Stockfish 18. The environment was Windows, Python 3.12 and Node 24.19; dependencies remain pinned by requirements.lock and frontend/package-lock.json.

Two existing upstream TestClient warnings remain: Starlette's httpx integration deprecation and AnyIO's BlockingPortal alias deprecation. Browser runner output also includes the existing terminal-color environment warning and expected job-failure logs from provider-error fixtures. These did not cause failures.

### Behavior preservation

The recorded pre-refactor OpenAPI contract covers 24 documented API paths, their methods, operation IDs, validation schemas and responses. A new regression compares that contract, and another verifies independent resources/access controls for two application instances.

All 34 original endpoint/helper/lifespan bodies matched by Python AST after extraction. All nine original frontend component/helper bodies retained compiled equivalence; the comparison joined adjacent React text children introduced by formatting. Existing browser regressions verify board identity, timing, geometry, focus, failure/reveal and persistence.

The refactor changes interface ownership only. Classifier, Stockfish, grading, FSRS, schemas and migrations are unchanged. The complete backend suite includes the native import-analysis-classification-exercise-review-restart flow and historical compatibility tests.

### Data and deployment scope

Migration validation used SQLite's online backup API to obtain a consistent copy, opening the live source read-only. Only fresh/copied databases were migrated; private verification artifacts stay under ignored data/code-health-20260913. Browser and API tests used isolated fixtures and did not submit reviews or analysis jobs to live data.

The production frontend was rebuilt. The running LAN backend was not restarted as part of this maintenance pass; it will load the extracted routers on its next normal restart. Binding and host configuration were unchanged.

Six current public screenshots were refreshed from inspected Playwright fixture captures; older images are explicitly historical in [screenshots/README.md](screenshots/README.md).

### Limits and deferred code health

- Review.tsx still contains a substantial related state/timer flow. A state-machine rewrite would require a separate interaction-focused task.
- Older frontend API payloads still include loose types and the generic client's any default. This pass typed the newly separated health/settings/import boundaries without introducing generated contracts.
- Some HTTP/domain queries still repeat lookups. Query optimization was left unchanged.
- curriculum.py still combines live weakness priorities with archived course helpers. Splitting domain responsibilities is outside this interface-only pass.
- Dependency upgrades to resolve upstream warnings, standalone wheel/static packaging, manual Linux/macOS installation and physical-phone LAN checks remain separate work.

Passing suites do not establish independent classifier accuracy or long-term chess improvement. No classifier rules or quality measurements were changed; see [CLASSIFICATION_ASSESSMENT.md](CLASSIFICATION_ASSESSMENT.md) for the existing assessment and its limits.
# Shared hosting verification — September 26, 2026

- Full backend suite: 298 passed; subsequent populated-database ownership migration
  test passed as part of the four-test account suite (299 backend tests now present).
- Ruff lint and format checks passed. TypeScript/Vite production build passed.
- Existing Playwright suite: 43 passed, one intentional desktop skip. Additional
  account suite: two passed, covering desktop and mobile and a second device.
- Docker image built from a public-source export because a local Windows cache ACL
  prevented Docker's context walker from reading the original checkout. Compose
  configuration validated with a placeholder public origin.
- Running non-root Linux image used native Stockfish 17.1. Synthetic smoke checks
  verified source download, signup, private libraries, fetch-only PGN imports,
  completed whole-game review, selected-game training, retained session/review
  after container restart, healthy container status, and a consistent SQLite
  backup restored with both accounts and foreign-key-safe application data.
- Tests used temporary databases/containers only. The user's real database has not
  been migrated and the Unraid deployment/proxy have not been changed.

## Game-review UX verification - September 26, 2026

- TypeScript/Vite production build passed.
- Full browser suite: 45 passed, one intentional desktop skip. After final
  presentation refinements, all six review-specific desktop/mobile tests passed.
- Browser checks cover 1366x768 board/timeline fit, visible move-quality markers,
  actual 280 ms piece transitions, reduced-motion feedback, short previews from
  deliberately long engine output, exact return anchors, nested variations,
  asynchronous ratings for rapid moves even after returning to the game,
  stale-response isolation, retryable engine errors and unchanged saved games.
- Desktop and phone screenshots were visually inspected. Shared-board training,
  legal moves, promotions and dragging passed the full browser suite.
- No engine classification policy, database schema or hosting configuration changed.
