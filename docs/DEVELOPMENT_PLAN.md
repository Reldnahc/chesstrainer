# Development plan

Fieldwork is a private, review-centered chess trainer. The current navigation is Review, Weaknesses, Import and Settings. Product behavior and known limits live in [PRODUCT.md](PRODUCT.md) and [FEATURE_STATUS.md](FEATURE_STATUS.md); this document tracks current work and remaining priorities.

## Current state

- PGN and filtered Chess.com imports feed persistent local analysis jobs, native Stockfish and versioned local mistake classification.
- Review supports multiple sound answers, legal-move interaction, failure counters, reveal and verified line playback. Focused practice is separate from scheduled recall.
- FSRS retains completed work across restart and permanently retires positions above the configured interval threshold.
- SQLite migrations, compatible engine/rule caches, cancellation/retry, LAN operation and backup/restore are implemented.
- Classifier v4 reuses pinned Lichess motif recognition with retained Fieldwork evidence gates. [LICHESS_REUSE.md](LICHESS_REUSE.md) records the frozen comparison; the earlier assistant assessment remains historical and independent human precision is still unmeasured.
- Lessons, course UI, Repertoire and model connectivity are removed. Historical data, tombstone routes, teaching audits and the low-level manual exercise API are retained for compatibility.

## Active classifier work: reuse Lichess recognition

Requested September 13, 2026. [LICHESS_REUSE.md](LICHESS_REUSE.md) records the pinned source, direct comparison and implementation plan.

| Stage | Status |
|---|---|
| Unmodified upstream comparison on frozen samples | Complete: 12,000 incidences, materially broader recognition |
| Pinned source, witness adapter and parity tests | Complete: 19 tests; all 12,000 upstream theme sets preserved |
| Classifier/review integration and regression verification | Complete: upstream recognition, retained outcome/episode gates and reviewed witnesses; regression contracts pass |
| Final measurements, documentation and deployment status | Verified: frozen 12,000-incidence comparison, 280 backend tests, 39 Playwright passes plus one intentional skip, migrations, Ruff and build; deployment status in VERIFICATION.md |

Preserve Stockfish/grading/FSRS and historical data. Reuse actual upstream predicate logic, preserve its license, and distinguish recognized line motifs from supported mistake diagnoses.

## Completed developer tooling: Lichess positive-theme benchmark

Completed September 13, 2026. Offline streaming benchmark over an external tagged dataset, reusing the production line detector without altering application behavior. [LICHESS_BENCHMARK.md](LICHESS_BENCHMARK.md) records the evaluation boundary and limitations.

| Stage | Status |
|---|---|
| Theme semantics, streaming sampling and legal reconstruction | Complete: independent reservoirs, compressed-frame validation and legal replay |
| Production adapter, metrics, reports and failure corpus | Complete: shared detector, subtype projections, separate initial-episode metric and complete JSONL context |
| Deterministic tests, initial external run and documentation | Complete: 48 harness tests, 245 full backend tests; 1,000 positives per eligible theme across the full dataset; baseline and limitations documented |

No product integration, classifier tuning, database/schema writes, model calls or missing-tag negative labels. Dataset and generated reports stay in ignored data. [Initial results](LICHESS_BENCHMARK_RESULTS.md) preserve the measured per-theme gaps; independent human precision remains separate.

## Completed maintenance pass: interface ownership and documentation

Completed September 13, 2026. Starting assessment: a clean worktree; App.tsx contains 251 dense lines covering navigation, review, import, settings and evidence dialogs. api.py contains 531 lines covering application resources, access controls, all endpoint groups and static serving. Existing domain services, shared mutation lock, injected factories and test fixtures are reusable.

| Stage | Work | Status |
|---|---|---|
| 1 | Record API contracts; move cohesive endpoint groups into router factories; retain application lifecycle, locks, public request models and app.state compatibility | Complete: 61 focused tests; API schema and handler-body parity verified |
| 2 | Separate existing frontend screens, evidence dialog and shared display/navigation helpers; preserve state ownership, markup and interaction timing | Complete: compiled component parity, production build and full Playwright suite (39 passed, one phone-only desktop skip) |
| 3 | Audit current documentation and workflows; distinguish active APIs from archived/tombstoned behavior; replace stale screenshots where needed | Complete: current guides corrected; original journal/course design preserved; six screenshots refreshed |
| 4 | Full backend/native/API suite, migrations, Ruff, TypeScript/Vite build and all Playwright projects; fix regressions; record results and commit | Complete: all checks pass; full results and limits in VERIFICATION.md |

Backend directory: `backend/trainer/routes/` for imports, jobs, review, classification, workspace and compatibility routers; `api.py` remains the application composition root. HTTP middleware/error/static helpers stay in the interface layer. Router factories receive the existing resources explicitly; no new service framework or domain abstraction.

Frontend follows the existing small flat module layout: App retains navigation, connection and shared errors; Review, Import and Settings own their current state and actions; EvidenceDialog and PageTitle own their reusable display boundaries. The existing Board, ReviewExplanation, MoveStatus, ChessComImport and Weaknesses components are reused.

Constraints: no product, classifier, engine, grading, scheduling or schema changes. Preserve endpoint paths, methods, status codes, payload validation, audit access, tombstones and historical records. Keep private games/databases/reports out of commits. Complete and commit each verified stage; publish only when requested.

## Remaining work after maintenance

1. **Independent classification quality.** Inspect external benchmark disagreements without fitting rules to the sample. Review stratified real-game positive findings blindly with human labels to estimate precision; include abstentions in any separate recall study and keep game-separated holdouts. The completed puzzle benchmark measures shared line-detector positive agreement, not full-classifier recall or real-game precision.
2. **Practical improvement measurement.** Evaluate retention and recurring mistakes across new games; do not equate a label or recall interval with chess mastery.
3. **Reliability and scale.** Profile larger imports on representative hosts, verify manual Linux/macOS installation and physical-phone LAN behavior, and document resource tradeoffs.
4. **Code health.** Reassess remaining large review interaction code, loose frontend API types, query duplication and archived domain boundaries when a concrete maintenance task justifies changes.
5. **Packaging and maintenance workflows.** Standalone wheel/static-asset packaging, a supported engine-upgrade reanalysis path and fuller configuration management remain open. Existing source-checkout installation, environment settings and CLI backups are the supported workflows.

These are future tasks, not additions authorized by the maintenance pass. Lessons/repertoire redesign, synthetic positions, cloud sync, public hosting and model runtime work remain outside the current product direction.

## Where to find history and verification

- [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md) preserves the previous milestone narrative, deployment journal and dated test results, including superseded workflows.
- [DECISIONS.md](DECISIONS.md) records architectural decisions and their rationale; historical entries are read in date/order context.
- [TESTING.md](TESTING.md) is the repeatable current verification procedure.
- [VERIFICATION.md](VERIFICATION.md) records the latest completed pass and its limits, without appending deployment logs to this roadmap.
