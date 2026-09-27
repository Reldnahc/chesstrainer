# Code quality audit and remediation checklist

Audit date: 2026-09-26. Baseline: `cb1d96d`.

This document tracks the ten findings from the repository-wide code quality audit.
The numbers are stable so discussion and follow-up work can refer to them. Check an
item only after the implementation and relevant verification are complete; record
the evidence in that item's section. File references describe the audit baseline
and may move during refactoring.

## Checklist

- [x] **1. Gate Docker publishing on correctness checks.**
- [x] **2. Replace per-account application instances and permanent worker threads.**
- [x] **3. Separate review screen state management from presentation.**
- [ ] **4. Define and share API response contracts.**
- [ ] **5. Run account browser tests in CI.**
- [ ] **6. Consolidate CSS ownership and remove obsolete styles.**
- [ ] **7. Break tactical detection and classification into smaller rules/stages.**
- [ ] **8. Consolidate duplicated chess helpers and correct dependency boundaries.**
- [ ] **9. Remove archived lesson progression from active review handling.**
- [ ] **10. Correct engine health reporting and preserve diagnostic exceptions.**
- [ ] **11. Remove this checklist document after all findings above are resolved and verified.**

## 1. Docker publishing is independent of correctness

**Priority:** High. **Status:** Resolved and verified.

`.github/workflows/docker.yml` publishes `latest` on pushes independently of
`.github/workflows/test.yml`. A commit can publish even if its correctness checks
fail.

**Completion criteria:** Publishing requires successful validation of the exact
commit being released, including manual publishing entry points. Preserve an
immutable revision tag alongside `latest`.

**Implementation:** Publishing now calls the reusable correctness workflow and
depends on its success. Both main-branch pushes and manual releases validate the
same explicit commit SHA that the publisher checks out. Other branch pushes and
pull requests reuse the same checks without publishing; only the publishing job
has package-write permission. The full SHA image tag is retained alongside `latest`.

**Verification / resolution:** Actionlint 1.7.12 passed for both workflows, and
`git diff --check` passed. Reviewed both entry points, the required-job dependency,
checkout SHAs, permissions and immutable tag. A failed or cancelled correctness
workflow leaves the publishing job skipped by GitHub's normal dependency rules.
Live Actions execution awaits a requested push; no image was published locally.

## 2. Each account owns an application and permanent worker threads

**Priority:** High. **Status:** Resolved and verified.

`multiuser.py` creates and retains a complete FastAPI application per account and
opens one for every enabled user at startup. Each application's `JobRunner` starts
two coordinator threads that poll every half-second while idle. Although the
native engine pool is bounded, application resources and idle database polling
grow with registered accounts.

**Completion criteria:** One application/router graph and a bounded host-wide job
scheduler. Account identity remains explicit in request and job database access;
no retained application or polling thread per account. Persisted jobs recover
without requiring their owners to log in. Preserve fetch-only sync, cancellation,
progress reporting, local mode, account isolation, and the shared engine limit.
Shutdown must stop and drain workers and close engine resources.

**Implementation:** A single application registers every router once. Explicit
request/job scopes hold account-bound sessions and temporary lock leases. A shared
runner uses `ENGINE_SLOTS` analysis coordinators plus one fetch-only coordinator
in hosted mode, with one analysis job per account. Startup recovers jobs without
opening account runtimes; shutdown drains active work before closing engines.
Local mode keeps its existing two coordinator lanes. No database migration or new
configuration is required.

**Verification / resolution:** The full backend suite passed (407 tests), followed
by 14 passing targeted tests after adding the final startup-retirement guard and
its regression. The ordinary browser suite passed on desktop/mobile (73 passed,
3 viewport-specific skips); the separate account browser suite passed on both
viewports (2 passed). Production frontend build, Ruff lint/format and diff checks
passed. Windows Playwright required manual cleanup of its disposable server
process trees after the test cases passed; both runners then exited successfully.

The new hosted-runtime regressions cover 250 idle accounts, concurrent account
isolation, independent fetching, recovery before login, cancellation, pooled engine
limits, scope cleanup, shutdown/restart and preservation of disabled/local account
retirement state. Engine health and exception diagnostics remain open in item 10.

## 3. Review components concentrate too many responsibilities

**Priority:** High. **Status:** Resolved and verified.

`frontend/src/Review.tsx` has a 452-line SRS component. `GameReview.tsx` combines
request queues, caching, stale-response handling, branching, keyboard navigation,
and rendering in one 305-line workspace component with 13 state hooks, nine
effects, and 12 refs. Dense JSX further obscures the responsibility boundaries.

**Completion criteria:** Extract cohesive session/branch/request state management
and smaller presentation components. Keep the existing shared board, coach and
workspace layout. Preserve the distinct policies of SRS and whole-game review,
including navigation, cancellation and stale-response behavior.

**Implementation:** SRS now separates queue/grading state from counter/explanation
playback and from its coach/details presentation. Whole-game review separates job
lifecycle/polling, variation navigation and queued/cached engine requests, with
small components for players, controls, notation, coaching and summaries. Both
still compose the same shared board, coach and workspace. Request cleanup ignores
late responses after leaving a session; analysis generations invalidate old
results when restarting. Bookmarked moves are clamped before rendering.

