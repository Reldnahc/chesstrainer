# Testing

Study lesson coverage: `test_study_lessons.py` checks authored content and session
boundaries; `test_lesson_journey.py` traverses a connected six-step-type chapter
through HTTP/restart persistence. `study-lessons.spec.ts` runs that journey and
resume/alternate-path checks on desktop and mobile. Run `study-puzzles.spec.ts`
alongside it when changing the shared display-only playback helper. Test fixture
providers are injected only by the test application, never production flags.

`study-start-retry.spec.ts` drops responses after real session creation commits
and verifies same-session retries for chapters, opening rehearsals and puzzles
on both viewports. Its helper tests also check request identity after successful
creation and after changing the selected target.

`test_chess_core.py`, `test_puzzles.py`, `test_lesson_castling.py` and
`test_opening_castling.py` cover equivalent castling notation, canonical playback
and illegal promotion suffixes. Lesson/opening tests preserve authored snapshots
and course fingerprints; opening tests also preserve scheduling across equivalent
answer spellings. `test_opening_lifecycle.py` bounds SQL query counts as stale
unfinished recalls accumulate, while retaining active-session queue precedence.

`test_italian_course.py` walks every bundled Italian chapter, accepted decision,
branch, source-game endpoint and rehearsal through the production paths. It
verifies that completion leaves existing reviews, FSRS and weakness evidence
untouched, and enrollment remains explicit. `test_italian_native.py` uses native
Stockfish for a bounded gross-error check of guided decisions, not as the lesson
grader. `italian-course.spec.ts` exercises the real installed course on both
viewports, including exact returns, reload and optional enrollment.
It also checks legal destinations during the first drag after lesson input is
enabled, with both Natural and Still motion, across consecutive guided moves.

The account browser suite resumes lessons, puzzle attempts, selected lines and
the chosen coach on a second device, then confirms another account cannot read
their private sessions or studies. Its authenticated puzzle fixture alias exists
only in `browser_app.py`. `scripts/smoke_install.py` also checks the installed
Italian course, empty production puzzle library, lesson restart and explicit
opening enrollment in fresh local/account containers without starting analysis.

Opening recall coverage: `test_opening_sources.py`, `test_opening_lifecycle.py`,
`test_opening_isolation.py` and `test_opening_journey.py` cover both source kinds,
transpositions/answer unions, source snapshots, content policy, ownership,
concurrency and stale scheduling guards through actual Review/FSRS paths. Run the
existing retirement, review-restart, repertoire-archive and focused-practice tests
with them. `opening-library.spec.ts` and `opening-due.spec.ts` check browser
enrollment, dedicated rehearsal, cold context, exact Due counts and stale resume
on desktop/mobile. No engine is needed to grade opening recall; tests fail if one
is unexpectedly called. Every browser study fixture is paused during cleanup.

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

## Native whole-game intelligence verification

With the optional runtime, a verified cached model and Stockfish installed:

```sh
STOCKFISH_PATH=/path/to/stockfish HUMAN_MODEL_PATH=/path/to/maia3-79m.pt \
  HF_HUB_OFFLINE=1 python scripts/verify_review_intelligence.py \
  --output data/verification/native-NEW
```

PowerShell sets those environment variables with `$env:NAME = 'value'` before
running Python. Use a new output directory; the command refuses to overwrite one.
It never downloads weights. The ten original synthetic games contain 114 plies,
ratings from 600 to 2600, Chess.com/Lichess/unknown domains, quiet and tactical
play, a sound queen offer, annotated clock pressure, recovery, repeated errors,
conversion/lost conversion, book errors and draws. Coverage tags describe
inspection targets, not promises that every native search produces a motif.

The harness exercises the actual import/job/report/variation APIs at the unchanged
depth-16 / 0.8-second baseline and default 8-position / 4-question refinement
budgets. It validates native policies and context references, no SRS creation,
all registered coach IDs preserving the exact saved facts, and restart/reopen
with no new evidence rows or native processes. JSON reports can be imported into
the separate intelligence lab; the disposable SQLite file can be served locally
for manual application inspection. Keep all outputs in ignored `data/`.

Run the same command in a disposable Docker container with `--network none`, the
model mounted read-only, and a writable new output path such as `/tmp/verification`.
The smaller `scripts/smoke_human.py` checks a short native review and cached restart.
Neither harness replaces deterministic false-positive tests, account/concurrency
tests, or physical-device testing. Native scores and nominated positions can vary
across Stockfish binaries and available compute; identical model inputs remain
deterministic within their recorded runtime identity.

Run the complete suite for interface refactors. Normal tests use isolated databases, injected provider responses and local native Stockfish. They make no live Chess.com or model requests. Current results belong in [VERIFICATION.md](VERIFICATION.md); dated deployment and milestone results remain in [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md).

## Study frameworks

