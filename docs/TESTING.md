# Testing

The review-intelligence synthetic baseline corpus and native benchmark commands
are documented in [REVIEW_INTELLIGENCE.md](REVIEW_INTELLIGENCE.md). Its contract
tests run with ordinary pytest without Torch or a Maia checkpoint; native
Stockfish checks use the existing `stockfish` marker. Benchmark artifacts are
ignored private development output, not repository fixtures.

Opt-in Maia feasibility tests and CPU/CUDA benchmark commands are documented in
[MAIA_FEASIBILITY.md](MAIA_FEASIBILITY.md). Native `maia` tests require the pinned
optional runtime plus `MAIA_CHECKPOINT_DIR`; ordinary tests verify missing/corrupt
files, source pinning and complete-history inputs without importing Torch.

Production human-evidence contracts, ownership/cache invalidation, real process
deadlines, cancellation and Stockfish-only/refresh behavior are covered by
`test_human_evidence.py`, `test_human_runtime.py` and `test_human_review.py`.
The native production worker test requires the 79M checkpoint; it does not use
the feasibility adapter. See [HUMAN_MODELS.md](HUMAN_MODELS.md) for setup.

Run the complete suite for interface refactors. Normal tests use isolated databases, injected provider responses and local native Stockfish. They make no live Chess.com or model requests. Current results belong in [VERIFICATION.md](VERIFICATION.md); dated deployment and milestone results remain in [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md).

## Full verification

From an activated source checkout, install the locked Python dependencies and frontend dependencies as described in [README.md](../README.md). Build first: backend static-serving tests and Playwright consume frontend/dist. Do not rebuild it while those suites are running.

```sh
cd frontend
npm ci
npm run build
npx playwright install chromium
cd ..
python -m pytest -q
ruff check backend scripts migrations
ruff format --check backend scripts migrations
cd frontend
npx playwright test
npx playwright test --config playwright.coach.config.ts
```

Run all Playwright projects; a grep-filtered subset is not the full frontend suite. Tests run serially against the production build and a test server on 127.0.0.1:8765. Reports/screenshots/traces are under frontend/test-results; an optional JSON reporter can preserve machine-readable results.

The separate coach suite starts `npm run dev:coach` on 127.0.0.1:5174 and runs the
expression/animation tests in `frontend/studio-tests`. It needs no backend, login,
database or Stockfish. Production browser tests verify that Settings still offers
coach selection but no expression viewer, and that `/coach-studio` is not an app
route. CI runs the application, account and standalone studio suites separately.

PowerShell can use .venv/Scripts/python.exe, .venv/Scripts/ruff.exe, npm.cmd and npx.cmd without activation. PLAYWRIGHT_BROWSERS_PATH optionally selects an installed Chromium directory; TEST_PYTHON selects the browser test server's Python executable.

Set STOCKFISH_PATH for native tests. The test fixtures also discover a compatible ignored .tools/stockfish installation. Missing native Stockfish explicitly skips the marked integration tests; document those skips rather than reporting full chess integration coverage. Playwright's real analysis flows need a working native engine.

If Windows denies shared temporary/cache directory access, use fresh paths inside ignored data, for example:

```powershell
.venv/Scripts/python.exe -m pytest -q --basetemp data/verification/run-NEW -o cache_dir=data/verification/cache-NEW
```

## API contract changes

Define or update response models in `backend/trainer/contracts/` and wire them to
their FastAPI endpoints. Reuse existing chess evidence schemas where appropriate.
After an intentional API change, run from the repository root:

```sh
python scripts/export_api_contract.py
npm --prefix frontend run api:generate
```

Review both generated diffs along with the endpoint implementation. Never edit
`frontend/src/api.generated.ts` by hand. The OpenAPI fixture includes hosted
authentication endpoints; tests also check local mode's subset. Exporting starts
no workers or engines and does not read the configured application database.

`python scripts/export_api_contract.py --check` verifies backend/schema agreement.
`npm --prefix frontend run api:check` verifies schema/TypeScript agreement.
`npm --prefix frontend run test:types` checks endpoint inference and rejects
intentionally invalid calls. Both frontend checks run as part of `npm run build`;
backend contract tests and the export check run in correctness CI. Browser tests
exercise the typed client's real JSON/multipart requests, authentication and errors.

## Migrations and data preservation

Use a disposable database for verification, never the live database by accident. From the root, POSIX shell:

```sh
DATABASE_PATH=data/verification/fresh-NEW.sqlite3 python -m alembic upgrade head
DATABASE_PATH=data/verification/fresh-NEW.sqlite3 python -m alembic check
```

PowerShell equivalent, in a separate verification terminal:

```powershell
$env:DATABASE_PATH = 'data/verification/fresh-NEW.sqlite3'
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m alembic check
```

Choose a new filename to exercise the full chain. Also use the supported backup/restore CLI to create a consistent copy of existing data, point DATABASE_PATH at the restored copy, and repeat upgrade/check. Export from a terminal using the real database configuration before setting the verification override. Never migrate a raw copy of an open SQLite main file without its committed WAL state.

