# Testing

Current verified suite: 59 backend tests and 12 desktop/mobile browser tests. Username-import date coverage includes both whole UTC endpoint days, either open endpoint, lookback override, irrelevant-archive pruning, reversed-range rejection and active-job request identity. Browser tests submit explicit dates and verify Look back is disabled while dates are set.

Incremental-import fixtures check 100 saved games plus 20 new games schedules exactly 20, duplicate entries do not consume the new-game limit, and duplicate-only imports create no analysis work. Native Stockfish plus an injected classifier verifies cancellation preserves the first response, retry never re-requests a completed decision, and a subsequent classification scan reuses all cached responses. Browser tests cover repeat PGN upload with no new job and repeat Chess.com fetch with zero analysis games. Fixtures use distinct per-device games where new analysis is expected.

Legal-move payload fixtures cover pins, castling, en passant, white/black promotions and all legal starting moves (including rejected exercise answers). Browser coverage checks quiet dots, capture rings, selected-square styling, switching/deselecting pieces, invalid targets, dragging, promotion and clearing/reselecting after feedback. These tests use no live OpenAI calls.

Concurrency fixtures verify overlapping OpenAI calls from one or multiple games, bounded worker counts, cancellation with cached retry, engine progress while classification waits, shared-cache coalescing across native processes, a native multi-game pipeline, and worker failure/shutdown followed by recovery. No paid requests are made.

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

Pipeline/API: multi-PGN import, learner ambiguity, dedupe, invalid-game isolation; schema/unknown skills/low confidence/unrelated evidence; mock SDK boundary, failed classification retry and cache; provisional courses; repertoire variations/trained side; cold payloads, illegal/wrong/correct attempts, idempotent recall and reload; missing engine, LAN token and cross-origin rejection.

The central integration test exercises a real background worker via HTTP: upload → native analysis → injected mock classification → course/exercise → review → application restart. No normal test makes a live OpenAI call and production has no fake classifier mode.

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

Confirm two learner decisions and a meaningful mistake. Without OpenAI, review works and unclassified evidence is reported. With classification deliberately enabled, inspect a course unit's evidence and audit. Try an illegal move, fail legally, reload, then solve/reveal; exactly one recall remains Again. Import repertoire variations and check curated answer authority. Test underpromotion and dragging on a physical phone.

## Environment and limits

Verified in this workspace on Windows, Python 3.12.10, Node 24.19 and native Stockfish 18; dependency versions are locked. Final counts/status live in DEVELOPMENT_PLAN.md. Current upstream TestClient dependencies emit httpx/AnyIO deprecation warnings; tests run without blanket warning suppression.

GitHub Actions run 34675280916 passed backend and frontend checks on Ubuntu. Real Terra responses have succeeded in a user-started job; live output quality, manual Linux/macOS installation, physical LAN devices and hundreds-of-games performance remain outside automated verification. Test deployment-specific behavior explicitly.