**Verification / resolution:** Production build and full backend suite passed
(408 tests). The final full desktop/mobile browser run passed (75 tests, 3 expected
viewport-specific skips); account browser coverage also passed (2 tests). Coverage
includes shared geometry/motion, reveal/retry/focused practice, incremental progress,
pause/resume, keyboard/history navigation, queued branch ratings and stale replies.
A new regression checks that a late grading failure cannot leak into another page.
The first browser run caught a bookmarked-ply regression; it was corrected before
the final passing run. Diff checks passed.

## 4. API response contracts are largely unspecified

**Priority:** Medium. **Status:** Open.

The checked-in OpenAPI fixture has empty schemas for 33 of 34 successful
responses. `frontend/src/api.ts` defaults to `any`; callers manually declare
response types independently of backend dictionaries. Payload changes can evade
both the contract snapshot and TypeScript checks.

**Completion criteria:** Define backend response schemas for active endpoints and
derive or otherwise verify corresponding frontend types. Remove the implicit
`any` escape hatch and ensure contract checks detect incompatible payload changes.

**Verification / resolution:** Pending.

## 5. Account browser tests are excluded from CI

**Priority:** Medium. **Status:** Open.

The default Playwright configuration excludes `accounts.spec.ts`, while CI only
invokes that configuration. `playwright.accounts.config.ts` must currently be run
manually for signup, second-device login and private-library browser coverage.

**Completion criteria:** CI executes the account browser suite as well as the
ordinary desktop/mobile suite and fails when either suite fails.

**Verification / resolution:** Pending.

## 6. CSS contains scattered overrides and obsolete selectors

**Priority:** Medium. **Status:** Open.

`frontend/src/styles.css` is 581 lines / roughly 39 KB, with repeated breakpoint
blocks, obsolete course selectors and distant overrides for the same components.
Review presentation ownership remains split between global CSS and the shared
review stylesheet. Examples include weakness alignment and evidence-dialog sizing.

**Completion criteria:** Give components clear stylesheet ownership, consolidate
equivalent breakpoint rules, and remove confirmed unused selectors. Preserve
desktop/laptop/mobile geometry and shared review presentation behavior.

**Verification / resolution:** Pending.

## 7. Tactical detectors and classifier methods are oversized

**Priority:** Medium. **Status:** Open.

`verified_patterns._detect_at` is 247 lines and `LocalClassifier.classify` is 217
lines. They mix numerous tactical motifs, evidence checks, outcome determination,
defensive verification and result construction. `_detect_at` also retains a
single-item loop that repeats earlier setup.

**Completion criteria:** Extract independently understandable motif rules and
classification stages while preserving evidence admission, conservative labels,
provenance and all existing tactical regression behavior. Do not rewrite pinned
upstream code merely because it is large.

**Verification / resolution:** Pending.

## 8. Shared chess helpers are duplicated or imported through the wrong module

**Priority:** Medium. **Status:** Open.

`verified_patterns.py` constructs findings nearly identically to
`tactical_geometry.witness`. Game review and SRS duplicate legal-move
serialization. `explanations.py` imports continuation helpers through
`local_classifier.py` instead of the owning `continuations.py` module.

**Completion criteria:** Consolidate truly equivalent finding/serialization
helpers and import them from their owning modules. Preserve any intentional
differences between SRS, game review and detector evidence rules.

**Verification / resolution:** Pending.

## 9. Removed lessons still complicate active review code

**Priority:** Medium. **Status:** Open.

Lesson routes are tombstones, but `lessons.py` retains progression/mutation logic
and `reviews.py` still calls into it. Active weakness priorities share
`curriculum.py` with archived course generation. There is a deferred circular
dependency between lessons and reviews.

**Completion criteria:** Remove or isolate unused progression/generation code and
its active review branches. Preserve historical data, migrations, supported audit
access, and the existing rejection of archived practice.

**Verification / resolution:** Pending.

## 10. Health and exception diagnostics are unreliable

**Priority:** Medium. **Status:** Open.

An isolated audit probe using a nonexistent Stockfish executable returned
`engine_available: true` in account mode: startup sets availability even when the
engine startup check is skipped. Separately, job failures omit tracebacks and the
JSON log formatter discards exception information even when supplied.

**Completion criteria:** Distinguish checked availability from an engine that has
not been started, report failures accurately, and preserve useful server-side
exception diagnostics without exposing private data in client responses.

**Verification / resolution:** Pending.

## Audit validation and boundaries

The original audit covered frontend/backend structure, migrations, supporting
scripts, tests and deployment/CI configuration. Ruff lint, Ruff formatting checks
and TypeScript type-checking passed. Isolated probes reproduced the two diagnostic
issues in item 10. The full test suite was not rerun for the read-only audit.

Shared board/coach/layout components and the bounded engine pool are useful
foundations. File size alone is not a defect: declarative models, migrations and
vendored upstream implementations were not marked for splitting merely for size.