`test_puzzles.py` exercises the production puzzle routes with injected local
definitions: legal multi-step replay, fail/retry/reveal, durable snapshots,
duplicate/stale commands, account isolation and unchanged Review/FSRS/weakness
records. The production provider registry is empty. Browser fixtures are wired
only in `backend/tests/browser_app.py`; they are not installed content or a
production feature flag. Legacy Review links remain part of navigation coverage.

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
npx playwright test --config playwright.accounts.config.ts
npx playwright test --config playwright.coach.config.ts
npx playwright test --config playwright.intelligence.config.ts
```

Run all Playwright projects; a grep-filtered subset is not the full frontend suite. Tests run serially against the production build and a test server on 127.0.0.1:8765. Reports/screenshots/traces are under frontend/test-results; an optional JSON reporter can preserve machine-readable results.

The separate coach suite starts `npm run dev:coach` on 127.0.0.1:5174 and runs the
expression/animation tests in `frontend/studio-tests`. It needs no backend, login,
database or Stockfish. Production browser tests verify that Settings still offers
coach selection but no expression viewer, and that `/coach-studio` is not an app
route. CI runs the application, account and standalone studio suites separately.
The independent [intelligence laboratory](INTELLIGENCE_LAB.md) runs on port 5175;
its suite verifies evidence inspection, production-renderer parity and isolation.

### Coach cast and behavior

The roster is defined by the production registry. `coach-selection.spec.ts`
checks all 30 choices in the compact six-by-five Settings grid, stable order, no
category headings, narrow layouts,
retired-ID fallback, saved selection and the actual review avatar. Account tests
verify the same preference survives another browser session and remains private.
Backend preference tests cover every ID, restart, unknown IDs and explicit
retired mappings without rewriting stored rows during reads.

`studio-tests/motion-vocabulary.spec.ts` checks every 20-expression/four-idle pool,
nonrepetition and anatomy-specific gestures. `idle-articulation.spec.ts` mounts
all 2,400 slots and checks their browser animation targets. `idle-cadence.spec.ts`
checks repeated 500–1000ms gaps, 1200ms gestures, expression changes, reaction
isolation, motion preferences and hidden/offscreen pausing with controlled time.
`full-cast.spec.ts` exercises the complete studio, independent idle replay,
same-expression comparisons and the tablet singleton layout.

The intelligence suite compares ten shared situations across the full cast,
including tactical mistakes, human-policy evidence, recovery, positional play,
forced defense and cold SRS. It checks deterministic output, intact provenance,
required factual slots, claim limits, composition strategies, safe alternatives,
and common-intent fallback coverage. These are correctness checks, not a test
that everyone will enjoy every voice. Use the lab's blind comparison and inspect
the coach studio at actual portrait sizes for that creative review.

When running independent studio checks concurrently, give each Playwright run
a distinct `--output=studio-test-results-NAME` directory. Sharing an output
directory can remove another run's active trace files during setup.

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
`npm --prefix frontend run test:types` checks endpoint inference, rejects
intentionally invalid calls, and strictly typechecks all application, coach-studio
and intelligence-lab browser tests and their Playwright configs. The browser-test
project includes Node 24 declarations for its runner and fixture helpers; fixtures
must satisfy the same generated API contracts as the application. Both frontend
checks run as part of `npm run build`;
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

Desktop and phone-emulated Chromium cover all **four** navigation destinations (Study, Games, Weaknesses, Settings), Study subpages, local fonts/favicon, horizontal overflow, compact mobile navigation, date filters, account settings, obsolete unit links and evidence dialog focus.

Review journeys cover taps, drag/drop, legal dots/capture rings, promotion, failure/counter preview, Try again, Reveal move, solve/reload and saved scheduling. The phone-only test checks 390x700, 375x600 and 360x640 layouts; its desktop instance is intentionally skipped.

Regression checks preserve header/title/board/control geometry through loading, wrong answers and inline explanation playback. They verify one board node, a visible red mistake cue, no flash on fast grading, cue clearing, no cue or recall on failed HTTP requests, deduplicated explanation text, and keyboard/focus restoration.

Focused practice checks witness frames/square roles and unchanged recall counts. Chess.com tests submit dates, download mocked archives, run real analysis, repeat imports without analysis duplication, and show provider failures.

Browser fixtures create manual exercises through the retained low-level API and inject puzzle/lesson sources through test providers. There is no Repertoire/manual-entry screen; authored Study lessons have connected browser journeys. Test-only fixtures are in backend/tests/browser_app.py and are absent from production. Screenshots contain fixture or bundled course data, not the user's games. Mobile emulation is not physical-phone LAN verification.

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

Semantic review coverage: `test_review_events.py` and `test_review_clocks.py`
exercise each event family, positive/negative evidence, deterministic identities,
clock arithmetic and invalid/absent annotations, import/restart preservation,
arbitrary-branch exclusion, and cold-SRS API protection. Fixtures contain legal
synthetic positions; their synthetic evaluations are rule inputs, not benchmark
chess claims. Native review/human smoke verifies the combined production path.

## Game provider imports

`test_game_providers.py`, `test_chesscom.py`, `test_game_sync.py` and
`test_hosted_runtime.py` exercise adapter normalization, stream bounds, checkpoints,
rate-limit cooldown, account isolation, upgrade migration and the engine-free fetch
lane. `frontend/tests/providers.spec.ts` covers Lichess/manual imports, opt-in native
training, multi-provider refresh and delayed username hydration on desktop/mobile.
Provider HTTP responses are injected; no test needs a real player's credentials.
