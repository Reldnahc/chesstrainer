# Verification status

The repeatable procedure is in [TESTING.md](TESTING.md). This file retains the
latest complete verification and subsequent focused checks. Earlier dated passes
remain in Git history with their original scope, results and limitations.

## Weaknesses page normalization — September 29, 2026

Weaknesses reuses SectionNavigation for bookmarkable Tactical patterns and
Material & mate categories, plus StatList and shared feedback/actions. Roomier
cards separate advice, evidence counts, recent practice and supporting examples;
two desktop columns become one on smaller screens. Backend priorities, evidence
and focused-practice scheduling are unchanged.

- `npm.cmd --prefix frontend run build`: passed API agreement, TypeScript,
  seven style-boundary checks and Vite; existing large-chunk advisory remains.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/weaknesses.spec.ts tests/empty-states.spec.ts tests/navigation.spec.ts --reporter=line`:
  **23 passed, 1 intentional skip** (mobile modifier-click). Covers category
  history/reload, one fetch across switches, 320px controls, statistics, evidence
  focus return, category/global emptiness, retry and cancelled requests.
- The same wrapper with `tests/weaknesses.spec.ts tests/training.spec.ts --grep 'skill evidence|local classification settings|focused practice highlights|compact workspace' --reporter=line`:
  **8 passed**, including the actual classified-game evidence and focused-practice
  paths with unchanged scheduled-review totals, and the final recent-practice copy.
- Manually inspected desktop and 390px layouts using isolated classified-game
  fixtures, switched categories, opened evidence and restored focus on dismissal.
  Independent review corrected the recent-practice wording; no remaining issues.
  `git diff --check` passed. Component inventory and testing guidance updated.

Only focused checks ran; no full backend, coach, lab or Docker suites, push or deployment.

## Import layout expansion and collapse — September 29, 2026

Replaced the content-only fade with a shared 450ms grid-height transition.
Closing retains inert content until the layout finishes collapsing; reopening
reverses the transition without remounting the draft. Still remains immediate.
Scroll-to-form uses the expanded bounds and preserves history/user scrolling.

- `npm.cmd --prefix frontend run build`: passed API agreement, TypeScript,
  seven style-boundary checks and Vite; existing large-chunk advisory remains.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/import-presentation.spec.ts tests/settings.spec.ts --reporter=line`:
  **28 passed** across desktop and mobile. Paused native transitions verify
  zero/midpoint/full heights and matching activity-section movement, plus
  collapse/reversal, drafts, focus, motion preferences and scroll restoration.
- Earlier focused runs exposed clipped scrolling and a separate smooth scroll
  outliving expansion. Both were corrected before the final passing run.
- Manually exercised desktop and 390px phone opening/closing in the isolated
  app. Independent review fixes preserve full focus outlines and avoid stealing
  input focus on motion-preference changes. `git diff --check` passed.

No full backend, coach, lab or Docker suites; no push or deployment.

## Import form spacing and entrance — September 29, 2026

Provider and PGN forms share the enclosing ImportSettings title/Close row and
aligned fields/action footer, without a second panel inset or detached toolbar.
A 240ms CSS entrance follows the existing interface-motion preference; form state,
polling, focus/scroll restoration and import payloads remain unchanged.

