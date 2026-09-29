# Study implementation progress

Specification: [Fieldwork Study Expansion](../FIELDWORK_STUDY_EXPANSION.md).
Branch: `codex/study-frameworks`, created from local `main` at `5fa6ac4`.

## Current checkpoint

Phase 4 — Italian Game pilot verified; committing before final integration checks.

## Completed phases

- Phase 1: `5c30aad` — Study navigation and durable multi-move puzzles.
- Phase 2: `557bf97` — durable guided lessons, branches and independent rehearsal.
- Phase 3: `4fd6f6b` — versioned opening studies and shared scheduled recall.

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
- Phase 2: `pytest backend/tests/test_study_lessons.py
  backend/tests/test_lesson_journey.py backend/tests/test_lessons.py
  backend/tests/test_accounts.py backend/tests/test_api_contract.py
  backend/tests/test_puzzles.py -q -p no:cacheprovider
  --basetemp=data/verification/study-phase2-final`: 79 passed, no skips;
  two existing dependency deprecation warnings.
- Phase 2: `npm.cmd run build` passed; Ruff lint/format, API snapshot and
  Git whitespace checks passed. `npx.cmd playwright test study-lessons.spec.ts
  study-puzzles.spec.ts navigation.spec.ts --reporter=line`: 43 passed,
  one existing mobile new-tab navigation skip.
- Phase 2 independent reviews covered content graph edges, branch anchors,
  account/CAS isolation, cold rehearsal, stale responses and existing learning
  records. Fixed full-game seeking to include known source-game preludes.
  Manual desktop/mobile inspection exercised demonstration, guidance, branch
  reload/return, source-game start/return and independent rehearsal.
- Phase 3: source, journey, lifecycle, isolation, retirement, review restart,
  repertoire archival, focused practice, accounts and API subset: 58 passed
  (`--basetemp=data/verification/study-phase3-verified`), no skips. An earlier
  run caught a temporary test typo (`reviews.submit` instead of `submit_move`);
  all six special-move cases pass after correction.
- Phase 3 browser: opening Due/library + lessons/puzzles + existing training and
  navigation: 98 passed, two existing viewport-specific skips. Final production
  build, Ruff lint/format, generated API snapshot and whitespace checks passed.
  Final `playwright test opening-due.spec.ts opening-library.spec.ts --reporter=line`
  after manual polish: 16 passed, no skips.
- Phase 3 manual desktop/phone: catalogue search/preview, White enrollment,
  opening-specific cold prompt, wrong move, saved retry after reload and successful
  recall with its original failed-first-attempt schedule inspected. Compact side
  selectors and completion copy refined after this walkthrough.
- Independent audits corrected valid self-retirement being misreported as stale,
  locked composite resume reads, shared unfinished-recall count semantics and
  exact browser counts beyond the 30-item queue batch. Old opening attempts keep
  snapshot feedback through ABA/deactivation without scheduling changed material.

## Follow-ups / blockers

No blockers. Phase 4 provides three White-side chapters, three explicit repertoire
lines and three historical scores (300 legal plies) from the public-domain 1896
Hastings book. Content source details live in ITALIAN_COURSE_SOURCES.md.

- Phase 4: 6 Italian backend/native tests passed, no skips; existing lesson and
  opening provider regression subset: 41 passed. Independent acceptance rerun:
  5 passed. Native guided moves were checked with bounded depth-18 searches.
- `playwright test italian-course.spec.ts --reporter=line`: 4 passed across both
  viewports. Production build and Ruff passed. Actual desktop lesson/library and
  mobile screenshots inspected; source histories and excerpt facts independently
  checked. Corrected semi-open-file and already-played-check wording during review.

This temporary ledger will be consolidated into living documentation and removed
at final verification.
