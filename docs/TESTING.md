# Testing

Suite counts and the latest deployment checks are recorded in DEVELOPMENT_PLAN.md. Username-import date coverage includes both whole UTC endpoint days, either open endpoint, lookback override, irrelevant-archive pruning, reversed-range rejection and active-job request identity. Browser tests submit explicit dates and verify Look back is disabled while dates are set.

Incremental-import fixtures check 100 saved games plus 20 new games schedules exactly 20, duplicate entries do not consume the new-game limit, and duplicate-only imports create no analysis work. Native Stockfish plus an injected classifier verifies cancellation preserves the first response, retry never re-requests a completed decision, and a subsequent classification scan reuses all cached responses. Browser tests cover repeat PGN upload with no new job and repeat Chess.com fetch with zero analysis games. Fixtures use distinct per-device games where new analysis is expected.

Legal-move payload fixtures cover pins, castling, en passant, white/black promotions and all legal starting moves (including rejected exercise answers). Browser coverage checks quiet dots, capture rings, selected-square styling, switching/deselecting pieces, invalid targets, dragging, promotion and clearing/reselecting after feedback. No model API integration remains.

Concurrency fixtures verify overlapping injected classification tasks from one or multiple games, bounded worker counts, cancellation with cached retry, engine progress while classification waits, shared-cache coalescing across native processes, a native multi-game pipeline, and worker failure/shutdown followed by recovery. No paid requests are made.

Restart scheduling tests preserve exact serialized FSRS state, due timestamps and review counts across app recreation, exclude completed cards before due, and restore them at due. Browser tests verify next-review feedback and removal of a completed exercise URL on refresh.

## Commands

From an activated root checkout:

```sh
python -m pytest -q
ruff check backend scripts
ruff format --check backend scripts migrations
alembic upgrade head
alembic check
cd frontend
npm ci
npm run build
npx playwright install chromium
npx playwright test
```

PowerShell can use .venv/Scripts/python.exe, .venv/Scripts/ruff.exe, npm.cmd and npx.cmd without activation. PLAYWRIGHT_BROWSERS_PATH optionally selects an isolated browser install; TEST_PYTHON selects the browser test server's Python executable.

## Coverage
Rules: valid FEN, legal SAN/UCI, null-move rejection, castling, promotion, en passant, material, canonical keys, clocks/castling/pinned en passant, repetition engine contexts, White/Black normalization and signed/terminal mate scores.

Native integration: actual Stockfish startup, MultiPV, mate fixture, cache persistence and shutdown. Marked stockfish; missing executable explicitly skips. Set STOCKFISH_PATH; an ignored local .tools/stockfish install is also discovered.

Pipeline/API: multi-PGN import, learner ambiguity, dedupe, invalid-game isolation; schema/unknown skills/low confidence/unrelated evidence; failed classification retry and cache; provisional courses; repertoire variations/trained side; cold payloads, illegal/wrong/correct attempts, idempotent recall and reload; missing engine, LAN token and cross-origin rejection.

The central integration test exercises a real background worker via HTTP: upload → native analysis → injected mock classification → course/exercise → review → application restart. Production uses LocalClassifier; injected fixtures exercise failure/concurrency boundaries without changing production chess authority.

Backup tests verify round trip, secret exclusion, integrity and refusal to overwrite. Windows tests caught and fixed explicit SQLite connection cleanup.

Browser tests run the production build with a separate database under ignored data/. Desktop/mobile-emulated Chromium exercises manual entry, cold board, tapping, first failure, reload/retry, PGN analysis progress, native dragging and underpromotion selection. Screenshots/traces are retained in frontend/test-results. Mobile emulation is not physical-phone LAN verification.

