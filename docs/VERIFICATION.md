# Verification status

The repeatable procedure is in [TESTING.md](TESTING.md). The latest developer-tooling pass is below; the preceding full interface/frontend/migration pass is retained separately with its original scope and results.

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