Check SQLite integrity and foreign keys on both results. For a pass with no schema changes, compare every copied table's rows and schema before/after. Schema-changing work instead needs explicit migration preservation assertions, such as the existing lesson-release and classification migration tests. Keep all backups and reports in ignored data.

## Coverage and authority

| Area | Important contracts |
|---|---|
| Chess rules and scores | FEN/PGN validation, SAN/UCI, castling, en passant, both-color promotions, canonical keys, draw/history context, material, learner perspective and signed/terminal mate scores |
| Native Stockfish | Startup/shutdown, MultiPV, tactical/mate fixtures, compatible persistent cache, concurrent cache coalescing and recovery |
| Policy/review/FSRS | Multiple sound answers versus best-only, unlisted answer verification, no failure on unavailable grading, first-failure-once, reveal, restart/due behavior, retirement and raw timing |
| Imports and jobs | Learner ambiguity, invalid-game isolation, cross-source duplicates, date/time-class limits, new-game budgets, resumable downloads, cancellation/retry and bounded engine/classification pools |
| Local classification | Verified witness linkage, positive/negative/mirrored fixtures, abstention, rejected/cached results, adaptive endpoints, connected patterns, defensive probes and unchanged grading/SRS during enrichment |
| HTTP interface | Local/hosted OpenAPI agreement, typed success responses, rejection of incompatible payloads, generated endpoint-specific frontend types, account isolation, access token/origin rejection, cold payloads, errors and archival guards |
| Data compatibility | Historical lesson/repertoire/audit preservation, archived route 410s, manual API, backup round trip/secret exclusion/integrity/no overwrite |
| Quality tooling | Blinded packets, evidence fingerprints, frozen comparisons, reviewer provenance, human/assistant separation and exclusion of uncertain/invalid labels; external positive-theme mappings, solver reconstruction, reproducible reservoirs, witness linkage, metrics and disagreement exports |

The central native vertical test runs an actual background worker through HTTP: PGN import, learner analysis, LocalClassifier, persisted evidence/exercise, review and application restart. It does not require a course. Injected classifiers cover failures and concurrency separately.

Synthetic legal positions and fabricated engine scores test detector and API contracts; they are not proof of objective chess quality. Real Stockfish tests separately verify UCI integration and tactical/defensive fixtures. Historical lesson tests seed archived rows explicitly and verify preservation, audit access and rejection of practice; production lesson generation and progression have been removed.

## Browser coverage

Desktop and phone-emulated Chromium cover all **five** navigation destinations, local fonts/favicon, horizontal overflow, compact mobile navigation, date filters, account settings, obsolete unit links and evidence dialog focus.

Review journeys cover taps, drag/drop, legal dots/capture rings, promotion, failure/counter preview, Try again, Reveal move, solve/reload and saved scheduling. The phone-only test checks 390x700, 375x600 and 360x640 layouts; its desktop instance is intentionally skipped.

Regression checks preserve header/title/board/control geometry through loading, wrong answers and inline explanation playback. They verify one board node, a visible red mistake cue, no flash on fast grading, cue clearing, no cue or recall on failed HTTP requests, deduplicated explanation text, and keyboard/focus restoration.

Focused practice checks witness frames/square roles and unchanged recall counts. Chess.com tests submit dates, download mocked archives, run real analysis, repeat imports without analysis duplication, and show provider failures.

Browser fixtures create manual exercises through the retained low-level API. There is no Repertoire/manual-entry screen or lesson browser journey. Test-only fixtures are in backend/tests/browser_app.py and are absent from production. Screenshots contain fixture data, not the user's games. Mobile emulation is not physical-phone LAN verification.

## Manual native smoke flow

Import this PGN as Learner:

```pgn
[White "Learner"]
[Black "Opponent"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
```

Confirm two learner decisions and an engine-verified meaningful mistake. Local classification should identify the allowed-mate transition. Inspect Weaknesses and its audit; the evidence is provisional because it comes from one game.

Open Review, try an illegal input, make a legal failure, view the counter/deeper line, reload, then solve or reveal. The session should retain exactly one Again recall. Complete the session, reload, and check the saved due state. Reimporting the PGN should create no new analysis job. On a physical phone, also check board reachability, drag/tap interaction and LAN access.

## Quality evaluation and limits

For a read-only coverage report:

```sh
python scripts/classification_report.py --database data/trainer.sqlite3 --output data/NEW-report.json
```

