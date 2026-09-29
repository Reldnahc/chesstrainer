# Study implementation progress

Specification: [Fieldwork Study Expansion](../FIELDWORK_STUDY_EXPANSION.md).
Branch: `codex/study-frameworks`, created from local `main` at `5fa6ac4`.

## Current checkpoint

Phase 1 — Study navigation and puzzle framework, verified and ready to commit.
Next: Phase 2 — lesson framework and connected acceptance chapter.

## Completed phases

Phase 1 is included with this ledger update; record its commit at the next boundary.

## Decisions carried forward

- Production puzzle and lesson registries start empty; deterministic fixtures are
  injected by tests. Only the Italian Game course is authored for production.
- New puzzle/lesson histories are separate account-owned domains, never ordinary
  Review rows. Opening recall will reuse Review and FSRS in Phase 3.
- Server transactions own multi-step progress; animations present committed
  transitions and cannot advance a saved session on reload.
- Preserve `/review`, root exercise/focus links and browser history through the
  Study navigation transition. Archived course/repertoire routes remain archived.

## Validation

- Phase 1: `pytest backend/tests/test_puzzles.py backend/tests/test_api_contract.py
  -q -p no:cacheprovider --basetemp=data/verification/study-phase1-final`:
  33 passed; two existing TestClient dependency deprecation warnings.
- Existing account/retirement/restart subset: 17 passed.
- `npm.cmd run build`: passed (API agreement, application/browser-test types,
  source archive, production Vite build); existing chunk-size advisory remains.
- `npx.cmd playwright test study-puzzles.spec.ts navigation.spec.ts
  training.spec.ts --reporter=line`: 68 passed, 2 deliberate viewport skips,
  2 new test failures from immediate checking of an asynchronously saved coach
  radio. Scoped status selectors and explicit preference response waits fixed the
  tests. Final `npx.cmd playwright test study-puzzles.spec.ts --reporter=line`:
  16 passed across desktop/mobile, no skips.
- Ruff check and format check across backend/scripts/migrations, generated API
  snapshot check, and Git whitespace check: passed.
- Manual in-app browser: desktop 1440×1000 and phone 390×844, wrong move/retry,
  accepted move/reply, reload at the committed position, and completion inspected.
  Separate disposable test server/database; no owner game data changed.
- Independent backend/frontend reviews corrected null-move validation, consistent
  session GET reads, replay starting position and opponent-turn labels.

## Follow-ups / blockers

No blockers. Choose and source the Italian course content in Phase 4. Integration
polish should give Study subpages specific document titles and replace the honest
30+ queue count with an exact aggregate count.

This temporary ledger will be consolidated into living documentation and removed
at final verification.