- `npm.cmd --prefix frontend run build`: passed API agreement, TypeScript,
  seven style-boundary checks and Vite; existing large-chunk advisory remains.
  `npm.cmd --prefix frontend run test:types` passed after the new tests were added.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/settings.spec.ts tests/providers.spec.ts tests/import-controls.spec.ts --reporter=line`:
  **33 passed, 1 failed** at initial navigation with Chromium
  `ERR_NO_BUFFER_SPACE`. The mobile saved-scroll test passed both reruns with
  `tests/settings.spec.ts --project=mobile --grep 'Back restores the saved scroll' --repeat-each=2`.
- The same isolated wrapper with `tests/import-presentation.spec.ts --reporter=line`:
  **6 passed**. Covers desktop/320px/390px geometry, expanded dates, both import
  sources, actual entrance events under all four motion/device combinations,
  no replay or lost drafts/focus during polling, and close/reopen behavior.
- Manually inspected desktop and phone forms in the application. Independent
  code review found no actionable issues; `git diff --check` passed.

Only focused application checks ran; no full backend, coach, lab or Docker suite.
The first wrapper lacked permission to stop its fixture server; it was explicitly
cleaned up and subsequent runs had reliable teardown. No push or deployment.

## Repository cleanup — September 29, 2026

Removed eight completed/superseded planning documents, the obsolete screenshot
index and 16 historical UI captures. Unique deferred Study requirements, the
closed licensing decision and the retired Game Story boundary now live in their
current domain guides. The component bible, measured benchmarks, source/licensing
provenance, generated API contracts and latest complete verification below remain.
Older journals are recoverable from Git history; no history was rewritten.

- `.venv/Scripts/python.exe -m pytest backend/tests/test_source_archive.py backend/tests/test_ci_plan.py backend/tests/test_ci_release_base.py -q -p no:cacheprovider --basetemp data/verification/repo-cleanup`:
  **313 passed**. Archive coverage includes model checkpoints, SQLite sidecars,
  native binaries, browser reports and caches.
- After replacing the CI planner's historical screenshot path with a synthetic
  documentation-image path,
  `.venv/Scripts/python.exe -m pytest backend/tests/test_ci_plan.py -k documentation -q -p no:cacheprovider --basetemp data/verification/repo-cleanup-doc-paths`:
  **21 passed, 252 deselected**.
- Focused Ruff lint/format checks on `scripts/source_archive.py`,
  `backend/tests/test_source_archive.py` and `backend/tests/test_ci_plan.py`, plus
  `git diff --check`: passed.
- Checked **332 local Markdown file links**, with no missing targets. No removed
  document or screenshot references remain. Ten runtime-artifact ignore probes
  passed; no currently tracked source file is newly ignored.
- Exported the actual cleaned source: **741 files**, with all **39 explicitly
  checked source/provenance paths** retained and all 25 deleted files absent.
  Rebuilt from the exported snapshot without checkout metadata; archive bytes
  and manifests matched exactly.
- A minimal Docker `FROM scratch` / `COPY frontend` context probe confirmed
  `.pt`/`.pth` files are excluded while `package.json` and browser-test TypeScript
  configuration remain available. Both original and updated ignore rules include
  that configuration; an initial suspected omission was not substantiated.

No application behavior, UI, engine policy, schema or license changed. The full
backend/browser/coach suites and full Docker installation were not rerun for this
documentation and source-packaging cleanup. No push or deployment was performed.

## Owner-selected UI standardization — September 29, 2026

Implemented the 26 approved choices in [UI_COMPONENTS.md](UI_COMPONENTS.md), with
one commit per choice and an indexed commit map. UI-18/UI-30 stay unchanged;
UI-26/UI-29 remain deferred. Main-application controls are canonical. Domain
state, cold-practice boundaries, engine policy and coach animation timing remain
unchanged. Independent integration review caught and corrected a six-pixel
Game/SRS board-size mismatch, a missed mobile disclosure target and a Settings
live-region lifecycle regression.

- `npm.cmd --prefix frontend run build`: passed generated API agreement,
  production/contract/browser TypeScript, **7 style-boundary tests**, both real
  standalone dependency guards and Vite. Existing large-chunk advisory remains.
- With native `STOCKFISH_PATH` configured,
  `.venv/Scripts/python.exe -m pytest -q -rs --durations=20 -p no:cacheprovider --basetemp data/verification/ui-standardization-final-backend-20260929`:
  **1198 passed, 3 skipped**. Skips are the pinned 79M runtime and two opt-in
  native Maia feasibility cases because `MAIA_CHECKPOINT_DIR` is unset. Native
  Stockfish coverage ran. Existing Starlette/httpx and AnyIO deprecations remain.
- `.venv/Scripts/ruff.exe check backend scripts migrations`,
  `.venv/Scripts/ruff.exe format --check backend scripts migrations`, and
  `.venv/Scripts/python.exe scripts/export_api_contract.py --check`: passed.
- CI planner/release-base tests: **308 passed**. Newly extracted app-only
  components avoid the coach matrix; genuinely shared controls, rig layers,
  modal behavior and dialogue retain their consumer coverage.
- Complete application browser suite: **438 passed, 8 intentional skips**
  (desktop/mobile-only geometry, modifier-click and mouse-drag cases). An old
  phone test's removed `.loading` selector now checks the actual shared loading
  state instead of passing vacuously.
- Complete accounts browser suite: **8 passed**. Complete intelligence-lab
  browser suite: **46 passed**. Both run desktop/mobile projects without grep.
- Complete coach Studio suite: **256 passed, no skips** (128 desktop and 128
  mobile) in 19 minutes. This broad run is warranted by the shared SVG rig,
  controls and dialogue changes; subsequent application-only changes retain
  selective coverage. Expression, idle, motion preference, visibility and
  cleanup checks all passed. The final independent code review found no
  remaining actionable issues.
- The final continuation tests passed **18 checks** across three repetitions
  per viewport. Initial new-test failures were corrected using actual animation
  clock advancement and independent repeated fixture sessions, preserving all
  playback/selection assertions. Other per-choice results are in UI_COMPONENTS.
- Fresh Docker image build and `scripts/smoke_install.py --image fieldwork:ui-standardization-check`:
  **passed in local and account modes**, including restart, native Stockfish
  review, settings persistence, lesson restart, opening enrollment, authentication
  and origin/cookie checks. Direct Windows context traversal hit an access-denied
  `.pytest_cache`; the successful build used a fresh context from the existing
  public-source exporter, matching current production/test source. No packaging
  changes were required. The script removed its disposable containers/volumes.
- Manually exercised Settings imports, matching Openings navigation, catalogue
  search, continuation inspection and game variations in an isolated local app.
  Inspected actual desktop and 390px phone layouts, returned a variation to the
  original ply, and restored the temporary browser viewport afterward.

Local browser runs use the standard configs' complete projects with temporary
port/server overrides. An ignored process wrapper owns fresh databases and
servers on 8769 (app), 8766 (accounts), 5179 (Studio) and 5180 (lab), then stops
only those processes. It avoids the previously observed Windows Playwright
web-server teardown hang. Commands are `.venv/Scripts/python.exe .tools/run_ui_checks.py MODE --reporter=line`;
the equivalent maintained commands are the four Playwright invocations in
TESTING.md. No remote CI, push, deployment or owner-data migration is part of
this pass.