The script opens SQLite read-only and runs no engines or network requests. Blinded sampling, annotation and frozen-comparison commands are documented in [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md#configuration-and-evaluation). Reports contain private evidence and belong in ignored data.

Passing tests establish implementation contracts, not population classifier accuracy or long-term chess improvement. The first [assistant assessment](CLASSIFICATION_ASSESSMENT.md) preserves uncertain cases and provenance; independent human/game-separated holdout evaluation remains outstanding.

### Offline Lichess benchmark

Use [LICHESS_BENCHMARK.md](LICHESS_BENCHMARK.md) for local CSV/compression setup, theme semantics and sampling commands. This developer tool tests the production line detector without a database, engine, server, model or network. It adds no application puzzle feature. [The initial external baseline](LICHESS_BENCHMARK_RESULTS.md) is a separate measurement from passing synthetic tests.

```sh
python -m pytest -q backend/tests/test_lichess_dataset.py backend/tests/test_lichess_benchmark.py
```

The 48 tests use tiny synthetic CSV/position fixtures, including deliberately incorrect tags for the miss path. They cover both colors, setup-versus-solver replay, special moves, detector/subtype invocation, initial versus later episodes, per-theme sample independence, reproducibility, positive denominators, corpus context and corrupt/truncated input. No full dataset is checked in or downloaded by tests. Four Zstandard tests skip with a clear reason if its optional developer dependency is absent; all other harness tests still run.

The first actual dataset run scanned 6,100,952 rows and tested 12,000 theme-puzzle incidences. Missing tags are never negatives, and the adapter's observed material gains are not native engine truth. Blinded human precision and full-classifier recall remain separate validation tasks.

Record host/tool versions, skipped tests and warnings with results. Current TestClient dependencies emit httpx/AnyIO deprecation warnings; do not hide them with blanket suppression. Manual Linux/macOS installation, physical devices and larger-import performance need separate validation.

### Pinned Lichess reuse and source availability

test_lichess_reuse.py checks predicate AST parity against original upstream fingerprints, unchanged supporting files, legal replay, both colors, missing setup context, witness coordinates and concurrent observer isolation. test_lichess_integration.py checks newly recognized pin exploitation and separates a visible motif from an unsupported mistake diagnosis. Existing wrong-label regressions remain unchanged.

test_lichess_comparison.py verifies frozen sample/provenance preservation, metrics, failure context, malformed rows and unexpected-error handling. test_source_archive.py checks private-file exclusion, reproducible source archives, path validation and rebuilding an exported snapshot without Git. Browser tests verify the Settings source link returns a ZIP through the production static mount.

Raw upstream parity across the frozen sample is a compatibility test, not an accuracy estimate. Source packaging does not add a runtime network dependency.
## Shared-hosting checks

`pytest backend/tests/test_accounts.py backend/tests/test_game_sync.py backend/tests/test_hosted_runtime.py -q` covers
cross-account IDs, writes, aggregate counts, device sessions, restart persistence,
legacy data migration and engine-free recent-game sync. Browser account flows use
`cd frontend` then `node_modules/.bin/playwright test --config playwright.accounts.config.ts`.
That config creates an independent disposable account database and tests desktop
and mobile signup, remembered usernames, sync, second-device login and isolation.
The default Playwright config explicitly keeps single-user fixture mode.

Correctness CI runs the local and account configurations as independent matrix
jobs with fail-fast disabled. Both must succeed before Docker publishing can run.
The account configuration writes to `frontend/account-test-results`, so local runs
of the two suites do not overwrite each other's traces.

`test_hosted_runtime.py` verifies that 250 idle accounts add no applications,
coordinators or retained scopes; account jobs recover without login; same-account
analysis stays ordered while other accounts and fetch-only jobs can progress;
concurrent HTTP requests/jobs keep their own data and share the native engine
budget; and shutdown drains work for restart. It also checks that startup
retirement reconciliation leaves disabled and reserved local accounts unchanged.

## Docker install verification

Build the image and run the same smoke test used by correctness CI:

```sh
docker build -t fieldwork:install-check .
python scripts/smoke_install.py --image fieldwork:install-check
```

The script creates uniquely named containers with anonymous data volumes and
loopback-only ephemeral ports, then removes those containers and volumes on exit.
Both local and account modes must serve the frontend, survive a restart, import a
synthetic game and complete its review through the application's native Stockfish
worker. Account mode additionally checks signup, session persistence, origin
rejection, secure cookies and the lazy engine's health transition from unchecked
to ready. Local mode verifies engine readiness at startup.
Both modes verify default coach preferences and a saved black-cat character and
motion preference after restart, exercising preference persistence and ownership.

Hosted requests emulate the headers forwarded by a TLS-terminating reverse proxy;
this does not verify a live proxy or Cloudflare configuration. The test neither
publishes the image nor touches an existing installation.

## Review intelligence refinement

`test_review_refinement.py`, `test_refinement_search.py` and
`test_refinement_storage.py` cover nomination caps, depth/consistency guards,
immutable baseline facts, native cancellation without partial cache writes,
shared-slot cancellation, resume, optional failure, revision polling,
account-private references and legacy migration. Game browser tests exercise
earlier-ply revisions and stable board geometry at desktop/mobile widths. Native
benchmarks and their limitations are documented in [REVIEW_REFINEMENT.md](REVIEW_REFINEMENT.md).