Chess.com regression tests use HTTPX MockTransport for public responses; they cover filters, learner matching, shared PGN deduplication, newest limits, partial download resume/cancel, retry limits, unsafe URLs, invalid accounts and native analysis without OpenAI. Playwright uses a test-only app factory in backend/tests/browser_app.py to inject provider HTTP fixtures; it still runs the real backend, SQLite, Stockfish and production frontend. Desktop/mobile tests exercise username form defaults, changed limits, import/analysis progress, repeated-import duplicates and provider-error feedback. No automated test contacts Chess.com. A separate live read-only API smoke check is documented in CHESSCOM_IMPORT.md.

## Manual native fixture

Import as Learner:

```pgn
[White "Learner"]
[Black "Opponent"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
```

Confirm two learner decisions and a meaningful mistake. Local classification should identify the allowed-mate transition. Inspect its weakness evidence and classification audit; no key or model setup is needed. Try an illegal move, fail legally, reload, then solve/reveal; exactly one recall remains Again. Import repertoire variations and check curated answer authority. Test underpromotion and dragging on a physical phone.

## Environment and limits

Verified in this workspace on Windows, Python 3.12.10, Node 24.19 and native Stockfish 18; dependency versions are locked. Final counts/status live in DEVELOPMENT_PLAN.md. Current upstream TestClient dependencies emit httpx/AnyIO deprecation warnings; tests run without blanket warning suppression.

GitHub Actions run 34675280916 passed backend and frontend checks on Ubuntu. Historical model runs are retained as data only; detector precision/recall, manual Linux/macOS installation, physical LAN devices and hundreds-of-games performance remain outside automated verification. Test deployment-specific behavior explicitly.

Visual redesign checks visit all six screens at desktop and mobile sizes, verify active navigation semantics, absence of horizontal overflow, loaded local fonts and SVG favicon delivery. Existing board tests continue to cover taps, dragging, selection markers, promotion, failure/retry and review persistence. Full-page screenshots are generated under frontend/test-results for visual inspection.

Lesson fixtures test cold multi-position sequences, server-enforced order, python-chess playback, first-failure check rounds, graduation without fabricated SRS recalls, restart/refresh continuity, related groups and fresh follow-up sequences. Versioned classification tests retain old audits while reconciling active evidence and rejecting unsupported results. Tests for removed paid generation were retired; local-only API tests assert that generation and legacy teaching-job retries return 410. Native end-to-end coverage includes actual game analysis through lesson completion and persisted review. Normal tests make no paid calls.

Desktop/mobile course browser tests use a test-only fixture endpoint in browser_app.py; it is absent from production. Its synthetic engine records are for progression/UI verification only, and not chess truth. The real-engine vertical test covers chess integration separately. Teaching screenshots are UI fixtures, not a demonstrated model-quality evaluation.


Mobile review regression: the phone-only Playwright flow checks the entire board and Show move/Next position buttons fit without scrolling at 390x700, 375x600 and 360x640, including a failed attempt, later solution, expanded long explanation and next-position scroll reset. Tests use an isolated database and do not submit reviews to the user's live data. `test_successive_due_recalls_expand_intervals_across_restarts` exercises six successful API recalls with persisted FSRS state, queue exclusion before due, and an established-card lapse.

Retirement tests cover the strict 100-day boundary, actual successful FSRS recall retirement, idempotent duplicate completion, restart/reimport persistence, overdue-card startup reconciliation and stale unfinished-session rejection. Browser contract checks verify retirement replaces the next due date on desktop/mobile.

Wrong-answer visual regressions hold real grading responses to verify control coordinates remain unchanged through two misses, only one feedback message appears, and the pawn stays at its original square. A separate controlled-clock test records DOM changes to ensure a fast failed response never flashes the checking message or leaves a delayed loading timer behind. Both run on desktop and phone against the isolated test database.

Explanation tests cover candidate selection for accepted alternatives, negative learner-perspective material/mate scores for both colors, capture/promotion/castling/en-passant frames, illegal PV rejection, cross-session attempt rejection, pre-answer solution protection, curated mismatch wording, and no SRS mutation on playback. Desktop/mobile journeys exercise failure, reply playback, return, restart, accepted alternative, and dialog keyboard dismissal. Test explanation engine records carry synthetic scores for contract assertions; native engine integration remains covered separately.

