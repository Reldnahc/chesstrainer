# Verification status

The repeatable procedure is in [TESTING.md](TESTING.md). This file retains the
latest complete verification and subsequent focused checks. Earlier dated passes
remain in Git history with their original scope, results and limitations.

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
