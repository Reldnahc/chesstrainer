# Development plan

Fieldwork is a private, review-centered chess trainer. The current navigation is Review, Weaknesses, Import and Settings. Product behavior and known limits live in [PRODUCT.md](PRODUCT.md) and [FEATURE_STATUS.md](FEATURE_STATUS.md); this document tracks current work and remaining priorities.

## Current state

- PGN and filtered Chess.com imports feed persistent local analysis jobs, native Stockfish and versioned local mistake classification.
- Review supports multiple sound answers, legal-move interaction, failure counters, reveal and verified line playback. Focused practice is separate from scheduled recall.
- FSRS retains completed work across restart and permanently retires positions above the configured interval threshold.
- SQLite migrations, compatible engine/rule caches, cancellation/retry, LAN operation and backup/restore are implemented.
- Classifier v3.1 is deployed. Its first assistant assessment is documented in [CLASSIFICATION_ASSESSMENT.md](CLASSIFICATION_ASSESSMENT.md); independent human accuracy remains unmeasured.
- Lessons, course UI, Repertoire and model connectivity are removed. Historical data, tombstone routes, teaching audits and the low-level manual exercise API are retained for compatibility.

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

1. **Independent classification quality.** Review unseen games with human labels, include abstentions, keep game-separated holdouts, and report per-mechanism precision/recall separately from coverage. A larger labeled sample is needed before stronger accuracy claims.
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