## Local classifier

`test_local_classifier.py` covers fork/hanging direction and witness linkage for both colors; harmless, compensated, equal-loss and truncated lines; missing target collection; mate transitions including already-lost/still-winning mates; promotion; discovered/double check; malformed PV/actual move rejection; parameter changes; cached abstention/rejection; preserved SRS during backfill; and absence of provider configuration/paid job paths. Synthetic scores test rule logic only. The real-Stockfish vertical slice now uses LocalClassifier, and Chess.com worker tests exercise the default local runtime.

Run `python scripts/classification_report.py --database data/trainer.sqlite3 --output data/NEW-report.json` for a read-only coverage report. It opens SQLite in mode=ro and runs no engines or network requests. Reports contain private decision IDs and witness moves; keep them in ignored data/. Coverage is not precision or recall. Independent human labeling, game-separated holdout evaluation and detector-specific error measurement remain outstanding.


Lesson removal is covered by API 410 tests (including old lesson review-session IDs) and a whole-database migration snapshot comparison allowing only intended eligibility changes. Browser checks cover five navigation destinations, obsolete unit links, compact sticky mobile navigation, date disclosure/clear behavior, expandable settings, and widths 320-430 px. The import-analysis-classification-review-restart slice no longer requires a course.


Repertoire removal has a restart test that snapshots every database table, covers a failed unfinished repertoire attempt and a retired repertoire card, checks queue exclusion and HTTP 410 guards, and requires all rows to remain identical. Browser review fixtures now use the existing manual API directly; drag/drop, promotion, legal markers, failure/reload and scheduling coverage no longer depends on the removed form. Navigation assertions require four tabs.


Inline explanation regression checks compare exact header/title/board bounding boxes during loading, errors and playback, assert one unchanged board DOM node, exercise Escape/back focus restoration, and verify no additional recall events. Desktop and 375x600 phone layouts are covered; existing short-phone review controls remain in view.


Wrong-move visual regression tests assert the red outline, pointer-transparent tint, identical board/button geometry, cue clearing on retry/success/playback, and one recall despite repeated misses. Failed grading HTTP requests must not activate a mistake cue or create a recall.


Explanation text regression: a saved-response fixture makes the summary equal the reply annotation, matching the backend's fallback behavior. Playback must show that sentence once on the reply frame, retain distinct text on the preceding frame, and deduplicate again on advancing. Reveal button assertions use Reveal move.


## Classification v2 verification

New deterministic fixtures cover pin/skewer/sole-defender removal/back-rank positives, both-color witnesses, unpinned or extra defenders, unrelated checks, back-rank escape squares, pawn outcomes, compensated scores, unsettled captures and literal PV legality. These fixtures test contracts, not population accuracy.

Focused-practice API/restart tests cover correct, failed-then-solved and revealed outcomes, skill validation, exact-line explanation linkage, first-response timestamps and unchanged serialized SRS. Real Stockfish tests cover bounded persisted probe selection, cancellation after the first search, cache reuse, immutable original grading references, idempotent replay and changed probe settings. Migration was checked against every existing row of a copied and then live database; Alembic metadata and foreign-key checks pass.

Browser tests cover distinct outcome/pattern screens, all-example evidence browsing, focus practice, restored pieces at witness frames, square-role highlighting, unchanged recall counts, phone board/header geometry and the original import/review/reveal flows. Pattern controls sit beside playback so phone clicks do not scroll the board away.

For an independent quality assessment, export a stratified CSV with `python scripts/classification_report.py --sample data/sample.csv --output data/report.json`. Complete expected labels and fully_labeled flags manually, then use --annotations. Outcomes/mechanisms and development/holdout metrics remain separate; unknown, incomplete, duplicate or changed evidence must not count as a successful automated label. Independent human annotation is still required. See LOCAL_CLASSIFICATION.md for the labeling contract.
