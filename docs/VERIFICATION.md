# Verification status

The repeatable procedure is in [TESTING.md](TESTING.md). Prior passes remain below with their original scope and results.

## Coach revamp review and portable browser harnesses — September 29, 2026

Independent review covered coordinator liveness/cleanup, shared facial state,
artwork/channel ownership, developer diagnostics, stable names, opponent Book
feedback and the pending Best/Brilliant grading changes. No production findings
remained. A deterministic coordinator stress check traversed 3,000 repertoire
combinations with 700 events each without a cadence or liveness violation.

The first Linux CI pass found a test-harness defect: four browser harnesses
imported React through Vite's private dependency-cache URLs, with a doubled slash
before the Linux absolute path. All 64 failures were module-fetch errors before
the animation assertions. The corrected harnesses use a normal source fixture
for React/createRoot, and all nine studio filesystem import roots share canonical
Windows/Linux path handling. Production code and animation behavior are unchanged.

- Before the harness correction, the complete local application suite passed
  **297 tests with 3 intentional viewport-specific skips**, and the complete local
  studio suite passed **188 tests**, both desktop/mobile. Commands used
  `npx.cmd playwright test --config=studio-test-results-configs/opponent-book.config.ts --reporter=line`
  and `--config=studio-test-results-configs/character-polish.config.ts --reporter=line`.
  These ignored configs retain the normal projects and use independently managed
  fixture/studio servers.
- The focused backend grading/evidence suite passed **131 tests**, including
  native Stockfish, using `.venv/Scripts/python.exe -m pytest -q` with
  `backend/tests/test_game_review.py`, `test_review_events.py`,
  `test_review_sacrifices.py` and `test_review_sacrifice_reports.py`.
- After correction, `npx.cmd playwright test --config=studio-test-results-configs/character-polish.config.ts idle-cadence.spec.ts idle-diagnostics.spec.ts resting-faces.spec.ts idle-visual.spec.ts vite-path.spec.ts --reporter=line`:
  **102 passed**, desktop/mobile, 3.2 minutes. Includes all previously failing
  harnesses and regression assertions for Linux and both Windows path forms.
- Fresh Linux Node 20 container reproduction: the old dependency URL returned
  **504**, while its canonical form returned **200**. Browser probes against that
  Linux server mounted the real coach through the new source fixture on desktop
  and mobile; each completed five autonomous idle gestures with zero browser
  errors. The temporary container was removed after verification.
- `npm.cmd run build`: passed API agreement, production/contract/browser-test
  TypeScript and Vite. Existing chunk-size advisory remains. Ruff lint/format
  (**281 files**), generated backend API check and `git diff --check` passed.
- Initial CI run `36602748137` passed backend (**886 passed, 7 skipped**), the
  application (**297 passed, 3 skipped**), accounts (**8 passed**), intelligence
  laboratory (**44 passed**), migrations and fresh Docker installation. Its studio
  result was **124 passed, 64 failed** for the reproduced harness error above.
  A clean CI rerun on the correction remains the merge gate; final checks are
  recorded on [PR #3](https://github.com/Reldnahc/chesstrainer/pull/3).

## Personal names for the remaining coaches — September 29, 2026

The twelve title-style display names now match the rest of the cast: Walter,
Desmond, Kenji, Arjun, Mara, Iris, Zoe, Poppy, Alfie, Waffles, Felix and Juniper.
Stable coach/family IDs, default selection, personality definitions and saved
preferences are unchanged. Catalogue consumers and living character documentation
use the new names; historical verification entries retain their original wording.

- `npx.cmd playwright test --config=studio-test-results-configs/character-polish.config.ts coach-names.spec.ts --reporter=line`:
  **4 passed**, desktop/mobile. Checks all thirty unique names against stable IDs,
  default/retired lookups, preview labels and a saved `cat-black` bookmark that
  restores Juniper after reload and switches to Walter using `classic`.
- `npx.cmd playwright test --config=studio-test-results-configs/opponent-book.config.ts coach-selection.spec.ts --reporter=line`:
  **8 passed**, desktop/mobile. Every coach can be selected, saved, reloaded and
  displayed in review; compact picker geometry, fallback choices and SRS feedback
  still pass. These ignored configs reuse the normal project definitions with
  independently managed studio/isolated fixture servers.
- `npm.cmd run build`: passed API agreement, production/contract/browser-test
  TypeScript and Vite. Local frontend rebuilt. Existing chunk advisory remains.
- `git diff --check`: passed. Focused source review confirms display-name-only
  production edits and no stale old display names in application/test code.

## Pickle, Fergus and Celeste artwork polish — September 29, 2026

Pickle now has a kitten-specific head/body silhouette, large low-set round eyes,
small muzzle and shorter seated proportions. Cheek/chin paw positions keep the
larger eyes visible. Fergus has broader eye whites and taller openings in all
20 states, superseding the earlier small-eye Good treatment. Celeste has a low
equine mouth seam and restrained surprised opening, without human teeth/tongue.
Shared face/paw overrides retain the previous defaults for other characters.
No reaction timing, idle scheduling, account IDs or dialogue changed.

- `npx playwright test --config=studio-test-results-configs/character-polish.config.ts resting-faces.spec.ts idle-rig.spec.ts`:
  **46 passed**, desktop/mobile, 2.7 minutes. Uses the normal studio projects with
  an isolated output directory and the existing live server. All cast/state rig
  targets remain mounted; eye lifecycle, Still/reduced-motion handling, reaction
  interruption and non-eye geometry checks remain green. Frog's Good test now
  expects broad near-neutral eyes while retaining a larger Brilliant expression;
  Capybara's previous eye contract remains unchanged.
- Temporary visual capture spec through `character-polish-capture.config.ts`:
  **4 passed**, 4.9 seconds. All three complete expression grids and actual review
  portraits at 92.8px/52.5px were inspected, plus a comparison strip. Ignored images
  are under `data/verification/character-polish/`. Live studio checks covered
  animated kitten idles, Book and Blunder, frog neutral and unicorn Brilliant.
  Initial kitten cheek paws obscured the enlarged eyes; lowered placements were
  checked in the final grids. No clipping or disconnected anatomy found.
- `npm.cmd run build`: passed API agreement, production/contract/browser TypeScript
  and Vite. Public source archive includes `KittenFace.tsx`. Existing chunk advisory
  remains. `git diff --check` and independent focused source review passed.

## Opponent Book reactions — September 29, 2026

One-sided review now retains the incoming Book reaction for a known opponent's
recognized opening move. Opponent dialogue remains factual; check, terminal and
Show why precedence remain intact. No grading, evidence or animation timing changed.

- Both-color regression tests first failed with `explaining` instead of `book`.
  The same tests now pass through reaction, intent and rendered utterance, covering
  branches, legacy reports, unknown movers, explicit explanations and check.
- Targeted desktop/mobile run across `coach-logic`, `dialogue-logic`,
  `game-review` and `learner-perspective`: **20 passed, 12 stale expectations**.
  The recovery fixtures themselves contain Book moves; their old opponent-face
  expectations were updated while retaining all history/recovery isolation and
  non-Book praise suppression assertions. Rerunning the complete
  `learner-perspective.spec.ts` produced **20 passed**, so all **32 distinct
  targeted cases passed**, with no skips. The real Book review test verifies the
  opponent portrait after navigation/reload and still exercises analyzed branches.
  Commands used `node node_modules/@playwright/test/cli.js test --config
  studio-test-results-configs/opponent-book.config.ts` with the standard projects
  and an independently managed isolated fixture server on port 8765. The first
  run selected `learner-perspective.spec.ts coach-logic.spec.ts dialogue-logic.spec.ts
  game-review.spec.ts --grep "learner|opponent|semantic reaction|check respects|practice protects|future coaches|book moves appear|book" --reporter=line`;
  the second selected `learner-perspective.spec.ts --reporter=line`.
- `npm.cmd run build`, browser-test TypeScript and `git diff --check`: passed.
  Existing Vite chunk and test dependency deprecation warnings remain.
  Independent focused code review found no actionable issues.

## Coach idle revamp — final integration — September 29, 2026

Implementation units were committed as `fee508e` (personal names), `2bb514a`
(coordinator), `7f4a64b` (resting faces), `77ee6a0` (cast signatures) and `0b1dfea`
(studio/visual polish), followed by `12cc08c` (rig-compatible fallback test).
Stable account IDs, chess evidence, reaction mapping and entrance timing are
unchanged. No new runtime dependency or container setting.

- `.venv/Scripts/python.exe -m pytest -q backend/tests/test_coach_preferences.py backend/tests/test_motion_preferences.py backend/tests/test_api_contract.py backend/tests/test_api.py backend/tests/test_review_events.py --basetemp .tools/pytest-coach-idle-m5-20260929-02 -o cache_dir=.tools/pytest-cache-coach-idle-m5-20260929-02`:
  **92 passed, 0 skipped**, 66.50 seconds. Includes all saved coach IDs, account
  ownership/restart, motion preferences, API contracts and cold SRS answer/
  intelligence isolation. Existing Starlette HTTPX and AnyIO alias warnings remain.
- `.venv/Scripts/python.exe -m ruff check backend scripts migrations`,
  `.venv/Scripts/python.exe -m ruff format --check backend scripts migrations`
  (**281 files**) and `.venv/Scripts/python.exe scripts/export_api_contract.py --check`:
  all passed. No generated API contract changed.
- `npx.cmd playwright test --config playwright.accounts.config.ts`: **8 passed,
  0 skipped**, desktop/mobile, 2.1 minutes.
- `npx.cmd playwright test --config playwright.intelligence.config.ts`: **44 passed,
  0 skipped**, desktop/mobile, 2.3 minutes. Both normal configurations exited 0
  after stopping only their own stuck Windows test-server processes during
  teardown; accounts logged a Windows Proactor connection reset on client close.
  These cleanup issues did not affect assertions. No broad process kill was used.
- `npx.cmd playwright test --reporter=line`: **296 cases collected** on desktop
  and mobile in 9.2 minutes: **291 passed, 3 intentional skips, 2 failures** from
  one stale synthetic-coach assertion. The old test expected glasses/ears on an
  unknown rig. It now asserts unsupported parts are omitted and a supported head
  gesture still honors the family override. No production fix was needed.
  `npx.cmd playwright test tests/coach-logic.spec.ts --reporter=line` then passed the
  entire logic file: **8 passed, 0 skipped**, covering both corrected instances
  and neighboring semantic/fallback checks. Browser-test TypeScript passed.
  Both runs needed only their owned Windows server process stopped after the
  assertions to release Playwright's teardown.
  The three intentional skips were mobile modifier-click/new-tab navigation,
  mobile execution of the desktop width policy, and desktop execution of the
  phone-only retry/detail geometry test. Each runs on its applicable project.
- Full studio coverage: **188 distinct passing cases**, 94 desktop and 94 mobile.
  `node node_modules/@playwright/test/cli.js test --config test-results/idle-full-m4.config.ts`
  used the existing live studio with the standard coach configuration and an
  isolated output directory. All 94 desktop cases passed, then another suite
  cleaned the temporary config directory: 16 mobile workers could not start and
  78 mobile cases did not run. This was a configuration-lifetime error, not a
  failing animation assertion. Moving the config outside that shared cleanup
  directory and running
  `node node_modules/@playwright/test/cli.js test --config studio-test-results-configs/idle-full-m4.config.ts --project mobile`
  passed **all 94 mobile cases, 0 skipped, 0 flaky**, in 9.0 minutes. Both reports
  are retained under ignored `frontend/studio-test-results-configs/`. The two
  completed projects cover every expression/rig, lifecycle, cadence, signatures,
  diagnostics, motion preference and studio control, including all 60 expression
  sheets and 60 signature sheets across desktop/mobile. No source changes were
  required after these runs.
- Final `npm.cmd run build`: passed API agreement, production/contract/browser
  TypeScript and Vite. Main JS gzip **167.39 kB**, CSS gzip **19.95 kB**; the existing
  500 kB chunk advisory remains. The public source archive includes the committed
  coordinator, signatures and diagnostics, and excludes the completed temporary
  plan. `git diff --check` passed.
- Manual production-build checks used an isolated fixture database on port 8767,
  not the owner's workspace. Native game review completed; rapid backward/forward
  navigation kept the latest reaction, then terminal loss settled into restrained
  idles. Phone review used the 52.5px portrait. SRS was neutral before an attempt,
  concerned after a wrong move, encouraging on retry, recovered on success and
  explanatory on reveal. Desktop/mobile board and bubble geometry stayed stable.
  Selecting Scout/Animated and Winston/Still in Settings survived navigation and
  reload; Still displayed expressive settled feedback with no idle tracks.
  The disposable server was stopped; the standalone studio remains available.
- Independent final code review found no remaining actionable lifecycle, channel,
  cold-SRS or cleanup defects. Visual acceptance and focused regressions are
  recorded under the preceding milestones. Physical-phone timing, Docker rebuilds
  and unrelated native model benchmarks were outside this animation-only pass.

All five milestones are complete. Durable behavior and architecture are documented
in `COACH.md`, `COACH_CAST_BIBLE.md`, `ARCHITECTURE.md` and `TESTING.md`; the temporary
`COACH_IDLE_PLAN.md` has been removed. Work remains local on
`codex/coach-idle-revamp`; no push, merge or deployment was requested.

## Coach idle revamp — milestone 4 — September 29, 2026

The separate development studio adds opt-in natural playback, independent cast
comparison playback, event-driven diagnostics and reproducible numeric seeds.
Bounded individual replays remain available for every eligible gesture. Diagnostics
observe the production coordinator without a polling loop or account writes.

- `npx.cmd playwright test --config test-results/idle-lifecycle.config.ts idle-diagnostics.spec.ts`:
  **18 passed**, desktop/mobile. Covers seed/reset determinism, stale-track masking,
  observer replacement/detachment, inline callback safety, pause history/time,
  snapshot/DOM agreement and unmount cleanup.
- Same live-server config with `idle-cadence.spec.ts`: **38 passed**, desktop/mobile.
- `node node_modules/@playwright/test/cli.js test --config=test-results/studio-diagnostics.config.ts studio-diagnostics.spec.ts --reporter=line`:
  **8 passed**, desktop/mobile. Initial seed-test timeouts came from repeated
  browser-protocol reads; atomic observations fixed the test without sleeps,
  reduced assertions or increased timeouts.
- `idle-visual.spec.ts --project desktop`: **1 passed** twice, latest 15.5 seconds.
  All 30 signature sheets sample both authored signatures at 0%, 40%, 75%, 100%
  and portrait widths 92.8px/52.5px. Checks actual CSS tracks, timings/delays,
  settled eyes, unchanged SVG identity and fixed bounds. Images are ignored under
  `data/verification/coach-idle-visual/desktop`, not shipped assets.
- `npm.cmd run build`: passed API agreement, all TypeScript projects and Vite.
  Existing chunk advisory remains; main JS gzip 167.39 kB, CSS gzip 19.95 kB.
  Browser-test TypeScript and `git diff --check` passed independently.
- Live in-app preview watched Storyteller/Velvet night/Scout and Fergus/Rivet/Pip
  in sustained 60–90-second desktop sessions, then the more restrained analyst,
  Monty and Winston. Separate glances, posture and appendage motion remain legible
  without repeated entrances or shifting the portrait box. Mobile 390px preview
  checked the 52.5px blunder portrait. Brilliant, Blunder, Still and seeded restart
  were inspected. Still cleared every idle and retained expressive settled faces.
- Visual review covered all 60 authored signature performances (30 sheets, two
  signatures each) and the full settled-expression cast. It caught overly wide
  resting Good eyes on Fergus and Winston; explicit character-sized eye heights
  restore calm approval while retaining the closed-eye entrance. No sampled
  clipping or broken joint/prop attachment was found. Static
  captures supplement live observation; they do not establish frame-by-frame
  smoothness on physical phones.
- Focused `resting-faces.spec.ts -g "settles Good"` regression: **4 passed**,
  desktop/mobile. The two characters retain closed eyes until the original entrance
  ends, then reopen to their neutral eye height, distinctly below Brilliant;
  non-eye geometry and Still parity remain unchanged. Live preview confirmed the
  calmer result. Production build passed again after this polish.
- Independent code review found and resolved an inline observer render-loop risk
  and paused diagnostic-history loss before the passing runs. Final review found
  no remaining substantive M4 issue. Full application regression follows in M5.
- An initial full-suite run was intentionally stopped after 13 passing desktop
  cases and all 30 expression sheets to apply that visual polish. It is not counted
  as a completed full-suite run; the stable final rerun is recorded under M5.

## Coach idle revamp — milestone 3 — September 29, 2026

The live cast now has 18–22 distinct gestures per coach, 8–14 eligible choices
per expression and two authored signatures per coach (60 signatures across the
current 30). All 6,740 configured slots use the real rig and canonical timings.
Six shared directional/rhythmic variants augment individual anatomy and acting.

- `npm.cmd run build`: passed API agreement, all TypeScript projects and production
  build. Main JS gzip is 167.11 kB and CSS gzip 19.93 kB; the existing chunk advisory
  remains. No new dependency or continuous JavaScript animation loop was added.
- `npx.cmd playwright test --config test-results/idle-live.config.ts idle-repertoire.spec.ts idle-articulation.spec.ts idle-rig.spec.ts --reporter line`:
  **12 passed** desktop/mobile in 3.6 minutes. Covers every coach/expression,
  every actual CSS target/track/delay, complete signature eligibility and extended
  400-event traces with two seeds for every repertoire. Traces verify cadence,
  cooldowns, channel ownership, eye activity and reachability of every choice.
- Updated `motion-vocabulary.spec.ts`: **3 desktop tests passed** for minimum
  coverage, emotion exclusions, shared metadata and unchanged entrance timing.
- Additional catalogue metadata case: **1 passed**. Browser-test TypeScript and
  `git diff --check` passed (Git line-ending normalization notices only).
- Independent integration review found no actionable issue. Live studio replay
  checked the expanded menus, new character gestures and Wisp's anchored hem.
  Full normal-size artistic review and application regression remain in M4–M5.
- An earlier run began before stylesheets were finished, failed on missing
  imports and was discarded. The complete final run above used the finished files.
## Coach idle revamp — milestone 2 — September 29, 2026

Shared face context now separates entrance eye squeezes from the expressive
resting face. Still/paused portraits settle immediately; newer feedback cancels
old transitions. No reaction timing or semantic inputs changed.

- `npm.cmd run build`: passed API agreement, all TypeScript projects and production
  build (existing chunk-size advisory only).
- `npx.cmd playwright test --config test-results/idle-live.config.ts resting-faces.spec.ts`:
  initial **34 passed** desktop/mobile; subsequent expanded interruption subset
  **6 passed**, covering **38 distinct current cases**. Tests inspect actual eyes,
  unchanged non-eye geometry, SVG identity, dwell/replay, newer feedback, hidden/
  offscreen/Still interruption, browser preferences and one-shot previews.
- `npx.cmd playwright test --config test-results/idle-live.config.ts idle-rig.spec.ts --project desktop`:
  **2 passed**, including all 600 current rendered coach/expression combinations.
- Browser-test TypeScript and `git diff --check` passed. Independent lifecycle
  and artwork review found no material issue. Live studio confirmed reopening;
  broader artistic acceptance continues with the expanded repertoire.
## Coach idle revamp — milestone 1 — September 29, 2026

The shared coach now uses canonical gesture lengths and channel reservations,
independent blinking, bounded overlap, cooldown/history selection and one idle
deadline timer. Artwork is memoized independently of idle bookkeeping. Personal
display names preserve stable account IDs. No chess or account contracts changed.

- `npm.cmd run build`: passed API agreement, application/contract/browser-test
  TypeScript and production Vite build. Existing large-chunk advisory remains.
- `npx.cmd playwright test --config test-results/idle-live.config.ts idle-coordinator.spec.ts idle-rig.spec.ts motion-vocabulary.spec.ts coach-names.spec.ts`:
  **44 passed** on desktop/mobile. The ignored local config is the normal coach
  config without its server launcher, using the running development studio.
- `npx.cmd playwright test --config test-results/idle-lifecycle.config.ts idle-cadence.spec.ts idle-articulation.spec.ts --reporter line`:
  **40 passed** on desktop/mobile. Six pilots in neutral/brilliant exercise
  repeated actual-duration cycles, safe overlap, 500–1,000ms quiet gaps, pause/
  resume, preference overrides, same-expression navigation, unmounting and stable
  SVG identity/render counts. The complete registered rigs are checked against
  canonical animation tracks. Fake-clock DOM observations permit one 50ms render
  step; pure coordinator tests assert exact deadlines.
- Independent lifecycle review found an unsupported idle-preview inconsistency;
  entrance selection now uses the same resolved eligible gesture as replay.
  Live in-app studio inspection confirmed the integrated component and normal-size
  preview; wider artistic acceptance follows the face/repertoire milestones.
- `git diff --check`: passed. An earlier isolated-server run completed its 40
  cases but stalled during Windows server teardown and was interrupted. It is
  not counted as a successful run; the later live-server run above exited cleanly.

The full final application/account/backend checks and complete artistic review
are still pending subsequent milestones.

## Review grading correction — September 29, 2026

The Best allowance admitted different moves up to 10 cp below the top choice and
also treated retained slower mates as zero loss. Eleven new cases failed against
that behavior before the correction. Best now requires the top move, with a tie
only for another immediate checkmate. Retaining a slower forced mate is Good,
not Miss or an exceptional grade. Shared SRS mate-outcome rules are unchanged.

- `.venv/Scripts/python.exe -m pytest backend/tests/test_game_review.py -q -p no:cacheprovider --basetemp data/verification/strict-best-native`:
  **43 passed**, including native Stockfish, both-color mate-in-one versus
  mate-in-two examples, promotion, genuine queen sacrifice, review restart and
  training isolation. Two existing dependency deprecation warnings remain.
- A bounded native audit of the owner's supplied public game reproduced three
  delayed mates and an ordinary bishop exchange incorrectly called Brilliant.
  The PGN and audit reports remain ignored local verification data.

The Brilliant correction excludes material-restoring recaptures, promotion-pawn
offers, downstream-only tactical support and forced moves. Seven production-path
cases failed before the sacrifice correction; two additional forced-move cases
failed before its guard. Saved offers are rechecked before grade, difficulty and
semantic events without mutating stored evidence. Both-color forced-king tests
also prove fresh analysis performs no sacrifice-acceptance search. Independent
review found no remaining actionable issue, and replaying all 40 audited White
reports changed the bishop exchange to Best, delayed mates to Good, and retained
the alternative immediate checkmate as Best.

Final validation of the combined correction:

- `python -m pytest backend/tests/test_game_review.py backend/tests/test_review_sacrifices.py backend/tests/test_review_sacrifice_reports.py backend/tests/test_review_events.py backend/tests/test_review_difficulty.py -q -p no:cacheprovider -m 'not stockfish' --basetemp data/verification/grading-final-unit`:
  **134 passed, 14 native cases deselected**.
- `python -m pytest backend/tests/test_game_context.py backend/tests/test_cross_game_context.py backend/tests/test_game_accuracy.py backend/tests/test_chess_core.py backend/tests/test_human_review.py backend/tests/test_review_refinement.py backend/tests/test_refinement_storage.py backend/tests/test_refinement_search.py backend/tests/test_review_positions.py backend/tests/test_review_cues.py backend/tests/test_review_clocks.py -q -x -p no:cacheprovider -m 'not stockfish' --basetemp data/verification/grading-related`:
  **136 passed, 7 native cases deselected**. Both commands used the repository
  `.venv` Python. The final Windows `cmd.exe` invocations used the equivalent
  marker expression `not(stockfish)` to avoid shell quoting differences.
- Ruff lint, formatting (**281 files**), generated API agreement and
  `git diff --check` passed. No contracts, engine budgets, accuracy calculation,
  Maia policy, SRS rules or frontend code changed.
- A preceding native-inclusive run passed **144 cases** (including the new
  slower-mate and promotion regressions and the genuine queen sacrifice), but
  **3 review worker/restart cases failed at Stockfish startup**. A prior attempt
  likewise had two worker-start failures. These are not counted as green runs.
  Windows reported `WinError 1455` / paging-file-too-small and Git/Powershell
  allocation failures. Read-only host inspection found roughly 0.4–0.6 GB free
  virtual memory, despite plentiful physical RAM. The broader non-native suite
  was stopped after additional failures amid those allocation errors; it is
  unverified. No test-owned processes remained, and the owner's app was left
  running. Full backend/browser/Docker verification was not completed in this
  pass; no CI or deployment is claimed.

## Change-aware CI — September 29, 2026

Correctness now selects dependency-aware suites for PRs, with a fail-closed
final `CI` gate. Branch pushes no longer duplicate PR runs. Browser projects use
isolated jobs (two application file shards per viewport), share one production
build, and install only the runtime each suite needs. Main releases retain full
correctness and build/smoke/publish one image. Python/npm downloads and Docker
layers are cached. No product behavior, test assertion, engine budget or model
configuration changed. See [TESTING.md](TESTING.md#github-actions) for selection
rules, manual full runs and the required-check name.

Verified locally:

- `python -m pytest backend/tests/test_ci_plan.py -q -p no:cacheprovider
  --basetemp data/verification/ci-planner-final-retry`: **133 passed**, 2.66s.
  Coverage includes dependency unions, all viewports/shards, unknown paths,
  missing history, real Git renames/deletions, documentation build inputs,
  machine outputs, and rejection of failed/cancelled/missing/accidentally skipped
  selected jobs. Independent workflow/helper reviews found no blockers.
- Actionlint **1.7.12** passed both workflows. `ruff check backend scripts
  migrations`, `ruff format --check backend scripts migrations` (280 files),
  `python scripts/export_api_contract.py --check`, and `git diff --check` passed.
- `npm run build` passed generated-type agreement, application/test TypeScript
  checks and Vite. The existing large-chunk advisory remains.
- Playwright **1.63.0** collection was compared by test/project ID, using
  `node node_modules/playwright/cli.js test --config CONFIG --list --reporter=json`
  and each generated entry's `--project PROJECT --shard SHARD`. The ten matrix
  entries contain all **394** cases exactly once: application 298, accounts 8,
  studio 44 and intelligence 44. No missing/extra/duplicate IDs. This is coverage
  discovery, not a claim that 394 browser cases executed during this pass.
- `docker buildx build --load -t fieldwork:ci-efficiency-check
  data/verification/ci-efficiency-container/fieldwork` passed from a public-source
  export. Native dependency layers were reused. The direct Windows checkout
  could not be used because Docker could not read its local `.pytest_cache`.

The host exhausted virtual memory during broader verification. Results are
recorded explicitly rather than treating this as a clean full-suite run:

- Full `pytest -q -ra --durations=20 -p no:cacheprovider` with native Stockfish:
  **926 passed, 3 opt-in Maia skips, 2 failed**, 304.41s. It collected the first
  122 CI regressions before the final documentation-deletion cases were added.
  Both failures timed out during Stockfish startup; an immediate isolated retry
  reported Windows **WinError 1455**, paging file too small. After cleanup, both
  cases passed unchanged in **6.49s**: the imported clock/restart/branch case in
  `test_review_clocks.py` and cancelled refinement in `test_review_refinement.py`.
  The final 133 planner regressions were rerun separately as recorded above.
- `npx playwright test --config playwright.accounts.config.ts --project desktop
  --shard 1/1 --reporter=line`: final isolated retry **2 passed, 2 failed**.
  Trace bodies for both failed signups are exactly
  `{"detail":"[digital envelope routines] malloc failure"}` from password hashing.
  An earlier attempt also recorded Chromium `ERR_INSUFFICIENT_RESOURCES`.
  These are host allocation failures; account coverage is not reported passed.
- `python scripts/smoke_install.py --image fieldwork:ci-efficiency-check` completed
  the local-mode install/restart/native-review/Study portion, but the full smoke
  run was interrupted by WinError 1455 during Docker subprocess startup. A later
  retry hit an HTTP read timeout and Docker Desktop API 500 during cleanup.
  Account-mode container smoke verification remains incomplete on this host.

GitHub execution, cache reuse across Actions runs and actual CI wall-clock
improvement cannot be claimed from local validation. These workflows have not
been pushed during this pass. A published run must establish those results;
neither failed tests nor installation smoke checks are bypassed by the new gate.

## Study merge review — September 29, 2026

A second independent code-health pass covered legality and immutable snapshots,
opening recall/FSRS, frontend request/playback lifecycle, account isolation and
installation/migrations. Those production paths remain unchanged from `9ec3003`.
Final-head CI subsequently exposed two browser issues, which were investigated
rather than accepted as flakes:

- The shared coach observer used only the first entry from a visibility callback.
  A real six-times-CPU-throttled browser trace showed a queued offscreen/onscreen
  pair delivered together; the obsolete first entry left the visible portrait
  paused. The hook now uses the latest entry. A deterministic regression batches
  real browser observations in both directions and verifies active replay,
  offscreen pausing and no replay of consumed reactions. A served-module negative
  control restoring the old first-entry behavior fails this regression.
- The library reload test compared against an older scroll position while a font
  swap changed header height. Holding the Mono font response reproduced the exact
  two-pixel CI failure through two one-pixel native scroll-anchor adjustments.
  The fixture now waits for fonts before delivering its list and compares reload
  with the actual pre-reload position. Both original less-than-two-pixel
  assertions remain unchanged; **30 focused repeats passed** (15 per viewport),
  along with deterministic delayed-font checks on desktop and mobile.
- The account browser projects shared one client IP and together issued 16
  signup/login requests against the real 15-per-minute IP limit. A trace showed
  the final guest signup returning 429 immediately, followed by a misleading
  onboarding timeout. Each viewport now represents a separate reserved client
  IP through the test server's explicitly trusted loopback proxy; secondary
  contexts inherit it. Signup helpers assert the 201 response immediately.
  Production authentication limits and their enforcement are unchanged.

Coach-study tests also drive the existing dwell/settle timers with Playwright's
clock, preserving checks for a new replay take, visible portrait, active browser
animations, expression identity, rest, idle completion and reduced motion. The
first local full studio run passed all 42 tests, but CI demonstrated that clocks
alone did not fix the underlying visibility bug. Application timings and artwork
are unchanged; no assertions were removed.

Additional verification from this pass:

- The corrected isolated account suite passed **8/8 in 58.7 seconds**, exit 0:
  `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`.
  This includes every signup/login within the rate-limit window, second-device
  persistence, guest isolation and both onboarding paths. No production limit,
  timeout or assertion was relaxed.
- With the latest-entry observer correction, the new visibility-batch regression
  passed on **both desktop and mobile**, all **eight affected coach-study cases
  passed**, and the real six-times-CPU-throttled mobile Men probe passed. The
  old-callback served-module negative control failed the regression as expected.
  Browser-test TypeScript and independent hook/test review passed.
- The complete corrected studio suite passed **44/44**, with no skips, in 8.2
  minutes: `npx.cmd playwright test --config ../.tools/playwright.coach.study-phase5.config.ts --output studio-test-results-final-visibility-f814bb5`.
  After all tests completed, only the verified isolated Vite process was stopped
  to release Windows teardown; the runner returned exit 0. The owner's studio
  remained running on 5174.
- The corrected coach-study cases passed on **all eight desktop/mobile
  combinations** within the full studio run, using
  `npx.cmd playwright test --config ../.tools/playwright.coach.study-phase5.config.ts --output=studio-test-results-final-review-verified --reporter=line`.
  This temporary override changes only the server port/cache to preserve the
  owner's running studio on 5174. The final complete-suite result is recorded
  with PR #2's verification; merge requires that run and final-head CI to pass.
- From `frontend`, `npx.cmd playwright test --reporter=line`: **295 passed,
  3 intentional viewport skips**, in 6.6 minutes, with native Stockfish configured.
- `npx.cmd playwright test --config playwright.intelligence.config.ts --output=intelligence-test-results-final-review --reporter=line`:
  **44 passed**, no skips. Completed artifacts were moved to ignored
  `data/verification/study-merge-intelligence-results`.
- `npm.cmd run build`: passed, including generated API agreement, application
  and browser-test types, source archive and production Vite build.
- `.venv/Scripts/python.exe -m ruff check backend scripts migrations`,
  `.venv/Scripts/python.exe -m ruff format --check backend scripts migrations`,
  `.venv/Scripts/python.exe scripts/export_api_contract.py --check`, and
  `git diff --check`: passed (**278 formatted files**).
- Independent reviewers also ran overlapping focused suites: **116 legality,
  lesson and puzzle tests**, **83 opening/recall tests**, and **25 contract,
  installation and account-boundary tests**, all passing. An independent
  143,360-input legal-move comparison found only the intended rejection of bogus
  castling promotion suffixes.
- A disposable database upgrade from main's `49e862bc710a` revision preserved
  seeded exercise, review and SRS rows, added all ten Study tables, and passed
  foreign-key and model-schema checks.
- The first final-head Linux CI backend run passed **802 tests with 7 skips**:
  three opt-in Maia tests and four optional developer Zstandard cases. The local
  backend run passed **806 with 3 Maia skips**, exercising those Zstandard cases.
  Both CI runs also passed Docker installation, account and intelligence checks.
  Failed navigation/studio results were investigated as described above; a new
  complete CI run is required before merge.

A parallel local rerun encountered Chromium resource errors and timeouts. It was
not counted as a pass; only verified test-owned processes were stopped, leaving
the owner's running app/studio untouched. Follow-up checks run in isolation.
The separate pre-existing HTML username-pattern warning (unescaped hyphens under
Unicode Sets mode) was recorded during the account trace review, outside this
Study correction. Server-side username validation remains enforced.

The existing trusted-provider revision-reuse limitation remains documented in
[Study](STUDY.md); it does not affect saved attempts or account isolation. Native
Maia was not rerun in this code-health pass. GitHub Actions supplies the fresh
Linux backend/account and Docker installation checks for the final PR head.

## Study code-health review — September 29, 2026

Reviewed the Study branch's lesson/puzzle state machines, opening recall,
account boundaries, frontend request lifecycle and shared playback. This pass
made no layout or product changes.

Confirmed and fixed:

- A lost session-start response could create a duplicate lesson/rehearsal or
  select a different puzzle on retry. One shared retry helper retains the exact
  selected content and request ID until acknowledged or explicitly changed.
- Opening queue/start queries loaded and checked every stale unfinished session.
  A reproduction with 100 stale sessions issued 403 queue queries; the SQL
  authority filter now uses three. Regression tests verify the bound with 1/25
  stale sessions, queue precedence, limits and newest-current-session reuse.
- Equivalent standard castling encodings could reject the board's canonical move
  in puzzles, lessons and opening recalls. Comparisons and display frames now
  use legal move identities. Immutable lesson/opening snapshots and fingerprints
  remain intact; equivalent opening-answer repairs preserve schedules and
  retirement. The shared legality helper also rejects bogus promotion suffixes
  that python-chess's castling normalization otherwise discards.
- Branch and context-reset transitions into a rehearsal committed an automatic
  opponent move without returning its playback frame. Both transitions now
  return the committed frames; reload still does not replay them.

Focused regressions demonstrated failures before the fixes. The lesson suites
passed 72 tests, core/puzzle/contracts passed 57, opening query/regression suites
passed 68, and opening-castling cases passed 20. These overlapping focused runs
preceded the aggregate verification below.

- With `STOCKFISH_PATH=.tools/stockfish/stockfish-windows-x86-64-avx2.exe`,
  `.venv/Scripts/python.exe -m pytest -q -ra -p no:cacheprovider --basetemp=data/verification/study-code-review-20260929`:
  **806 passed, 3 opt-in Maia skips**, in 290.70 seconds. Native Stockfish ran;
  the skips are `test_human_runtime.py:128` and
  `test_maia_feasibility.py:90,105`, which require the separate pinned Torch/model
  runtime. There were two existing TestClient dependency deprecation warnings.
- `npm.cmd run build`: passed, including OpenAPI agreement, application and
  browser-test TypeScript, source packaging and Vite.
- `.venv/Scripts/python.exe -m ruff check backend scripts migrations` and
  `ruff format --check backend scripts migrations`: passed, 278 formatted files.
  The first aggregate format pass identified two mixed-line-ending files and
  one test wrapping issue; formatting was corrected before the passing rerun.
- `.venv/Scripts/python.exe scripts/export_api_contract.py --check` and
  `git diff --check`: passed. No API/schema regeneration was necessary.
- From `frontend`, `npx.cmd playwright test study-puzzles.spec.ts study-lessons.spec.ts study-start-retry.spec.ts italian-course.spec.ts opening-library.spec.ts opening-due.spec.ts navigation.spec.ts --reporter=line`:
  **89 passed, 1 intentional mobile skip** for desktop modifier-click. The
  navigation filename also selects the existing variation-navigation suite.
  Tests use the production frontend and test backend on desktop/mobile, including
  real server commits followed by deliberately lost responses.
- `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`:
  **8 passed**, including second-device persistence and account isolation.
- The earlier focused `npx.cmd playwright test tests/study-start-retry.spec.ts`
  run passed all 16 cases. Its Windows test-server teardown required stopping
  only the verified test-owned Python PID after tests finished; the aggregate
  browser/account runs exited normally.

No Docker deployment, model-weight changes, native Maia rerun or unrelated
coach-studio/intelligence-lab browser rerun was needed. Existing Vite bundle-size
and Starlette/httpx advisories remain. A separate nonblocking trusted-provider
revision-reuse limitation is documented in [Study](STUDY.md): before any lesson
progress exists, opening-only enrollment pins individual lines rather than the
complete course fingerprint. Previously saved studies and recalls remain safe.

Fix commits: `e6fd39d` (rehearsal playback), `1820fb2` (bounded recall queries),
`9aac92d` (shared/puzzle/lesson castling), `593701b` (retryable starts), and
`e5a93dc` (opening castling). All are local; this pass did not publish the branch.

## Study frameworks and Italian pilot — September 28, 2026

Verified the approved Study sprint on `codex/study-frameworks`: private puzzle
and lesson sessions, opening recall through existing Review/FSRS, and the shipped
three-chapter Italian course. Production puzzle sources intentionally remain
empty. Test fixtures exist only in injected test applications.

- `.venv/Scripts/python.exe -m pytest -q -ra -p no:cacheprovider --basetemp=data/verification/study-phase5-backend-20260928-pb1`: **738 passed, 3 opt-in Maia skips**, with native Stockfish configured. The skips are `test_human_runtime.py:128` and `test_maia_feasibility.py:90,105`; the next command exercises all three.
- `.tools/maia-runtime/Scripts/python.exe -m pytest backend/tests/test_maia_feasibility.py backend/tests/test_human_runtime.py -m maia -q -ra -p no:cacheprovider --basetemp=data/verification/study-final-maia-native`: **3 passed, 9 deselected**, using cached 79M weights, CPU and `HF_HUB_OFFLINE=1`. No model download.
- `npx.cmd playwright test --reporter=line`: **271 passed, 3 deliberate viewport skips** (phone-only review on desktop; desktop modifier/new-tab and width-matrix tests on mobile). Includes the real Italian course and the lesson scroll-reset regression.
- `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`: **8 passed**, including Study/coach persistence across browser sessions and foreign-account session/library isolation.
- Full coach-studio suite: **42 passed**, zero skips, with `npx.cmd playwright test --config ../.tools/playwright.coach.study-phase5.config.ts --output=studio-test-results-study-phase5 --reporter=line`. The temporary override uses the normal suite on port 5176 and an isolated Vite cache, preserving the owner's running 5174 studio.
- `npx.cmd playwright test --config playwright.intelligence.config.ts --output=intelligence-test-results-study-phase5 --reporter=line`: **44 passed**, zero skips, using its normal 5175 server with a separate output directory. After workers finished, Windows retained the test server; stopping only that verified test-server PID allowed the runner to exit normally with the passing summary.
- `npm.cmd run build`: passed, including API agreement, application/browser-test types, corresponding-source archive and Vite. Full Ruff lint/format (**276 files**), `python scripts/export_api_contract.py --check`, and `git diff --check`: passed. Existing Vite chunk-size and TestClient dependency advisories remain.
- Fresh disposable database: `python -m alembic upgrade head` and `python -m alembic check`: passed at `7c249ef302d6`, no schema drift, SQLite integrity `ok`, no foreign-key violations.
- `docker build -t fieldwork:study-verification .tools/study-release-context-20260928` and `python scripts/smoke_install.py --image fieldwork:study-verification`: passed in local and account modes. Covers installed Italian content, empty puzzle libraries, lesson progress through restart, explicit opening enrollment/Due without analysis jobs, existing native Stockfish review, health and preferences. Build context was a public tracked-source copy; no private databases, caches or models were included.

Each framework checkpoint ran its focused HTTP and browser regression suites
before committing. Italian acceptance/native coverage passed **6 tests** with no
skips, including a bounded Stockfish gross-error check of guided decisions. All
300 historical plies were legally replayed and checked against the source record;
the unplayed Steinitz mating continuation is excluded. These checks do not claim
that every historical move is best or that the course covers every Black reply.

Manual checks used a separate disposable database and the actual application at
1440×1000 and 390×844: puzzle retries/reload/completion, a connected lesson across
all six step kinds, catalogue enrollment/Due feedback, and the real Italian
guidance/alternative with reload and exact return. Desktop/mobile screenshots of
the historical excerpts were also inspected. Testing found and fixed lesson
explanations retaining an old scroll offset; the regression verifies reset
without remounting the portrait/message or losing keyboard focus. Independent
cross-domain reviews found no remaining scheduling, account or cold-answer leak.

The current contracts and source decisions live in [Study](STUDY.md) and
[Italian sources](ITALIAN_COURSE_SOURCES.md); milestone commits are recorded in
[Implementation history](IMPLEMENTATION_HISTORY.md). No merge or deployment was
performed as part of this verification.

The studio also needed the same Windows server cleanup after all workers had
exited; both runners returned exit 0 with their complete passing summaries.
Artifacts remain under ignored `frontend/studio-test-results/study-phase5` and
`frontend/intelligence-test-results/study-phase5`. No owner process was stopped.

## Full release verification — September 28, 2026

Validated the accumulated main-branch UX, provider import and onboarding work.
Corrected stale navigation/weakness-copy assertions and the migration test's
whole-row comparison after adding onboarding state. The shared backend fixture
now explicitly uses an absent Maia path; installed developer models cannot change
fallback tests. The intelligence laboratory uses its own Vite dependency cache,
preventing concurrent studio optimization from causing `Outdated Optimize Dep`.

- `.venv/Scripts/python.exe -m pytest -q -ra -p no:cacheprovider --basetemp=data/verification/release-sep28-backend-final`: **637 passed, 3 opt-in Maia skips**, with native Stockfish configured.
- `.tools/maia-runtime/Scripts/python.exe -m pytest backend/tests/test_maia_feasibility.py backend/tests/test_human_runtime.py -m maia -q -ra -p no:cacheprovider --basetemp=data/verification/release-sep28-maia-native`: **3 passed, 9 deselected**. Used the installed pinned research runtime, cached 79M checkpoint, CPU and `HF_HUB_OFFLINE=1`; covers the three opt-in tests above. An initial attempt in the ordinary virtualenv skipped two upstream comparisons because `maia3` is installed only in the research runtime.
- `npx.cmd playwright test --reporter=line`: **221 passed, 3 deliberate viewport-specific skips** (desktop modifier-click/layout checks and phone-only layout check).
- `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`: **6 passed**.
- Full coach studio suite: **42 passed**, using a temporary config on port 5176 to preserve the owner's running studio on 5174; temporary config removed afterward.
- `npx.cmd playwright test --config playwright.intelligence.config.ts --reporter=line`: **44 passed**, rerun after isolating its dependency cache while the studio remained active.
- `npm.cmd run build`, `ruff check backend scripts migrations`, `ruff format --check backend scripts migrations`, `python scripts/export_api_contract.py --check`, and `git diff --check`: **passed**. Existing chunk-size and TestClient deprecation advisories remain.
- Fresh disposable database: `python -m alembic upgrade head` and `python -m alembic check`: **passed**, no schema drift.
- `docker build -t fieldwork:release-sep28 .tools/release-sep28-context` and `python scripts/smoke_install.py --image fieldwork:release-sep28`: **passed** in local and account modes, including fresh install, restart, native review/health, coach and interface preferences. The build context contained only tracked working-tree source; direct repository context traversal was blocked by a protected local pytest cache. No cache ACL changes were made.

## One-time account onboarding — September 28, 2026

New accounts receive optional provider connection setup and a short, conditional
import guide. Completion is stored on the user; migration grandfathers existing
users. Unfinished sessions resume with saved connections. No import/engine job is
started by the onboarding screens themselves.

- `.venv/Scripts/python.exe -m pytest backend/tests/test_onboarding.py backend/tests/test_accounts.py backend/tests/test_api_contract.py backend/tests/test_game_providers.py -q -p no:cacheprovider --basetemp=data/verification/onboarding-1`: **30 passed**, covering migration, authentication/CSRF, idempotent completion, account isolation, restart persistence and local-mode bypass.
- `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`: **6 passed** across desktop/mobile. Both optional-username paths, interrupted flow reload, failed completion/retry, direct entry into provider/PGN forms, completed-account reload and existing second-device login coverage pass.
- `npm.cmd run build`, `ruff check backend scripts migrations`, `ruff format --check backend scripts migrations`, and `git diff --check`: passed. OpenAPI and generated TypeScript were regenerated through the existing tools. Existing Vite chunk-size and TestClient deprecation advisories remain.
- Inspected desktop PGN and mobile provider guide screenshots. No live provider requests, deployment or unrelated full-suite rerun.

## Lichess and shared game providers — September 28, 2026

Implemented on main after `d42ea35`; backend/migration/API foundation committed as
`739b517`. [Provider integration](GAME_PROVIDERS.md) describes the shared adapter
boundary, account connections, checkpoints, limits, cooldown and extension steps.

Validation on Windows with the existing locked dependencies and native Stockfish:

- Initial focused provider/Chess.com/sync/account/API regression set: **47 passed**.
- Full backend run: `.venv/Scripts/python.exe -m pytest -q -ra -p no:cacheprovider --basetemp=data/verification/providers-full-2`, with `STOCKFISH_PATH=.tools/stockfish/stockfish-windows-x86-64-avx2.exe` and `HUMAN_MODEL_PATH=data/verification/deliberately-absent-maia.pt`: **633 passed, 3 optional native Maia skips, 1 fixture failure**. The hosted-runtime fixture created a sync job without a complete provider request. It now supplies the same required request fields as production.
- Final follow-up: `.venv/Scripts/python.exe -m pytest backend/tests/test_hosted_runtime.py backend/tests/test_game_providers.py backend/tests/test_chesscom.py backend/tests/test_game_sync.py -q -p no:cacheprovider --basetemp=data/verification/providers-final-targeted`: **43 passed**, including the corrected fixture and final unknown-total progress/cooldown behavior. All observed backend failures are resolved; the full suite was not repeated after this fixture correction. An earlier full run also hit two missing-model assumptions because this machine has Maia installed; the explicit absent-model path above exercised those fallbacks successfully without modifying their tests or the installed model.
- `ruff check backend scripts migrations`, `ruff format --check backend scripts migrations`, `python scripts/export_api_contract.py --check`, and `git diff --check`: passed.
- `npm.cmd run build`: passed, including generated contract agreement, application/browser-test TypeScript, source packaging and Vite. Existing large-chunk advisory remains.
- `npx.cmd playwright test providers.spec.ts training.spec.ts --grep 'Lichess|local saved connections|saved-name|Chess.com|PGN upload|compact workspace' --reporter=line`: **16 passed** across desktop/mobile. Covers both providers, PGNs, fetch-only versus opt-in native training, deduplication, saving both connections, refresh/reload and a delayed saved-name hydration regression. Earlier test failures led to disabling the username field until initial hydration completes, scoping status locators, and observing both syncs in the same polling cycle.
- `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`: **2 passed**, including second-device connection persistence and private libraries.
- Inspected generated desktop/mobile Settings screenshots. Browser tests use the real production frontend/backend with injected public-provider HTTP fixtures. No live Lichess/Chess.com import or Unraid deployment was performed. The complete unrelated coach/intelligence/browser suites were not rerun for this import feature.

The two existing FastAPI TestClient/httpx/AnyIO deprecation warnings remain.

## Thirty-coach cast and behavior revamp - September 28, 2026

Verified on `codex/coach-revamp`, based on `ddf1925`. The preserved owner brief is
[COACH_CAST_BIBLE.md](COACH_CAST_BIBLE.md); the final roster, compatibility choices,
motion architecture and preview commands are in [COACH.md](COACH.md). The owner's
later picker decision supersedes the brief's optional group headings: production
Settings is an unbroken six-column/five-row desktop grid, with smaller portraits
and responsive four/three/two-column layouts. No visible categories or filters.

Completed units: `67a6c8c` preserved the brief, `1633b69` expanded the account/API
contract and retired-ID handling, and `ce66320` integrated the artwork, behavioral
dialogue, four-idle expression pools, compact selection, developer tools and tests.
The temporary implementation ledger was removed after this permanent handoff.
No push, merge, live deployment, engine budget or grading change was made.

Host: Windows, Python 3.12.10, Node 24.19.0, Docker 29.1.3. Existing locked
dependencies, local Stockfish and cached Maia weights were used. Test databases,
screenshots, source exports and logs remain ignored development artifacts.

### Validation actually run

- `npm.cmd ls --depth=0` and `npm.cmd run build` from `frontend`: passed. The build
  includes generated API agreement, application/contract/browser-test TypeScript,
  downloadable source packaging and Vite. It was rebuilt after new files were
  committed so the source download includes the complete cast implementation.
- With `STOCKFISH_PATH=.tools/stockfish/stockfish-windows-x86-64-avx2.exe`,
  `.venv/Scripts/python.exe -m pytest -q -ra --basetemp data/verification/coach-revamp-backend -o cache_dir=data/verification/coach-revamp-cache`:
  **618 passed, 3 optional Maia skips**, including native Stockfish. The two
  existing TestClient/httpx/AnyIO deprecation warnings remain.
- With `MAIA_CHECKPOINT_DIR=data/maia-benchmark/models`, `MAIA_TEST_MODEL=79m`,
  `MAIA_TEST_DEVICE=cpu` and `HF_HUB_OFFLINE=1`,
  `.tools/maia-runtime/Scripts/python.exe -m pytest backend/tests/test_maia_feasibility.py backend/tests/test_human_runtime.py -m maia -q -ra --basetemp data/verification/coach-revamp-maia -o cache_dir=data/verification/coach-revamp-maia-cache`:
  **3 passed, 9 deselected**. This exercised all three optional checks skipped in
  the ordinary environment, with cached weights and no model download.
- `npx.cmd playwright test --reporter=line`: **213 passed, 3 intentional skips**
  in the complete desktop/mobile application suite. Skips remain the phone-only
  layout test on desktop and desktop-only modifier-click/wide-layout cases on
  mobile. The missing-Chess.com-user test intentionally logs an import error.
- `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`:
  **2 passed**, covering account isolation, another browser session, coach and
  interface-motion persistence. Repeated after the compact-picker refinement.
- `npx.cmd playwright test --config playwright.intelligence.config.ts --reporter=line`:
  **44 passed**, uninterrupted on final production dialogue, with no skips or
  retries. Includes causal actors/colors, hypothetical positional scope, sparse
  payloads, blocked passed pawns, stationary rooks, cold SRS and blind comparison.
- All **42 tests** in the normal coach-studio configuration passed on desktop and
  mobile, with no skips. The ignored `../.tools/playwright.coach.revamp.config.ts`
  wrapper imports the normal config and enables reuse of the owner's existing
  port-5174 server; its tests, projects and application are unchanged. From
  `frontend`, with that `--config`, the partitions were:
  - `coach-studies.spec.ts coach-studio.spec.ts full-cast.spec.ts --output=studio-test-results-inspector --reporter=line`: **22 passed**.
  - `reduced-motion.spec.ts --output=studio-test-results-inspector-reduced --reporter=line`: **2 passed**.
  - `motion-vocabulary.spec.ts --reporter=line`: **4 passed**.
  - `idle-cadence.spec.ts idle-articulation.spec.ts --output=studio-test-results-animation`: the **12 cadence checks passed**; an incorrect test-only Vite import path initially failed both articulation checks. After correcting that path, `idle-articulation.spec.ts --output=studio-test-results-animation` passed **2 checks**, exercising all 2,400 mounted slots on both devices.
- `.venv/Scripts/ruff.exe check backend scripts migrations`,
  `.venv/Scripts/ruff.exe format --check backend scripts migrations`,
  `.venv/Scripts/python.exe scripts/export_api_contract.py --check`,
  `.venv/Scripts/python.exe -m pip check` and `git diff --check`: passed.
  Ruff formatting checked 226 files after adding the legal positional fixture.
- With `DATABASE_PATH=data/verification/coach-revamp-fresh.sqlite3`,
  `.venv/Scripts/python.exe -m alembic upgrade head` and
  `.venv/Scripts/python.exe -m alembic check`: passed. SQLite integrity returned
  `ok`; foreign-key check returned no rows. No schema migration was needed.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_source_archive.py -q --basetemp data/verification/coach-revamp-source -o cache_dir=data/verification/coach-revamp-source-cache`:
  **5 passed**, repeated after committing the new source files.
- `docker build --progress=plain -t fieldwork:coach-revamp-ce66320 .tools/coach-revamp-context-ce66320`:
  passed using a public tracked-source export of the committed feature, avoiding
  restricted local cache directories. Locked dependency install, API/type checks,
  corresponding-source packaging and the Linux production build passed.
- `.venv/Scripts/python.exe scripts/smoke_install.py --image fieldwork:coach-revamp-ce66320`:
  fresh local/accounts, restart, native Stockfish review/health, origin/cookie
  protection and independent coach/interface-motion preferences all passed.
  Disposable containers/volumes were removed by the harness; the live host was
  not contacted.

### Review and visual checks

The full cast has 20 expressions and four distinct configured idle variants per
expression. Production scheduler checks cover repeated cycles, immediate-repeat
avoidance, expression changes, hidden/offscreen pauses, Still/device overrides and
separation from full reactions. Independent review checked actual SVG articulation
targets; browser checks verified the corresponding animation tracks. Actual-size
idle frames were inspected across eleven representative character/state pairs,
and all thirty desktop/mobile expression sheets were captured. A mirrored raccoon
ear pivot and a half-width tablet singleton preview were corrected.

The production renderer corpus covered **10,800 outputs and 1,777 authored forms**,
with no audit errors or whole-voice collisions. The ten common-situation subset
covered 3,600 renders: no primary neutral fallback, and 144 secondary neutral
fallbacks for ordinary Stockfish alternative comparisons. All 300 single-take
blind comparison outputs were read. Writing refinements removed unsupported
passed-pawn clearance, implied rook movement after a pawn move, dangling Robot
labels and ambiguous consequence-first references. A missed tactic establishes
the unplayed move before its effects. An allowed-mate explanation no longer
repeats the same reply solely to say that it checks.

Manual application inspection used a disposable native game import, selected
Robot, opened its real review, stepped through feedback, reloaded, and inspected
desktop and phone layouts. The compact picker was inspected at desktop size;
automated geometry and screenshots cover 390px and 320px widths. Saved selection
and actual review portraits were exercised for all thirty coaches. No user games
or live preferences were altered.

Development failures were investigated rather than hidden: the first application
run had 14 stale wording/unsafe-template expectation failures, all corrected while
preserving actor, reply, facts and lifecycle assertions. The final full run passed.
Early studio trace teardown errors came from sharing an output directory; isolated
runs passed. One earlier lab navigation hit Chromium `ERR_NO_BUFFER_SPACE` while
several browser suites ran together; the final full lab run passed uninterrupted.

Vite still warns about its 500-kB chunk threshold: the application is 536.59 kB
minified / 143.75 kB gzip, plus the separately cached React chunk at 69.04 kB gzip.
No dependencies, downloaded artwork, voice system, continuous JavaScript animation
loop or warning suppression was introduced. This is a build advisory, not a test
failure. Emulated phones do not establish physical-device performance, and writing
audits cannot establish personal taste. The studio and blind lab remain available
for the owner's creative review; no engineering blocker remains.

## Best move beneath the coach portrait: focused checks - September 28, 2026

Game review now places its best-move readout beneath the portrait using an optional
shared caption slot. Move notation stays on one line; the speech bubble, board and
half-width actions retain their geometry. Human insight remains below the actions.

- From `frontend`, `npm.cmd run build`: passed, including generated API agreement,
  application/contract/browser-test TypeScript checks and the production bundle.
- With local Stockfish and Chromium enabled,
  `npx.cmd playwright test review-presentation.spec.ts variation-navigation.spec.ts human-insight.spec.ts --grep 'review modes share|SRS shares animated|variation return is|natural_error has an accessible' --reporter=line`:
  **8 passed**. Updated layout assertions verify the caption directly under the
  portrait, unwrapped notation, shared action dimensions and no caption in cold
  SRS across 1920px, 1366px, 1000px, 390px, 375px and 320px layouts. Existing
  feedback/explanation, variation-return and human-insight checks also passed.
- Desktop and 320px phone screenshots inspected; `git diff --check` passed.

This small follow-up received focused verification; the full suites below were not
repeated. No push or deployment was performed.

## Full UX verification - September 28, 2026

The owner authorized full verification after the rapid UX changes through
`b9b21cb` on `main`. All application checks passed; no production or regression-test
corrections were needed. Host: Windows, Python 3.12.10, Node 24.19.0, Docker 29.1.3.
Tests used disposable data and the existing local Stockfish/checkpoint installations.

- From `frontend`, `npm.cmd ls --depth=0` and `npm.cmd run build`: passed,
  including source packaging, generated API agreement, and application, contract
  and browser-test TypeScript checks.
- `.venv/Scripts/python.exe -m pytest -q -ra --basetemp data/verification/ux-full-b9b21cb -o cache_dir=data/verification/ux-full-cache-b9b21cb`:
  **592 passed, 3 opt-in Maia skips**, with native Stockfish enabled. The two
  existing TestClient/httpx/AnyIO deprecation warnings remain.
- With `MAIA_CHECKPOINT_DIR=data/maia-benchmark/models`, `MAIA_TEST_MODEL=79m`,
  `MAIA_TEST_DEVICE=cpu`, and `HF_HUB_OFFLINE=1`,
  `.tools/maia-runtime/Scripts/python.exe -m pytest backend/tests/test_maia_feasibility.py backend/tests/test_human_runtime.py -m maia -q -ra --basetemp data/verification/ux-maia-full-b9b21cb -o cache_dir=data/verification/ux-maia-cache-b9b21cb`:
  **3 passed, 9 deselected**. All three native checks skipped by the ordinary
  environment were exercised offline in the pinned CPU runtime.
- `npx.cmd playwright test --reporter=line`: **207 passed, 3 intentional skips**,
  full unfiltered desktop/mobile application suite. Skips are desktop-only
  modifier-click and wide-layout cases on mobile, and the phone-only layout case
  on desktop. The missing-Chess.com-user fixture intentionally logs an import error.
- `npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line`:
  **2 passed**. Full intelligence lab via `--config playwright.intelligence.config.ts`:
  **34 passed**. Full coach studio: **28 passed** via
  `--config ../.tools/playwright.coach.full-b9b21cb.config.ts`; the ignored wrapper
  imports the normal config, uses the same test/output directories, and only
  enables reuse of the owner's existing port-5174 server. An initial wrapper module
  loading error was corrected before tests ran. The owner's server was preserved.
- `.venv/Scripts/ruff.exe check backend scripts migrations`,
  `.venv/Scripts/ruff.exe format --check backend scripts migrations`,
  `.venv/Scripts/python.exe scripts/export_api_contract.py --check`,
  `.venv/Scripts/python.exe -m pip check` and `git diff --check`: passed.
  Fresh Alembic upgrade/check at `data/verification/ux-schema-full-b9b21cb.sqlite3`,
  SQLite integrity and foreign-key checks passed.
- `docker build --progress=plain -t fieldwork:ux-full-b9b21cb .tools/ux-full-context-b9b21cb`:
  passed. The context is a public tracked-source export of `b9b21cb`, avoiding the
  checkout's restricted Windows cache directories. The image's locked dependency
  installation and production build passed.
- `.venv/Scripts/python.exe scripts/smoke_install.py --image fieldwork:ux-full-b9b21cb`:
  fresh local/accounts, origin and cookie handling, native review/engine health,
  separate coach/interface preferences and persistence across restart passed.
- `docker run --rm --network none` with the existing 79M checkpoint mounted
  read-only at `/models/maia3-79m.pt`, `HUMAN_MODEL_PATH` pointing there, image
  `fieldwork:ux-full-b9b21cb`, and `python scripts/smoke_human.py`: native review,
  human policy, restart cache and coach independence passed without network access.

Desktop/mobile review screenshots were inspected. Results cover local verification
and Chromium phone emulation, not a physical device or remote CI/deployment.
No push or Unraid update was performed.

## Shared coach action sizing: focused checks

SRS, game review and explanation playback now use the action row owned by
`ReviewCoach`. Buttons share its width up to half the row each (allowing for the
gap), with the same height, padding and typography. Game move/insight context has
its own compact line; adding Return to game leaves Show why's dimensions intact.
The separate SRS and game sizing overrides were removed.

- The sizing regression first failed against the old build on desktop/mobile:
  game actions stayed 110px wide instead of growing to the half-row allocation.
- From `frontend`, `npx.cmd playwright test review-presentation.spec.ts variation-navigation.spec.ts human-insight.spec.ts --grep 'review modes share|SRS shares animated|variation return is|natural_error has an accessible' --reporter=line`:
  **7 passed, 1 failed**. All six shared-layout/SRS/variation checks passed,
  covering 1920px through 320px, equal sizing, stable feedback/explanation slots,
  unchanged board geometry, return behavior and cold-answer exclusion. The mobile
  insight check could not click navigation behind the centered popover/header.
- After explicitly scrolling that real navigation button clear of both overlays,
  `npx.cmd playwright test human-insight.spec.ts --grep 'natural_error has an accessible' --reporter=line`:
  **2 passed**, desktop/mobile, preserving open/close, source notes and stale-board
  dismissal assertions. All eight distinct focused checks now pass. Desktop and
  320px phone coach/action screenshots were inspected.
- `npx.cmd tsc -b`, `npx.cmd tsc --project tsconfig.browser-tests.json`,
  `npx.cmd vite build` and Git whitespace checks passed.
- Full verification remains deferred by owner request; no push/deployment.

## Background refinement progress: focused checks

The game-review progress panel now hides during active background refinement.
Session polling, search budgets and saved evidence are unchanged; failed or
interrupted jobs retain recovery controls.

- The updated regression reproduced the persistent progress panel on desktop
  and mobile before the fix.
- From `frontend`, `npx.cmd playwright test game-review.spec.ts --grep 'refinement continues in the background|opening starts once|progress merges only' --reporter=line`:
  **6 passed**, desktop/mobile. Checks baseline progress, disappearing refinement
  progress, continued report updates, navigation without duplicate searches,
  stable selected-board geometry, and existing pause/retry/resume behavior.
  The isolated Windows test server needed explicit shutdown after the browser
  checks finished; the runner then exited successfully.
- `npx.cmd tsc -b`, `npx.cmd tsc --project tsconfig.browser-tests.json`,
  `npx.cmd vite build` and Git whitespace checks passed.
- Full verification remains deferred by owner request; no push/deployment.

## Balanced Import layout: focused checks

Source controls now sit above the two equal-width panels, giving forms and
activity matching headings, padding and top/bottom edges. Activity uses one
container with separated entries and a centered empty state. Training checkboxes
are inline rather than inheriting full-width, 44px input sizing; phone labels
retain a 44px touch target. Panels stack at 900px and below.

- From `frontend`, `npx.cmd playwright test training.spec.ts --grep 'PGN upload form|Chess.com username import|Chess.com missing username' --reporter=line`:
  **6 passed**, desktop/mobile. Covers PGN and Chess.com submission, training
  opt-in, filters/dates, deduplication, progress and retryable provider errors.
  The missing-username fixture intentionally logs a failed import.
- Inspected populated desktop/mobile screenshots and used the app's Chess.com
  and PGN forms with empty activity. At 1000px both panels measured the same
  width/height/top; at 900px and 320px they stacked without horizontal overflow.
  The phone checkbox measured 18px inside a 44px-high label. The isolated preview
  used a test database, and its tab/server were closed afterward.
- `npx.cmd tsc -b`, `npx.cmd vite build` and Git whitespace checks passed.
- Full verification remains deferred by owner request; no push/deployment.

## Animation settings grouping: focused checks

Coach motion now appears beside Piece & interface motion in Settings → Animations,
with its save, loading, reduced-motion and retry feedback next to the control.
Your coach retains character selection. Existing preference providers, account
persistence and override behavior are unchanged.

- From `frontend`, `npx.cmd playwright test coach.spec.ts motion.spec.ts --grep 'coach motion|preference failures|piece and interface motion saves|motion load and save failures' --reporter=line`:
  **10 passed**, desktop/mobile. Covers both controls in Animations, independent
  choices, reload persistence, device changes, overrides and failed-save/retry
  behavior. Desktop and 320px phone panel screenshots inspected.
- `npx.cmd tsc -b`, `npx.cmd tsc --project tsconfig.browser-tests.json`,
  `npx.cmd vite build` and Git whitespace checks passed. The account browser test's
  save-status selector was updated; that separate suite was not run.
- Full verification remains deferred by owner request; no push/deployment.

## Start-of-game navigation: focused checks

The `<<` control now returns to the original game's starting position (ply 0),
including from a variation, and is disabled there. Its accessible name is
**Start of game**. This supersedes the earlier owner-requested ply-1 behavior.

- From `frontend`, `npx.cmd playwright test variation-navigation.spec.ts coach.spec.ts game-review.spec.ts --grep 'start of game always|variation return is|game navigation and SRS attempts|progress merges only' --reporter=line`:
  **8 passed**, desktop/mobile. Covers starting pieces and move count, return from
  variations and later moves, disabled controls at ply 0, neutral opening coaching,
  initial evaluation, no duplicate searches and unchanged control alignment.
- `npx.cmd tsc -b`, `npx.cmd tsc --project tsconfig.browser-tests.json`,
  `npx.cmd vite build` and Git whitespace checks passed.
- Full verification remains deferred by owner request; no push/deployment.

## Evaluation graph drag scrubbing: focused checks

The graph captures mouse/touch/pen drags and selects each newly crossed ply,
updating the original-game board and coaching while held. Release, cancellation
and lost capture end the gesture; vertical phone scrolling remains native.
Compatibility mouse events cannot override the selected marker's keyboard focus.

- The new drag regression failed on both desktop and mobile before implementation:
  moving a held pointer left the original position selected.
- From `frontend`, `npx.cmd playwright test evaluation-scrub.spec.ts evaluation.spec.ts game-review.spec.ts --grep 'evaluation scrubs|evaluation scales|dense evaluation|review both players' --reporter=line`:
  **8 passed**, desktop/mobile. Covers intermediate board/coach scores, endpoint
  clamping outside the graph, release/cancellation/lost capture, repeated gestures,
  native vertical touch scrolling, no new searches for saved positions, keyboard
  focus, dense markers, clicks/taps and returning from variations.
- The first combined run exposed a keyboard-focus regression (fixed) and one
  mobile page-initialization timeout before the graph rendered. The complete
  focused rerun passed without retries. Touch checks use Chromium emulation.
- `npx.cmd tsc -b`, `npx.cmd tsc --project tsconfig.browser-tests.json`,
  `npx.cmd vite build` and Git whitespace checks passed.
- Full verification remains deferred by owner request; no push/deployment.

## Responsive Move quality comparison: focused checks

Move quality now presents player names/colors above larger accuracy scores, with
each player's counts on either side of centered quality labels. Its rows fill the
tab, text and icons respond to the tab's available dimensions, and completion
status sits below the comparison. Compact spacing keeps the full comparison
visible in normal laptop/phone panels; constrained panels retain internal scrolling
and sticky player headings. No grading, counting, accuracy or board-sizing changes.

- From `frontend`, `npx.cmd playwright test game-review-presentation.spec.ts game-review.spec.ts --grep 'moves and move quality|paused partial review|book moves appear' --reporter=line`:
  **6 passed**, desktop/mobile, after refining the compact layout. Covers six
  viewport sizes, growing text/icons/rows, filled panel height, no unnecessary
  scrolling, player attribution, original-game counts/accuracy through variations,
  partial-review controls and unchanged board/page/tab geometry.
- The responsive-panel test additionally captures isolated panel previews for
  visual inspection. Desktop, laptop and 320px phone screenshots inspected.
- App and browser-test TypeScript checks, Vite build and Git whitespace checks
  passed. Full verification remains deferred by owner request; no push/deployment.

## Review column alignment and stable variation actions: focused checks

Started from updated `main` at `88b278d`. Browser regressions reproduced an 8px
sidebar overhang and Show why shrinking from 110px to about 74px on desktop
(188px to about 74px on mobile). The shared workspace now measures the rendered
board column and excludes the controls' trailing padding from sidebar height.
Game coach actions use the same dimensions before and during exploration, with
the move context taking remaining space and shrinking allowed only when needed.

- From `frontend`, `npx.cmd playwright test variation-navigation.spec.ts game-review-presentation.spec.ts review-presentation.spec.ts --grep 'variation return is|moves and move quality|review modes share' --reporter=line`:
  **6 passed**, desktop/mobile. Checks bottom-edge alignment across desktop sizes,
  stable action dimensions when entering a variation, 320px phone fit, unchanged
  board sizing, sidebar tabs/scrolling and the shared SRS layout.
- `npx.cmd tsc -b`, `npx.cmd tsc --project tsconfig.browser-tests.json`,
  `npx.cmd vite build` and Git whitespace checks passed. Desktop and small-phone
  screenshots inspected.
- Full verification remains deferred by owner request; no push or deployment in this pass.

## UX release: full branch verification (September 27, 2026)

The owner authorized full verification after the rapid UX changes through
`9e98006`. One stale Docker smoke assertion expected `natural` instead of the
new `system` coach default. It now checks the correct default and independently
saves/restores coach and interface motion in both local and account installations.
No application defect was found in this pass.

- `npm.cmd ci --cache '../.tools/npm-cache' --no-audit --no-fund` and
  `npm.cmd run build` from `frontend`: passed, including generated API agreement
  and application/contract/browser-test TypeScript checks. The existing coach
  studio was briefly stopped to release Windows' esbuild lock, then restored.
- `.venv/Scripts/python.exe -m pytest -q --basetemp data/verification/ux-release-full-20260927 -o cache_dir=data/verification/ux-release-cache-20260927`:
  **592 passed, 3 Maia opt-in skips**, native Stockfish enabled. The two existing
  TestClient/httpx/AnyIO deprecation warnings remain.
- With `MAIA_CHECKPOINT_DIR=data/maia-benchmark/models`, `MAIA_TEST_MODEL=79m`,
  `MAIA_TEST_DEVICE=cpu`, `HF_HUB_OFFLINE=1`, the pinned CPU runtime's
  `python -m pytest backend/tests/test_maia_feasibility.py backend/tests/test_human_runtime.py -m maia -q`:
  **3 passed, 9 deselected**. All skipped native checks were exercised offline.
- `npx.cmd playwright test --reporter=line`: **205 passed, 3 intentional viewport
  skips**, desktop/mobile; full unfiltered application suite.
- `npx.cmd playwright test --config=playwright.accounts.config.ts --reporter=line`:
  **2 passed**. `--config=playwright.coach.config.ts`: **28 passed**.
  `--config=playwright.intelligence.config.ts`: **34 passed**.
- `ruff check backend scripts migrations`, `ruff format --check backend scripts migrations`,
  `python scripts/export_api_contract.py --check`, `python -m pip check` and
  `git diff --check`: passed. Fresh isolated Alembic upgrade/check, SQLite integrity
  and foreign-key checks passed.
- `docker build --progress=plain -t fieldwork:ux-release-20260927 .tools/ux-release-context-20260927`:
  passed using a tracked-source archive (the checkout's ignored Windows cache
  has restricted permissions). `python scripts/smoke_install.py --image fieldwork:ux-release-20260927`:
  fresh local/accounts, secure-cookie/origin handling, restart, independent
  preferences, native review and engine health passed after the assertion fix.
- `docker run --rm --network none` with the existing checkpoint mounted read-only,
  `HUMAN_MODEL_PATH=/models/maia3-79m.pt`, image `fieldwork:ux-release-20260927` and
  `python scripts/smoke_human.py`: native Stockfish/Maia review, persisted restart
  cache and coach independence passed without network or model downloads.

These are local release checks. Remote CI and deployment are verified separately;
phone results use Chromium emulation, not physical-device testing.

## Game review library link: focused checks

All games sits at the bottom left below the board; the repeated matchup/date/result
heading is removed. Desktop move controls remain centered, while phones put the
library link below the controls to retain their touch widths. The shared SRS
heading and board sizing are unchanged.

- From `frontend`, `npx.cmd playwright test review-presentation.spec.ts variation-navigation.spec.ts navigation.spec.ts game-review-presentation.spec.ts --grep 'review modes share|variation return is|Back, Forward|returning to the library|moves and move quality' --reporter=line`:
  **10 passed**, desktop/mobile. Covers link placement, shared board/coach sizes,
  centered controls, library pagination/history and sidebar layout through 320px.
- `npx.cmd tsc -b`, `npx.cmd tsc --project tsconfig.browser-tests.json`,
  `npx.cmd vite build` and Git whitespace checks passed. Desktop/mobile screenshots
  inspected. Full verification remains deferred by owner request.

## Piece and interface motion preferences: focused checks

Settings offers device-default, Animated and Still for pieces/interface effects,
independent of the same coach choices. One owned preference row persists both;
the additive migration defaults existing accounts to device behavior without
changing their coaches. Shared device resolution, preference lifecycle and CSS
replace independent browser-only board/interface checks. Full verification is
still deferred by owner request.

- `.venv/Scripts/python.exe -m pytest backend/tests/test_motion_preferences.py backend/tests/test_coach_preferences.py -q --basetemp data/verification/interface-motion -o cache_dir=data/verification/interface-motion-cache`:
  **31 passed**, with the two existing TestClient deprecation warnings. Covers
  fresh/existing defaults, restart, unsupported values, account isolation/CSRF,
  independent updates and concurrent first writes, migration integrity/FKs.
- From `frontend`, `npx.cmd playwright test motion.spec.ts coach.spec.ts review-presentation.spec.ts --grep 'motion|preference failures|connecting with a LAN token|SRS shares animated' --reporter=line`:
  **16 passed**, desktop/mobile. Checks actual piece transitions and badge CSS,
  evaluation/interface transitions, browser overrides in both directions, coach
  independence, reload, live device changes, failed load/save recovery and cold SRS.
- `npx.cmd playwright test --config=playwright.accounts.config.ts --grep 'account signup' --reporter=line`:
  **2 passed**, restoring the saved choice on another device and keeping a new
  account's device default independent.
- After widening the phone selector and explicitly testing both LAN-protected
  preference endpoints, `npx.cmd playwright test motion.spec.ts coach.spec.ts --grep 'piece and interface motion saves|connecting with a LAN token' --reporter=line`:
  **4 passed**. Desktop/320px phone Settings screenshots inspected.
- App/browser TypeScript checks, Vite bundle, changed-Python Ruff lint/format,
  API export/generated-type checks and Git whitespace checks passed. API outputs
  were regenerated using the existing scripts. No full suites, Docker deployment
  or engine-budget changes.

## Horizontal evaluation-bar score: focused checks

The board bar displays a horizontal, one-decimal pawn score. Existing coach/graph
precision and mate notation are unchanged. `npx.cmd playwright test evaluation.spec.ts --reporter=line`
passed both desktop/mobile checks, including rounding, positive/negative/mate/
missing scores, label orientation and bounds, and unchanged graph navigation.
Vite bundle and diff checks passed; desktop screenshot inspected. Full
verification remains deferred by owner request.

## Return action placement: focused checks

The purple Return to game action now sits beside Show why in the same row.
Entering a variation no longer adds an action row between the bubble and controls.
`npx.cmd playwright test variation-navigation.spec.ts --grep 'variation return is' --reporter=line`
passed both desktop/mobile checks, including 320px phone width, unchanged action
height, no horizontal overflow and exact return to the original position. Vite
bundle and diff checks passed; screenshots inspected. Full verification remains
deferred by owner request.

## Review sidebar tabs: focused checks

Moves and Move quality now share one panel. The inset quality table uses sticky
username headings; review progress stays available from either tab. Evaluation
is shorter and the moves panel has more room. Tab changes preserve the selected
position, board size and panel height. Desktop scrolling stays inside the review
workspace; mobile retains normal page scrolling.

- From `frontend`, `npx.cmd playwright test game-review-presentation.spec.ts review-presentation.spec.ts game-review.spec.ts --grep 'moves and move quality|a paused partial|progress merges|review modes share|book moves appear|opening starts once' --reporter=line`:
  **12 passed**, desktop/mobile. Covers tab click/keyboard behavior, six viewport
  sizes, no added page height, shared SRS/game board geometry, progress/accuracy
  updates, pause/resume/retry and unchanged original-game counts in variations.
- After the sticky-heading polish, `npx.cmd playwright test game-review-presentation.spec.ts --grep 'moves and move quality' --reporter=line`:
  **2 passed**, including usernames remaining visible during internal scrolling.
- `npx.cmd tsc -b`, `npm.cmd run test:types`, `npx.cmd vite build` and
  `git diff --check` passed. Desktop/mobile screenshots inspected.
- Full verification remains deferred by owner request. No API, engine, grading,
  persistence or deployment changes.

## Variation navigation UX: focused checks

Return to game is a purple primary action below the coach. Stepping back to a
variation's root restores the mainline; First move always selects original-game
ply 1. Desktop move controls remain centered, with Flip board on the right.

- `playwright test variation-navigation.spec.ts --reporter=line`: 6 passed on
  desktop/mobile, including centered controls, keyboard/button exits, original
  game preservation, full-width return action and no horizontal overflow.
- Directly affected existing review/late-analysis checks: 4 passed. The coach
  navigation/SRS check passed on both viewports after explicitly waiting for
  review completion before asserting initial-position text.
- App/test TypeScript checks, Vite bundle and diff checks passed. Desktop/mobile
  screenshots inspected. Full verification remains deferred by owner request.

## Coach cadence and motion choices: focused checks

All characters share a 500–1000ms idle gap. Device motion is the default; saved
Animated/Still choices override it. Subtle has been removed. Full verification
is intentionally deferred until the owner finishes the current UX changes.

- `pytest backend/tests/test_coach_preferences.py -q`: 24 passed; includes saved
  choices, migration defaults, legacy Subtle fallback and account isolation.
- `playwright test --config ../.tools/pr1-coach.config.ts idle-cadence.spec.ts reduced-motion.spec.ts --reporter=line`:
  12 passed across desktop/mobile; repeated idle cycles, visibility pausing,
  device defaults, explicit overrides and actual CSS animation.
- `playwright test coach.spec.ts --grep 'coach motion' --reporter=line`:
  4 passed across desktop/mobile; actual Settings saves/reloads and device changes.
- App/test TypeScript checks, Vite bundle, changed-file Ruff lint/format and
  `git diff --check` passed. API contracts/types regenerated through their tooling.

## Review product cleanup: final verification

Completed units: `01c0e3b` removes story presentation and its dead response-time
projection; `7088285` scopes personal coaching to the saved learner; `87618fe`
surfaces human insights and cleans the focused shared/character wording. Review
of the complete diff confirmed no changes to engine budgets, grading thresholds,
Maia weights/setup, persisted schemas or coach animation timing. Context and
history remain two-sided/learner-owned respectively.

From the repository root, using the existing locked environment:

```powershell
npm.cmd --prefix frontend run build
.venv/Scripts/ruff.exe check backend scripts migrations
.venv/Scripts/ruff.exe format --check backend scripts migrations
.venv/Scripts/python.exe scripts/export_api_contract.py --check
.venv/Scripts/python.exe -m pytest -q --basetemp data/verification/review-product-full -o cache_dir=data/verification/review-product-full-cache
```

Build, API export/generated types, app/endpoint/browser TypeScript and Ruff pass
(222 Python files formatted). Backend: **582 passed, 3 skipped**, 169.89 s, with
native Stockfish and the two existing TestClient deprecation warnings. The three
Maia opt-ins were then run using the existing pinned CPU runtime and cached model:

```powershell
$env:MAIA_CHECKPOINT_DIR = 'C:\Users\cwmle\Documents\chesstrainer\data\maia-benchmark\models'
$env:MAIA_TEST_MODEL = '79m'
$env:MAIA_TEST_DEVICE = 'cpu'
$env:HF_HUB_OFFLINE = '1'
.tools/maia-runtime/Scripts/python.exe -m pytest backend/tests/test_maia_feasibility.py backend/tests/test_human_runtime.py -m maia -q --basetemp data/verification/review-product-native -o cache_dir=data/verification/review-product-native-cache
```

Native Maia: **3 passed, 9 deselected**, 40.04 s. No checkpoint was downloaded.
From `frontend`, with these browser/native-engine paths:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\cwmle\Documents\chesstrainer\.tools\playwright'
$env:STOCKFISH_PATH = 'C:\Users\cwmle\Documents\chesstrainer\.tools\stockfish\stockfish-windows-x86-64-avx2.exe'
npx.cmd playwright test --reporter=line
npx.cmd playwright test --config=playwright.accounts.config.ts --reporter=line
npx.cmd playwright test --config ../.tools/pr1-coach.config.ts --reporter=line
npx.cmd playwright test --config=playwright.intelligence.config.ts --reporter=line
```

- Application: **191 passed, 3 expected viewport skips**, 3.1 min.
- Accounts: **2 passed**, 43.8 s, isolated account database.
- Coach studio: **28 passed**, 2.7 min; the ignored config inherits the normal
  studio configuration and reuses the owner's existing port-5174 server.
- Intelligence lab: **34 passed**, 46.3 s; all 16 selectable coaches audited.

The first complete application run had eight failures (four outdated presentation
assertions on both viewports): the initial story's
explaining reaction, the old critical-moment progress wording, opening text taking
priority over a book move's mistake, and personal legacy text on opponent plies.
Those assertions now verify the intended behavior, retaining exact ply navigation,
utterance changes, persisted feedback, objective labels, accuracy and geometry.
The full rerun above passed. Three viewport-specific skips remain intentional.

Fresh migration verification (no persisted schema change was needed):

```powershell
$env:DATABASE_PATH = 'data/verification/review-product-fresh.sqlite3'
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m alembic check
.venv/Scripts/python.exe -c "import sqlite3; c=sqlite3.connect('data/verification/review-product-fresh.sqlite3'); print(c.execute('pragma integrity_check').fetchall()); print(c.execute('pragma foreign_key_check').fetchall())"
```

Passed: no new upgrade operations, integrity `ok`, no foreign-key violations.
The direct Docker checkout build hit the previously documented Windows cache ACL.
A clean archive of committed product code `87618fe` built successfully:

```powershell
git archive --format=zip --output=.tools/review-product-source.zip HEAD
Expand-Archive -LiteralPath .tools/review-product-source.zip -DestinationPath .tools/review-product-context
docker build -t fieldwork:review-product-cleanup .tools/review-product-context
.venv/Scripts/python.exe scripts/smoke_install.py --image fieldwork:review-product-cleanup
```

Both local and account modes passed fresh installation, restart, native Stockfish
review/health and coach preference persistence. No existing deployment was touched.
The additional offline combined review smoke initially failed because its harness
still asserted `move-events-3`. It now validates `MoveIntelligence` against the
current public contract; production evidence code was unchanged. The corrected
script was mounted read-only into the same image for verification:

```powershell
docker run --rm --network none --mount 'type=bind,source=C:\Users\cwmle\Documents\chesstrainer\data\maia-benchmark\models\maia3-79m.pt,target=/data/models/maia3-79m.pt,readonly' --mount 'type=bind,source=C:\Users\cwmle\Documents\chesstrainer\scripts\smoke_human.py,target=/app/scripts/smoke_human.py,readonly' fieldwork:review-product-cleanup python scripts/smoke_human.py
```

Passed: native review, exact human policy, restart/cache reuse, and coach
independence with networking disabled. Test-owned containers/volumes and the
manual inspection server were stopped; owner services were preserved. No push,
merge or live deployment was performed. Physical-phone/Safari verification and
the long native quality benchmark were not repeated for this presentation pass.

## Review product cleanup: visible human insights and concise prose

Eight new checks failed before the change: mechanical natural/hard-find wording,
masked unusual-strong choices, absent natural-best/near-best and found-defense
claims, and missing-policy abstention. Synthetic legal games now pass through the
production practical/report projection and then the real dialogue/UI boundary.
No engine, model, grade, animation or persisted-schema behavior changed.

- `python -m pytest backend/tests/test_review_difficulty.py backend/tests/test_human_review.py backend/tests/test_review_events.py -q --basetemp data/verification/human-insight -o cache_dir=data/verification/human-insight-cache`:
  **44 passed**, 6.65 s. Includes native Stockfish, persisted human refresh/cache,
  coach preference independence and cold-SRS protection; two existing warnings.
- From `frontend`, `npx.cmd playwright test tests/human-insight.spec.ts tests/dialogue-logic.spec.ts tests/personality.spec.ts --reporter=line`:
  **64 passed**, 38.8 s, desktop/mobile. Seven insight kinds, absent/stale/forced/
  opponent evidence, domain caution, popup geometry and keyboard dismissal,
  navigation cleanup, source wording and saved coach/reload invariance.
- `npx.cmd playwright test --config=playwright.intelligence.config.ts --reporter=line`:
  **34 passed**, 46.3 s. All 16 selectable coaches preserve facts/hypotheticals,
  omit population claims/opening disclaimers, and pass the complete writing audit.
- `npm.cmd --prefix frontend run build`, API generation check, browser/app/endpoint
  TypeScript checks and backend Ruff check/format passed.
- Actual production UI inspected with synthetic reports at 1440×1100, 390×844 and
  320×700. The compact insight leaves board/bubble geometry intact; long labels
  wrap, the popup is keyboard/touch accessible and no horizontal overflow occurs.
  Screenshots are ignored verification artifacts, not owner game data.

Iteration caught and fixed review Escape swallowing native popup dismissal and
two repeated opening sentences. The mobile geometry assertion now uses document
coordinates, distinguishing Playwright's automatic scroll from layout movement.
Only the five relevant human/opening entries per character were rewritten; the
remaining personality corpus was retained.

## Review product cleanup: learner perspective

Six new regressions reproduced opponent recovery/personal relationship/achievement
selection in both colors. The UI used mover identity where it needed the saved
learner. Intent v5 explicitly scopes personal delivery; the backend graph remains
two-sided and owned history keeps its existing learner filter. Legal recovery
mainlines with synthetic evaluations run through production report/context code.

- `python -m pytest -q backend/tests/test_game_context.py backend/tests/test_cross_game_context.py`:
  **28 passed**, 8.76 s, including both-color history isolation.
- `npx.cmd playwright test tests/learner-perspective.spec.ts tests/dialogue-logic.spec.ts tests/coach-logic.spec.ts tests/personality.spec.ts --reporter=line`:
  **56 passed**, 33.5 s. Covers every consumed relationship, opponent help,
  history, objective labels, saved identity through flip/reload, cold SRS and preferences.
- The intelligence suite passed 28 cases; two lab checks still expected the old
  `di4` prefix. They now assert the exact production intent ID.
  `npx.cmd playwright test --config playwright.intelligence.config.ts laboratory.spec.ts --reporter=line`:
  **6 passed**, 4.6 s, after that correction.
- Production build/API types, Ruff check/format and diff checks passed.

## Review product cleanup: story removal

The new absence regression reproduced the story region before removal; the two
native full-review cases also failed on the unwanted narrative API field. Story
selection was derived on read, with no persisted schema to migrate. Move context,
history, scores, refinement and navigation remain intact. Contracts were regenerated
with `python scripts/export_api_contract.py` and `npm --prefix frontend run api:generate`.

- `python -m pytest -q backend/tests/test_game_review.py backend/tests/test_game_context.py backend/tests/test_cross_game_context.py`:
  **51 passed**, 21.86 s (native Stockfish; two existing dependency warnings).
- `npx.cmd playwright test tests/game-review-presentation.spec.ts tests/dialogue-logic.spec.ts tests/personality.spec.ts --reporter=line`:
  **34 passed**, 25.4 s, desktop/mobile including absence, navigation/reload and paused review.
- `npx.cmd playwright test --config playwright.intelligence.config.ts --reporter=line`:
  **30 passed**, 32.4 s, including the current personality corpus and diagnostic renderer.
- `npm.cmd --prefix frontend run build`, `ruff check backend scripts migrations`,
  `ruff format --check backend scripts migrations`, API export `--check` and
  `git diff --check`: passed. Ruff normalized the edited test's line endings.

## Coach idle cadence follow-up

The first tuning still felt too sparse in use. Quiet gaps are now 0.5–1.5 s for
humans (previously 2–5 s), 0.75–1.75 s for cats (2.5–5.5 s), and 1–2 s for
dogs (3–6 s). Subtle adds 0.5 s instead of 1.5 s. Only timing constants and their
documented test expectations changed; 1.2 s gestures, reactions and pause behavior
remain unchanged.

Validation from `frontend`, using the same local Chromium/Stockfish environment:

- `npx.cmd playwright test --config ../.tools/pr1-coach.config.ts --reporter=line`:
  **28 passed**, 2.5 min, including repeated idle cycles and pause/resume checks
  on desktop/mobile. The existing owner studio server was reused.
- `npx.cmd playwright test tests/coach.spec.ts tests/coach-logic.spec.ts tests/coach-selection.spec.ts --reporter=line`:
  **26 passed**, 27.4 s. The initial sandboxed run passed its assertions but stalled
  in test-server cleanup; only its verified server tree was stopped. A fresh run
  with normal process permissions passed and cleaned up without intervention.
- From the root, `npm.cmd --prefix frontend run build` and `git diff --check`
  passed. No test skips or assertion failures.

## Coach idle cadence tuning

Only existing idle delays changed: men/default 4.5–10 s to 2–5 s, women
5.5–11.5 s to 2–5 s, cats 5.5–11.5 s to 2.5–5.5 s, and dogs 6–12 s to
3–6 s. Subtle's extra delay is now 1.5 s instead of 4 s. Women's explicit idle
range preserves their existing reaction timings. Gesture durations remain 1.2 s;
artwork, reaction timing, scheduling and visibility/reduced-motion logic are unchanged.

The new controlled-clock browser regression exercises the real studio scheduler
for each collection on desktop/mobile: three automatic idle cycles after a
reaction, unchanged gesture duration, Subtle's extra delay, and no reaction replay.
It checks cancellation and resumption for Still, native reduced-motion preferences,
real offscreen scrolling, and a simulated `document.hidden`/`visibilitychange`
transition across multiple idle windows, without arbitrary sleeps.

From `frontend`, with the documented Chromium/Stockfish environment:

```powershell
npx.cmd playwright test --config ../.tools/pr1-coach.config.ts idle-cadence.spec.ts --max-failures=2 --reporter=line
npx.cmd playwright test --config ../.tools/pr1-coach.config.ts --reporter=line
npx.cmd playwright test tests/coach.spec.ts tests/coach-logic.spec.ts tests/coach-selection.spec.ts --reporter=line
```

- Focused cadence checks: **10 passed**, 11.5 s.
- Full coach studio: **28 passed**, 2.5 min.
- Application coach suites: **26 passed**, 27.2 s.
- No skips or failures. The ignored studio config reuses the owner's existing
  server; the standard committed config is unchanged.
- From the repository root, `npm.cmd --prefix frontend run build` passed,
  including API consistency, strict application/browser-test types, endpoint
  contracts and the production Vite build. `git diff --check` passed.

## PR #1 follow-up: browser-test type coverage

Reproduced the previously recorded ad hoc TypeScript failure at `10bdaae`:
Node imports/globals had no declarations, and the recovery context fixture was
incomplete. Enabling the normal strict settings for all browser tests also caught
an incomplete move-report fixture. Both fixtures now satisfy the generated API
types without assertions hiding missing fields. Node 24 types are locked as a
development dependency. `npm run test:types` now includes application, studio,
intelligence-lab tests and all Playwright configs, so the existing build/CI gate
prevents this gap returning.

- `npm.cmd --prefix frontend run build`: passed, including API consistency,
  strict application types, endpoint contract tests and all browser-test types.
- The exact ad hoc `tsc --noEmit` command recorded below now passes too.
- From `frontend`, with the documented Chromium/Stockfish environment,
  `npx.cmd playwright test tests/dialogue-logic.spec.ts --reporter=line`:
  **24 passed** (desktop/mobile), 9.1 s. Assertions and behavioral coverage remain.
- `git diff --check`: passed.

## PR #1 follow-up: synchronized reduced motion

The original studio test passed 20 pre-fix repetitions, but the new focused
native-media transition regression reproduced the unchecked checkbox twice before
any production change. Trace instrumentation showed the shared MediaQueryList had
changed to `true` without delivering its change event to any of the 31 registered
listeners. Portrait animation renders read the new live value while the parent
control retained the old value. Removing those render-time reads resolved the
reproduction: all coach consumers now read one event-driven snapshot. Its single
native listener detaches when unused and resynchronizes on remount. There is no
polling, forced checkbox click, increased timeout or trace suppression.

The new studio regression checks all portraits, the checkbox, notice, disabled
state and absence of animations across repeated device changes, manual preview
overrides and reload. A production Settings regression changes the device
preference while no coach consumers are mounted, then returns without reloading.
Both additional follow-ups from the previous correction pass are now resolved.

From `frontend`, using the same Chromium/Stockfish environment documented below:

```powershell
npx.cmd playwright test --config ../.tools/pr1-coach.config.ts reduced-motion.spec.ts --repeat-each=20 --max-failures=1 --reporter=line
npx.cmd playwright test tests/coach.spec.ts --reporter=line
npx.cmd playwright test --reporter=line
npx.cmd playwright test --config ../.tools/pr1-coach.config.ts --reporter=line
npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line
npx.cmd playwright test --config playwright.intelligence.config.ts --reporter=line
```

- Native media transition repetition: **40 passed**, 20 desktop + 20 mobile,
  1.3 min. Real Settings/coach integration: **12 passed**, 17.6 s.
- Full application: **141 passed, 3 expected viewport skips**, 2.7 min.
- Full coach studio, including the original failed test: **18 passed**, 2.4 min.
- Accounts: **2 passed**, 43.1 s. Intelligence laboratory: **30 passed**, 37.1 s.
- The studio used the previously documented ignored config to preserve the
  owner's running development server; the normal config still refuses to take
  over an occupied port.

From the repository root:

```powershell
npm.cmd --prefix frontend run build
.venv/Scripts/python.exe -m pytest -q -ra --basetemp data/verification/pr1-followup-backend -o cache_dir=data/verification/pr1-followup-pytest-cache
.venv/Scripts/ruff.exe check backend scripts migrations
.venv/Scripts/ruff.exe format --check backend scripts migrations
.venv/Scripts/python.exe scripts/export_api_contract.py --check
git diff --check
```

All passed. Backend: **587 passed, 3 explicit native-Maia opt-in skips**, 152.14 s;
`MAIA_CHECKPOINT_DIR` was unset. Native Stockfish ran. The two existing TestClient
dependency deprecation warnings remain. Build includes the new strict browser-test
type gate. No engine settings, model weights, chess evidence, account schema or
container configuration changed. Temporary diagnostic code was removed.

## PR #1 correction pass: coach-selection lifecycle

At reviewed head `7423d61`, the latest PR run `36360090312` failed on mobile
with `response.json: Test ended`; the same-head push run passed. Twelve local
repetitions of the original test passed, consistent with an intermittent race.
The response listener could start body reads after its promise array was drained.
Back navigation and reload now each register an explicit response wait before
navigation and await its body. The synchronous request observer is removed in
`finally`. Reload also verifies unchanged wording, intent, chess facts and job,
two completed handshakes, and no new analysis requests.

Using the documented local Stockfish and Chromium environment variables:
`npx.cmd playwright test tests/personality.spec.ts --grep 'saved coach selection' --repeat-each=20 --reporter=line`
passed **40/40** (20 desktop, 20 mobile), 52.1 s. Repetition supplements the
explicit lifecycle ownership; it is not proof that every possible race is absent.

### Mover-caused semantic explanations

Six new regressions failed at the reviewed head: `analyze_move` produced each
causal finding in both colors, but `public_report` dropped all six. The correction
introduces `caused` with the original mover actor and explicit opponent opportunity,
retaining strict actor/witness gates. Consumer tests cover repeated motifs and
owned historical weakness matching. Browser regressions generate reports through
Python's production pipeline and render them through all 16 registered coaches.

- `python -m pytest -q backend/tests/test_review_events.py backend/tests/test_patterns_v3.py backend/tests/test_game_context.py backend/tests/test_cross_game_context.py backend/tests/test_game_narrative.py`:
  **72 passed**, two existing TestClient dependency warnings.
- `npx.cmd playwright test --config playwright.intelligence.config.ts --reporter=line`:
  **20 passed** (desktop/mobile, including all six causal cases and the existing lab).
- `npm.cmd --prefix frontend run build`: passed, including generated API consistency
  and TypeScript contracts. OpenAPI and TypeScript regenerated through the normal
  export commands for `move-events-4`; export `--check`, Ruff check/format passed.

### Alternative positional consequences

Four frontend regressions reproduced the exact branch loss: legal bishop-pair
and doubled-pawn alternatives in both colors were narrated as actual facts.
Their new backend tests passed before the fix, confirming the server retained
the correct line, move and affected side. The correction carries typed position
scope through intent version 4 and uses a shared conditional renderer for every
alternative positional family. Actual-move wording stays factual; personality
overrides cannot remove hypothetical scope.

- `python -m pytest -q backend/tests/test_review_positions.py`: **16 passed**.
- `npx.cmd playwright test tests/dialogue-logic.spec.ts tests/personality.spec.ts --reporter=line`:
  **30 passed**, desktop/mobile, including an intentionally unsafe personality
  override that cannot replace alternative scope.
- `npx.cmd playwright test --config playwright.intelligence.config.ts --reporter=line`:
  **30 passed**. All 16 coaches render the legal actual/alternative cases and all
  eleven positional claim forms without losing conditional scope or evidence IDs.
- `npm.cmd --prefix frontend run build`: passed, including API/type checks.

### Final correction validation

Production corrections are in `b097005`, `9d41882` and `b8bc1ae`. No engine
budgets, weights, grades, migrations or cold-SRS disclosure rules were changed.
The final verification also corrects test-only fixture types to use the detailed
report contract and a complete context node, without changing their assertions.

From the repository root, these exact commands passed:

```powershell
npm.cmd --prefix frontend run build
.venv/Scripts/python.exe -m pytest -q -ra --basetemp data/verification/pr1-final-backend -o cache_dir=data/verification/pr1-pytest-cache
.venv/Scripts/ruff.exe check backend scripts migrations
.venv/Scripts/ruff.exe format --check backend scripts migrations
.venv/Scripts/python.exe scripts/export_api_contract.py --check
$env:DATABASE_PATH = 'data/verification/pr1-corrections-schema.sqlite3'
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m alembic check
```

Backend: **587 passed, 3 skipped**, 151.22 s. The skips are the unchanged explicit
Maia opt-ins in `test_human_runtime.py` and `test_maia_feasibility.py`, because this
run did not set `MAIA_CHECKPOINT_DIR`; native Stockfish ran. Two existing
TestClient dependency deprecations and a Windows pytest-cache write warning were
reported. All tests completed; the cache warning did not fail a test. Ruff checked
222 files; API/type checks and disposable migration upgrade/check passed.

From `frontend`, browser runs used these environment values:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\cwmle\Documents\chesstrainer\.tools\playwright'
$env:STOCKFISH_PATH = 'C:\Users\cwmle\Documents\chesstrainer\.tools\stockfish\stockfish-windows-x86-64-avx2.exe'
npx.cmd playwright test --reporter=line
npx.cmd playwright test --config playwright.accounts.config.ts --reporter=line
npx.cmd playwright test --config playwright.intelligence.config.ts --reporter=line
npx.cmd playwright test --config ../.tools/pr1-coach.config.ts --reporter=line
```

- Full application: **139 passed, 3 expected viewport skips**, 2.6 min.
- Accounts: **2 passed**, 41.2 s.
- Intelligence laboratory: **30 passed**, 32.7 s.
- After the test-only fixture type correction,
  `npx.cmd playwright test --config playwright.intelligence.config.ts causal-dialogue.spec.ts positional-dialogue.spec.ts --reporter=line`:
  **22 passed**, 25.9 s.
- Coach studio: **16 passed**, 2.2 min. The ordinary studio command detected the
  owner's existing port 5174. Its process/path was verified; an ignored temporary
  config inherited the normal config, used absolute test/output paths and enabled
  `reuseExistingServer`. The existing process was preserved.
- The lifecycle stress run above remains **40/40**; no sleeps, skipped assertions
  or swallowed asynchronous failures were added.

Docker's direct checkout build encountered an existing Windows ACL error opening
excluded `.pytest_cache`. A clean archive of committed source `b8bc1ae` built and
passed the same fresh-install smoke procedure:

```powershell
git archive --format=zip --output=.tools/pr1-corrections-source.zip HEAD
Expand-Archive -LiteralPath .tools/pr1-corrections-source.zip -DestinationPath .tools/pr1-corrections-context
docker build -t fieldwork:pr1-corrections .tools/pr1-corrections-context
.venv/Scripts/python.exe scripts/smoke_install.py --image fieldwork:pr1-corrections
```

Local and account modes both passed fresh install, restart, native Stockfish
review/health and coach-preference persistence. No existing installation or live
database was used.

Additional, non-CI inspection: a direct `tsc --noEmit` invocation over Playwright
test sources was not a configured repository check. That run reported absent Node
type declarations and a pre-existing partial-context cast in `dialogue-logic.spec.ts`.
No dependency or test-typechecking infrastructure changes were made in this
targeted pass. The supported production build/type-contract checks and runtime
browser suites passed. The browser-test type coverage follow-up above resolves
this separate typing gap and adds it to the normal build gate.
The additional command (from `frontend`) was:

```powershell
npx.cmd tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --jsx react-jsx --skipLibCheck tests/dialogue-logic.spec.ts tests/personality.spec.ts tests/semantic-fixtures.ts tests/positional-claims.ts intelligence-tests/causal-dialogue.spec.ts intelligence-tests/positional-dialogue.spec.ts intelligence-tests/render-coaches.ts
```

## Review intelligence completion: September 27, 2026

Milestones 0–14 of [the specification](REVIEW_INTELLIGENCE_PLAN.md) are complete.
The commit map and retained design decisions are in
[IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md). No production deployment
or remote push was performed. The temporary progress ledger was removed after
this final review; synthetic reports/databases/screenshots remain ignored.

Final automated verification:

- Full backend: **564 passed, 3 explicit native-Maia opt-in skips**, 143.25 s.
  Native Stockfish ran. The two existing Starlette/httpx/AnyIO test-client
  deprecation warnings remain; no application test failure remains.
- Supported cached **79M CPU** native/parity/worker suite: **12 passed**, 37.20 s,
  with no skips. It covers upstream policy parity, history/special moves,
  deterministic repeats, real subprocess deadlines/cancellation/restart and
  bounded transport. No Torch import is added to the API process. The normal
  suite also tests account cache ownership, host-slot contention, invalidation,
  refinement cancellation/resume, migrations and cold-SRS exclusions.
  Transport fault cases use synthetic subprocess workers; native cases load the
  actual supported checkpoint.
- Final full application browser suite: **129 passed, 3 expected viewport skips**,
  2.4 min. Includes every registered coach, persistence, dialogue provenance,
  semantic delivery intensity, stale async responses, branch return, in-place
  Show Why, summary jumps, SRS failure/retry/recovery and reduced motion.
- Account browser suite: **2 passed**. Standalone expression studio: **16 passed**
  across desktop/mobile and every current character/expression. The studio run
  reused the existing verified checkout's port 5174 using a disposable config;
  the owner's viewer process was preserved.
- Final offline intelligence-lab suite: **8 passed**. Current registry audit:
  **16 coaches, 912 curated lines, zero corpus errors or writing collisions**.
  The normal production build excludes both developer surfaces from executable
  assets/navigation while keeping their public source in the source download.
- Production build, OpenAPI/type contracts, Ruff lint and formatting passed.
  React's cached chunk is 221.86 kB raw / 69.04 kB gzip; application code including
  all synchronous coach definitions is 319.28 kB / 96.93 kB. No chunk-size warning.

The repeatable native whole-game harness imports and reviews ten original
synthetic games (114 plies) at the unchanged depth-16 / 0.8-second baseline with
default 8-position / 4-question additive refinement. Ratings span 600–2600 and
include Lichess blitz, Chess.com rapid/blitz, missing ratings/domain and setup
positions. It verifies exact model probabilities/provenance, bounded work,
context references, all coach IDs preserving identical stored facts, a real
interactive variation, and completed cache reuse after restart with an unusable
Stockfish executable. No Decisions, exercises or recalls are created.

| Measured combined run | Windows native | Linux CPU Docker, no network |
| --- | ---: | ---: |
| Python | 3.12.10 | 3.12.14 |
| Stockfish | 18 | 17.1 |
| Logical CPUs reported | 24 | 24 |
| Time for ten games, including first native/model startup | 148.30 s | 125.75 s |
| Cached reopen of all ten after restart | 0.310 s | 0.296 s |
| API process peak RSS, excluding native children | 123.63 MiB | 115.11 MiB |
| Saved human policies / refinement positions | 114 / 41 | 114 / 41 |

Native inspection found the supported Brilliant queen offer, only-move recapture,
recovery linked to the earlier queen loss, three repeated-motif relationships,
missed mates, book moves that remain objectively bad, a drawn repetition and a
19-ply conversion with no graded errors. The failed conversion does not produce
a successful-conversion narrative. Search-specific findings differ across native
binaries; absent/contradictory support is not filled in to satisfy a coverage tag.
These are integration probes and development inspection, **not an independently
blinded accuracy measurement or population calibration**.

Fresh Docker installation/restart/native Stockfish review passed in both local
and HTTPS-origin account modes, including coach preference persistence. The
combined native corpus and separate short smoke passed with `--network none`
and a read-only pinned checkpoint. Explicit setup returned `already_verified`
offline; `--verify-only` also passed. Linux cgroup peak memory was **1,348,587,520
bytes (1.26 GiB)**, including processes and charged filesystem cache. Docker
reported **1.6 GB disk usage / 376 MB content size**, plus the separate 316 MB
checkpoint. The large CPU dependency layer is reused for application updates.

Manual inspection used the actual application with native saved reports: Brilliant
and recovery feedback, Show Why, coach switching/back navigation and saved
preferences, desktop and 390px phone layouts. A real native export loaded in the
isolated lab and traced the selected Quiet Analyst recovery sentence to its
earlier move and engine/context evidence. Actual bubble inspection removed a
repetitive Collie opener. Diagnostics exposed an overly urgent Book delivery;
intent version 3 now separates factual claim ordering from reaction intensity.
Final semantic/personality tests and the complete browser/lab suites pass after
that correction. Temporary servers were stopped and viewport overrides reset.

Limits: mobile verification uses Chromium emulation, not a physical phone. Proxy
cookies/origins are exercised without deploying Cloudflare or Unraid. CUDA and
5M/23M comparisons were run during the feasibility milestone, not repeated as
production models in this final CPU pass; smaller checkpoint terms remain an
upstream follow-up. Human difficulty remains a conservative uncalibrated heuristic,
and unsupported strategic causes continue to abstain. No TTS or training-transfer
claim was introduced.

## Separate coach development viewer: September 27, 2026

The expression viewer has its own loopback-only Vite process (`npm run dev:coach`,
port 5174), HTML entry point and browser-test suite. The application no longer
imports the studio, links to it from Settings or recognizes `/coach-studio`.
Selectable coaches and account persistence remain in the application.

- Production build, generated API consistency and TypeScript contracts passed.
  Built assets contain no studio interface, controls or stylesheet chunk.
- Full application browser suite: **101 passed, 3 expected viewport skips**.
- Standalone development studio: **16 passed** across desktop and mobile,
  covering all 16 characters/20 expressions, transitions, idle behavior, bookmark
  fallbacks and reduced motion. The studio makes no API requests.
- Manually used the separate viewer and inspected the built app's mobile
  Settings and SRS layout. The corrected SRS spacing remains stable during
  failed attempts, accepted moves and explanation playback.
- CI now runs the standalone studio in addition to the application and account
  suites. No backend, schema, container variable or production service changed.

## Mobile SRS spacing: September 27, 2026

The shared workspace collapses its unused board toolbar on phones. SRS no longer
has a 54px empty strip before the coach; game-review navigation and shared desktop
board sizing remain intact.

- Production build and API/TypeScript checks passed.
- Presentation browser tests: **5 passed, 1 expected mobile skip**, including
  matching desktop board geometry and tight SRS spacing at 390px and 375px widths.
- Manually inspected the real SRS page at 390px before and after the fix.
- Windows left the isolated test server running after assertions completed;
  terminating only that fixture process let the test runner exit successfully.

## Selectable coach release: September 27, 2026

All 16 characters are available in Settings and use the shared reaction system
in game review, SRS practice and saved explanations. The studio and production
registry now derive their characters from one catalogue. Existing accounts retain
Storyteller; individual IDs and motion preferences follow the account to another
device. The existing preference table needs no further schema change.

- Full backend suite: **440 passed**, including restart persistence for every
  coach, defaults, account isolation and rejected invalid choices. The two
  existing TestClient dependency deprecation warnings remain.
- Full desktop/mobile browser suite: **115 passed, 3 expected viewport skips**.
  Separate account suite: **2 passed**, including a blonde coach restored on a
  second device and an independent default for another account.
- The browser suite selects every API-allowed coach through Settings and loads
  it into an actual game review. It also checks the collie's SRS reactions,
  failed-save recovery, reduced motion, old bookmarks and studio behavior.
- Production build, generated API consistency, TypeScript contracts, Ruff lint
  and Python formatting passed. Docker install CI now saves a black-cat choice
  and checks it after restart in both local and account modes.
- Manually selected coaches in the application, inspected the collie beside
  a blunder explanation and Show why, and inspected phone-emulated Settings.
  Selection cards reserve their space and only the selected portrait idles.

The shared artwork is bundled with the application; the comparison interface
remains lazy-loaded. No external illustration requests, engine settings, proxy
settings or additional services are required.

## Expanded coach cast: September 27, 2026

The studio now offers 16 concepts: Storyteller plus three new men, four women
including a blonde coach, four cats including a solid-black cat, and two golden
retrievers alongside a corgi and a border collie. Storyteller remains the sole
production selection. Retired variants and their unused artwork were removed.

- Production build, generated API consistency and TypeScript contracts passed.
- Full desktop/mobile browser suite: **111 passed, 3 expected viewport skips**.
  Account suite: **2 passed**. Final beard-outline polish was followed by another
  successful build and **4 passing desktop/mobile human-collection checks**.
- Every concept is checked across all 20 expressions. Each performs brilliant
  and blunder entrances, supports an idle preview, and respects reduced motion.
  Tests also check stable geometry, real portrait widths, unique eye masks,
  cancellation on character switches, old/unknown URL fallbacks, no accidental
  classic-animation bleed into the new men, and no preview preference writes.
- Manually used the actual studio, compared reaction silhouettes, reviewed the
  new expression sheets, and inspected 92.8px/52.5px previews. Refined the collie's
  folded ear, the black cat's lip/eyelid contrast and dark paws, the new beards'
  edges, and comparison-button alignment. Mobile layout was checked in emulation.
- The studio artwork stays lazy-loaded: **15.59 KB JavaScript and 4.08 KB CSS
  gzipped** in the final build. These are asset sizes, not a device benchmark.
- Tail follow-up: the border collie's white tip now covers the gray fur contour,
  ending the line at the color boundary while retaining the original silhouette.
  Production build and both desktop/mobile dog-collection checks passed; the
  boundary was also inspected in the actual studio.

The artwork uses the existing lifecycle and semantic reactions. No backend,
database, account contract, or engine scheduling changes were required.

## Additional coach studies: September 27, 2026

The studio now compares a woman, cat and golden retriever, each with three visual
directions and 20 expressions, alongside the existing coach. Shared human artwork
was extracted first and verified against the original review behavior.

- Production build, generated API consistency and TypeScript contracts passed.
- Full desktop/mobile browser suite: **107 passed, 3 expected viewport skips**;
  separate account suite: **2 passed**. Desktop checks accept browser subpixel
  rounding; animation assertions first bring the portrait onscreen, matching the
  visibility contract.
- New tests cover all nine expression collections, finite reactions, species
  idle gestures, unique eye masks, reduced motion, stable comparison geometry,
  actual review portrait widths, URL restoration and safe character switching.
  Preview navigation performs no API writes and Settings keeps one real choice.
- Inspected each new character's brilliant and blunder comparisons in the actual
  application, expression sheets and the 92.8px/52.5px review previews. Quiet and
  playful studies use different timing tracks and poses. Worried tails now tuck
  toward the hip instead of extending beyond the portrait; cat ear flicks include
  a small, finite whisker movement. Mobile checks use browser emulation.

The additional artwork remains in the lazy studio chunk. Production coach
selection, account data and engine scheduling are unchanged.
The complete studio chunk is 12.31 KB JavaScript and 4.03 KB CSS gzipped, measured
from the production build; this is an asset-size check, not a device benchmark.

## Animated coach: September 27, 2026

Completed after the code-quality audit and deletion of its temporary checklist.
The shared coach now has 20 semantic states and three complete concept families,
with Storyteller used in game review, SRS and saved explanations. Settings owns the
selected coach and motion preference through the existing account database. See
[COACH.md](COACH.md) for the design decisions, lifecycle and extension contract.

Final verification:

- Backend/native/API suite: **424 passed**, with the two existing TestClient
  dependency deprecation warnings.
- Desktop/mobile browser suite: **99 passed, 3 expected viewport-specific skips**;
  separate account suite: **2 passed**. Includes semantic mapping, fallback cycles,
  recovery, replay, offscreen handling, stale engine responses, reduced motion,
  preference load/save failure recovery, LAN reconnection and second-device state.
- Ruff lint and formatting, exported OpenAPI consistency, generated TypeScript,
  contract rejection checks and the production build passed.
- Fresh Alembic upgrade and schema check passed. Migration tests preserve existing
  users and foreign keys; missing preferences read safely without creating rows.
- A Docker image built from the public source archive passed fresh local/account
  installation, native Stockfish game review, health checks and restart. Coach
  preferences persisted in both modes using the existing data volume.
- Manually used the production frontend and native engine with isolated synthetic
  fixtures: game navigation through blunder/checkmate, wrong SRS move, retry,
  successful recovery, explanation playback, Settings save/reload, all three
  concept collections, transition playback and idle previews. Inspected 1366px
  and 1440px desktop views, 390px phone layout, and the actual 92.8px/52.5px
  portrait sizes. Mobile checks use browser emulation, not a physical handset.

The review produced concrete fixes: mobile controls no longer overlap; replay
restarts the SVG even mid-reaction; returning onscreen does not replay an already
seen entrance; known move feedback does not briefly flash a neutral face; terminal
coaching describes the learner's outcome; per-instance eye masks contain glances;
and optional LAN login automatically retries preference loading. Artwork styles
are scoped to their registered coach. Studio panels were separated by purpose,
and no unused/undefined animation tracks or temporary production coaches remain.

Shared board and speech-bubble geometry stayed unchanged. The runtime uses finite
CSS/SVG animations and occasional local timers, with no JavaScript frame loop.
The studio is a separate lazy-loaded chunk (4.42 KB JavaScript and 2.06 KB CSS,
gzipped); production JavaScript grew by approximately 8.1 KB gzipped over the
pre-feature build. This is an asset-size check, not a device performance benchmark.
No blocking finding remains from this feature review.

## Completed code quality audit: September 27, 2026

All ten audit findings are resolved. The final review revisited the first four
fixes as well as the remaining six before removing the temporary checklist.
No blocking finding remains from this review.

1. **Publishing checks:** Docker publication requires the reusable correctness
   workflow for the same commit, including manual releases. Reviewed dependencies,
   checkout SHAs, permissions and immutable image tags; no unchecked release path
   was found.
2. **Shared hosting:** One application and bounded host-wide workers replace
   per-account runtimes. Reviewed account-scoped queries, job ownership, recovery,
   cancellation, pooled session rebinding and shutdown. Regressions cover 250 idle
   accounts, concurrent isolation and shared engine limits.
3. **Review structure:** Session, playback, navigation and engine-request state
   have separate owners; both review screens retain shared presentation. Reviewed
   cleanup and generation checks that prevent late responses from replacing a
   new session or selected move.
4. **API contracts:** Runtime response schemas and generated endpoint-specific
   frontend types replace duplicated payload definitions. Checked export/type
   drift, invalid-call regressions and rejection of malformed responses.
5. **Account CI:** Local and account browser suites are independent required
   matrix jobs, with separate trace directories. Signup, second-device login and
   private-library behavior are covered on desktop and mobile.
6. **CSS ownership:** Shared board/coach/layout rules and feature styles have
   explicit owners; obsolete selectors and repeated overrides were removed.
   Sampled computed styles matched before/after across seven screens and five
   widths; visual inspection and browser geometry/motion checks passed.
7. **Tactical rules:** Named motif rules and classification stages replace the
   oversized methods. Reviewed outcome admission, rule ordering and provenance;
   all 70 complete fixture classifications matched the previous implementation
   in a differential comparison. Pinned upstream code remains unchanged.
8. **Chess helpers:** Legal-move serialization and tactical witness construction
   share their owning modules. Special-move tests preserve castling, promotions,
   en passant and the deliberate SRS/game-over policy distinction.
9. **Archived lessons:** Removed inactive generation/progression and the review
   dependency cycle. Reviewed direct-call guards, historical audit access and
   unchanged archive rows. Three obsolete lesson settings were removed; historical
   models and migrations remain intact.
10. **Diagnostics:** Health reports the last observed engine result, including an
    unchecked state for lazy startup. Reviewed failure/recovery, pooled ownership
    and reference-mismatch handling. Tracebacks remain in server logs while
    unexpected client errors are sanitized; UI retries remain available.

The final pass found a verification gap: the Docker smoke test launched Stockfish
separately without exercising the app's worker. It now imports a synthetic game,
completes a native review through HTTP and checks engine health in both modes.
Testing documentation was also corrected to describe the removed lesson helpers
and the current five navigation destinations.

Final verification of the completed implementation:

- Backend/native/API suite: **419 passed**, with two existing TestClient dependency
  deprecation warnings.
- Desktop/mobile browser suite: **77 passed, 3 expected viewport-specific skips**;
  separate account suite: **2 passed**.
- Production frontend build, API export/generated-type checks, compile-only type
  regressions, repository Ruff lint/format, Actionlint 1.7.12 and Git whitespace
  checks passed.
- A fresh isolated database upgraded to the current Alembic head with no schema
  drift. No schema change was needed for the audit fixes.
- Local image `fieldwork:audit-final` built from the public-source snapshot and
  passed fresh-install, restart, native game-review and engine-health checks in
  both local and account modes. Its disposable containers and data volumes were
  removed afterward.

No active Docker variable was added or changed. Removed legacy lesson settings
are documented in [CONFIGURATION.md](CONFIGURATION.md); old environment entries
are ignored. The engine-health API now distinguishes unchecked availability with
`null`, and the frontend handles that state explicitly.

These results cover the local implementation and configuration review. Live
GitHub Actions execution awaits a requested push. No image was published, no live
database was modified and no Unraid deployment was performed.

## Audit fixes 1, 3 and 4: September 27, 2026

- Docker publishing now depends on the reusable correctness workflow for the same
  commit. Actionlint 1.7.12 passed; live GitHub Actions execution awaits a requested
  push.
- Review session, playback, navigation and analysis state are separated from
  presentation while retaining shared board/coach/layout components. Browser
  regressions cover unchanged geometry, motion, branching and stale responses.
- Active API success responses have runtime schemas; the frontend uses generated
  OpenAPI types and endpoint-specific requests. Export drift, generated-type drift
  and invalid-call type checks passed. A malformed response regression confirms
  server-side validation rejects an incompatible payload.
- Final full backend suite: **411 passed**, with two existing TestClient dependency
  deprecation warnings. Final ordinary browser suite: **75 passed, 3 expected
  viewport skips**. Separate desktop/mobile account suite: **2 passed**.
- Production frontend build, unused TypeScript symbol checks, repository-wide
  Ruff lint/format and Git whitespace checks passed.
- Docker Desktop built `fieldwork:audit-contracts` from the staged public-source
  snapshot. Fresh installs, persisted restarts and native Stockfish passed in
  local and account modes using disposable containers and anonymous data volumes.
  The snapshot avoided a Windows ACL error while Docker walked the ignored
  `.pytest_cache`; Docker's public-file allowlist still applied to the build.

No database schema, container variables or chess/SRS policy changed. No live
database, Unraid deployment or published image was modified. Account browser
checks were still a separate local invocation at this milestone; the completed
audit review above records their subsequent inclusion in CI and the remaining
fixes.

## Game-review UX: September 26, 2026

- Targeted backend/native review suite: **26 passed**, including current-board
  mate, fork, pin and capture cues, rejecting late witness overlays, saved reports,
  manual variations and practice isolation.
- Game-review browser suite: **8 passed** across desktop and phone Chromium.
  Checks stable coach/notation geometry through short and long messages, errors
  and explanations; graph width at 360–1920px; source-game preservation; manual
  branching and queued ratings; and explanation dismissal without a move tree.
- Shared-board regression subset: **8 passed** for promotion/dragging, legal
  capture markers, cold-review explanation playback and focused-practice cues.
- TypeScript/Vite build and targeted Ruff checks pass. Desktop and phone layouts
  were also inspected in the local browser using a disposable synthetic game.
- Existing reviews derive their annotations when read; no migration or bulk
  reanalysis is required. This pass does not publish or deploy the new image.

One initial phone geometry assertion compared viewport coordinates across an
intentional browser scroll; it now compares document coordinates. Sandboxed
Windows runs required stopping their isolated test server after the tests ended;
host-permission runs clean up normally. Existing TestClient and terminal-color
deprecation warnings remain.

## Full-game review: September 25, 2026

- Full backend/native/API suite: **293 passed**, including both-color reports,
  independent practice history, saved review reopening without an engine, cancel/resume,
  setup positions, promotion, en passant, castling, typed mate scores, Great criteria,
  Elo-only Blunder severity, positive fork evidence and a mating queen sacrifice.
- Full Playwright suite: **43 passed, 1 intentional skip** across desktop and phone
  Chromium. Includes coach playback, legal variation branching, undo/return, source
  game preservation, viewport fit and rejection of late analysis responses.
- TypeScript/Vite build and repository-wide Ruff lint/format checks passed.
- Fresh Alembic migration to **04af728d913e** matches SQLAlchemy metadata with no drift.
  The migration adds independent game-review tables; training tables are unchanged.
- The dated recall-restart fixture now starts at the real initialization time used by
  FSRS instead of leaving untouched cards in the future relative to a frozen past clock.

Review rules and conservative evidence limits are documented in [GAME_REVIEW.md](GAME_REVIEW.md).
Tests use isolated databases and synthetic positions. Private games, generated reports,
native engines and test screenshots remain uncommitted. No live database migration,
server restart, public deployment or bulk reanalysis was performed. Start the application
normally to apply the additive migration and use **Games**.

Existing TestClient deprecation and terminal-color warnings remain. Expected provider
error fixtures still log `job_failed`; these are not test failures. The initial browser
run required updating the old four-tab navigation assertion to five. Browser tests run
with host process permissions so Playwright can tear down its isolated Windows server.

## Pinned Lichess integration: September 13, 2026

| Check | Result |
|---|---|
| Upstream predicate/source parity | 19 deterministic tests; every original function AST preserved after removing observers; supporting files/license match original hashes |
| Full frozen upstream output parity | All 12,000 theme sets match unmodified upstream; 17,468 valid witness records |
| Final frozen comparison | 12,000 incidences, zero reconstruction skips; per-theme raw/admitted results and limits in LICHESS_REUSE.md |
| Full backend/native/API suite | **280 passed**, no skips, 26.05 seconds; Stockfish 18 |
| Full Playwright suite | **39 passed, 1 intentional skip**, 49.3 seconds; desktop and phone-emulated Chromium |
| TypeScript / Vite build | Passed, including the local public-source archive |
| Ruff | Repository-wide lint and format checks passed; original vendored source intentionally excluded |
| Fresh and copied Alembic verification | Head f83a90d16c24; no schema drift; all copied rows/schema unchanged across 30 tables |
| SQLite integrity | Both databases ok; zero foreign-key violations |
| Documentation and source ZIP | Local Markdown file links resolve; archive integrity and public-file/license inclusion verified |
| Git whitespace | Passed |

Existing classifier and wrong-label regression assertions were retained. New pin-exploitation cases pass for both colors; a raw double-check observation does not assert a mistake without meaningful engine evidence. No grading, native engine, FSRS or schema logic changed. Two older migration imports were reordered for repository-wide Ruff.

Browser verification caught and fixed a real regression: extra motif buttons could push the return control below a short phone viewport. Return and motif actions now share a compact wrapping row below the board/playback controls, preserving board/header geometry and focused-practice reachability. Existing viewport assertions remain intact. The new download assertion accepts the two platform ZIP MIME types and still checks successful HTTP delivery and ZIP content.

The first browser invocation lacked the installed Chromium path; the final complete run used .tools/playwright through PLAYWRIGHT_BROWSERS_PATH. The source build now selects the checkout virtual environment instead of the broken Windows python alias, with SOURCE_PYTHON override. Two existing TestClient deprecation warnings, terminal-color warnings and expected provider-failure fixture logs remain unsuppressed.

Tests use isolated databases. Migration preservation uses SQLite online backup from a read-only live connection; only the copy was migrated. Source archives exclude private data, secrets and untracked files. No LLM runtime or network dependency was added. Native grading and recall histories remain protected by the full regression suite.

The complete frozen comparison is a partly generator-related compatibility measurement, not independent classifier precision. Remaining gaps and private failure corpora are documented in LICHESS_REUSE.md. Physical-phone and cross-platform install checks remain separate from emulation.

Deployment: restarted the idle LAN backend at 192.168.1.12:8000 after committing the verified code. Health reports Stockfish 18 and classifier 4.0-lichess-8d9faff6. Before/after fingerprints confirm unchanged games, decisions, exercises, accepted answers, review sessions, reviews and SRS states. No bulk reclassification was run; Settings > Classify saved games applies the new version to saved evidence without new engine analysis.

## Lichess benchmark tooling: September 13, 2026

| Check | Result |
|---|---|
| Deterministic benchmark suite | **48 passed**, 0.26 seconds; all optional Zstandard tests ran |
| Full backend/native/API suite | **245 passed**, no skips, 25.28 seconds |
| Ruff lint | Passed for backend and scripts |
| Ruff formatting | Passed for backend, scripts and migrations; 99 files |
| External dataset run | Complete scan of 6,100,952 rows; 1,000 positives per 12 eligible mappings; 12,000 reconstructed incidences, zero skips, 2,260 disagreements |
| Corpus consistency | Counts match metrics; every exported witness move/actor/frame matches solver coordinates; 11,978 unique puzzle IDs |
| Production scope | No changes to trainer runtime, frontend, classifier rules, engine/grading/FSRS, schema, migrations or production dependency locks |

See the [benchmark guide](LICHESS_BENCHMARK.md) and [measured baseline](LICHESS_BENCHMARK_RESULTS.md). The dataset and complete reports/corpora stay under ignored data/lichess-benchmark. The run used Python 3.12, native application tests used the existing Stockfish 18, and the optional offline decoder was zstandard 0.25.0. Benchmark runs themselves use no engine, database, server or network.

Two existing upstream TestClient deprecation warnings remain; neither was suppressed. Fresh workspace basetemp/cache paths avoided Windows shared temporary-directory access problems. Tests and the benchmark did not restart the LAN application or change live data.

This developer-only pass did not rebuild or rerun the unchanged frontend or repeat manual fresh/copied migration verification. Those checks passed immediately before it, as preserved below; migration-related backend regressions still run in the full suite.

These are positive-theme line-detector measurements, not precision from absent tags or full-classifier accuracy. No rule was tuned against benchmark failures.

## Previous pass: interface ownership and documentation

Completed September 13, 2026 for the focused interface refactor and documentation-consistency pass. The repeatable procedure is in [TESTING.md](TESTING.md); previous milestone/deployment results are in [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md).

### Results

| Check | Result |
|---|---|
| Full backend/native/API suite | **197 passed**, no skips, 25.56 seconds |
| Full Playwright suite | **39 passed, 1 intentional skip**, 50.6 seconds; desktop and phone-emulated Chromium |
| TypeScript / Vite production build | Passed; final type-only correction produced the same runtime bundle |
| Ruff lint | Passed for backend and scripts |
| Ruff formatting | Passed for backend, scripts and migrations; 86 files |
| Fresh Alembic chain | Upgrade to f83a90d16c24 passed |
| Alembic schema drift | No new operations for fresh and copied databases |
| Copied-data preservation | All rows and schema unchanged across 30 tables, including alembic_version |
| SQLite validation | Integrity ok and zero foreign-key violations on fresh and copied databases |
| Documentation | Local files/headings resolve; complete original roadmap journal and course design preserved |
| Git whitespace | Passed |

The browser skip is the desktop instance of a test specifically for short phone viewports; that test passes in the mobile project. No test was weakened or removed.

Backend verification used fresh basetemp/cache_dir paths under ignored data to avoid Windows shared temporary-directory permissions. Native tests used Stockfish 18. The environment was Windows, Python 3.12 and Node 24.19; dependencies remain pinned by requirements.lock and frontend/package-lock.json.

Two existing upstream TestClient warnings remain: Starlette's httpx integration deprecation and AnyIO's BlockingPortal alias deprecation. Browser runner output also includes the existing terminal-color environment warning and expected job-failure logs from provider-error fixtures. These did not cause failures.

### Behavior preservation

The recorded pre-refactor OpenAPI contract covers 24 documented API paths, their methods, operation IDs, validation schemas and responses. A new regression compares that contract, and another verifies independent resources/access controls for two application instances.

All 34 original endpoint/helper/lifespan bodies matched by Python AST after extraction. All nine original frontend component/helper bodies retained compiled equivalence; the comparison joined adjacent React text children introduced by formatting. Existing browser regressions verify board identity, timing, geometry, focus, failure/reveal and persistence.

The refactor changes interface ownership only. Classifier, Stockfish, grading, FSRS, schemas and migrations are unchanged. The complete backend suite includes the native import-analysis-classification-exercise-review-restart flow and historical compatibility tests.

### Data and deployment scope

Migration validation used SQLite's online backup API to obtain a consistent copy, opening the live source read-only. Only fresh/copied databases were migrated; private verification artifacts stay under ignored data/code-health-20260913. Browser and API tests used isolated fixtures and did not submit reviews or analysis jobs to live data.

The production frontend was rebuilt. The running LAN backend was not restarted as part of this maintenance pass; it will load the extracted routers on its next normal restart. Binding and host configuration were unchanged.

Six current public screenshots were refreshed from inspected Playwright fixture captures; older images are explicitly historical in [screenshots/README.md](screenshots/README.md).

### Limits and deferred code health

- Review.tsx still contains a substantial related state/timer flow. A state-machine rewrite would require a separate interaction-focused task.
- Older frontend API payloads still include loose types and the generic client's any default. This pass typed the newly separated health/settings/import boundaries without introducing generated contracts.
- Some HTTP/domain queries still repeat lookups. Query optimization was left unchanged.
- curriculum.py still combines live weakness priorities with archived course helpers. Splitting domain responsibilities is outside this interface-only pass.
- Dependency upgrades to resolve upstream warnings, standalone wheel/static packaging, manual Linux/macOS installation and physical-phone LAN checks remain separate work.

Passing suites do not establish independent classifier accuracy or long-term chess improvement. No classifier rules or quality measurements were changed; see [CLASSIFICATION_ASSESSMENT.md](CLASSIFICATION_ASSESSMENT.md) for the existing assessment and its limits.
# Shared hosting verification — September 26, 2026

- Full backend suite: 298 passed; subsequent populated-database ownership migration
  test passed as part of the four-test account suite (299 backend tests now present).
- Ruff lint and format checks passed. TypeScript/Vite production build passed.
- Existing Playwright suite: 43 passed, one intentional desktop skip. Additional
  account suite: two passed, covering desktop and mobile and a second device.
- Docker image built from a public-source export because a local Windows cache ACL
  prevented Docker's context walker from reading the original checkout. Compose
  configuration validated with a placeholder public origin.
- Running non-root Linux image used native Stockfish 17.1. Synthetic smoke checks
  verified source download, signup, private libraries, fetch-only PGN imports,
  completed whole-game review, selected-game training, retained session/review
  after container restart, healthy container status, and a consistent SQLite
  backup restored with both accounts and foreign-key-safe application data.
- Tests used temporary databases/containers only. The user's real database has not
  been migrated and the Unraid deployment/proxy have not been changed.

## Game-review UX verification - September 26, 2026

- TypeScript/Vite production build passed.
- Full browser suite: 45 passed, one intentional desktop skip. After final
  presentation refinements, all six review-specific desktop/mobile tests passed.
- Browser checks cover 1366x768 board/timeline fit, visible move-quality markers,
  actual 280 ms piece transitions, reduced-motion feedback, short previews from
  deliberately long engine output, exact return anchors, nested variations,
  asynchronous ratings for rapid moves even after returning to the game,
  stale-response isolation, retryable engine errors and unchanged saved games.
- Desktop and phone screenshots were visually inspected. Shared-board training,
  legal moves, promotions and dragging passed the full browser suite.
- No engine classification policy, database schema or hosting configuration changed.

## PGN ratings and completed-review controls

- All 20 backend game-review tests passed, including distinct PGN ratings for
  White/Black in saved reports and interactive variations, plus invalid/missing
  Elo handling without borrowing the opponent's rating.
- All six desktop/mobile review browser tests passed; completed reviews have
  neither a Game report heading nor an Update labels action.
- Production build, targeted Ruff checks and git diff whitespace checks passed.

## Board-first desktop layout

Production build and all six review browser tests passed. At 1366x768 the board
is over 580px square, begins within 110px of the screen top, and its controls fit
in the viewport. Widening to 1600px grows the sidebar while preserving board size;
increasing height to 900px grows the board. The evaluation chart remains available
in the right panel. Desktop screenshot inspected; mobile review tests also pass.

## Browser navigation - September 26, 2026

- TypeScript/Vite production build passed.
- Full Chromium desktop/phone UI suite: 56 passed, two intentional device-specific
  skips. Account suite: two passed, including login directly into a bookmarked
  game/move and rejecting that same game URL for a different account.
- Checks cover Back/Forward through screens and game reviews, refresh/direct
  paths, modifier-click opening a separate tab, active-link history deduplication,
  selected-move restoration without per-move history entries, paginated library
  scroll restoration, invalid/missing links, legacy exercise/unit links and
  focused-practice history. Existing training and game-review interactions pass.
- Desktop review and phone library screenshots were visually inspected. The
  shared compact header and board layout remain intact.
- Tests used isolated fixture databases. No database schema, engine policy,
  reverse-proxy configuration or running Unraid deployment changed.

## Automatic game reviews and faster progress - September 26, 2026

Opening a game now starts or resumes its review once. Completed reports are reused;
pause remains paused while the game stays open, and failures expose an explicit
retry. Parallel move searches keep full repetition history and commit in game order
so Great-move comparisons retain the preceding score. Progress returns only new
display reports, and mainline browsing avoids duplicate interactive searches while
the review runs. Manually played variations still receive analysis.

A local native-Stockfish benchmark used a synthetic 24-ply Ruy Lopez game, a fresh
empty database for each run, depth 16, a 0.8-second search cap, one engine thread,
64 MB hash per engine and no node cap:

| Review implementation | Workers | Elapsed time |
| --- | --- | --- |
| Previous sequential loop | 4 configured, 1 used | 10.000 s |
| Bounded parallel implementation | 1 | 10.077 s |
| Bounded parallel implementation | 4 | 3.435 s |

The four-worker run was about 2.9 times faster in this single local benchmark;
this is not a universal latency guarantee. Per-position search limits and move
classification rules are unchanged. The default remains one worker; parallel
speedups require increasing `STOCKFISH_WORKERS` within the available engine budget.

The full game response was 299,991 bytes. Incremental progress with two new move
reports was 1,982 bytes, and a no-change response was 145 bytes. Polling is single
flight, waits 750 ms between responses, and advances its cursor by reports received
even if the job's completed count races ahead. Tests and benchmarks use isolated
databases; no schema migration or running Unraid deployment was changed.

- Full backend suite: 329 passed, including native one/three-worker reviews,
  pause/resume, out-of-order search completion, engine-budget enforcement,
  preserved repetition history, worker-failure cleanup, incremental reports and
  account isolation. The API snapshot includes the new progress route and optional
  fallback rating; no other contract changes were present.
- Full desktop/phone browser suite: 60 passed, two intentional device-specific
  skips. Separate account suite: two passed. New checks cover automatic startup,
  retry, pause/reopen, completed reuse, incremental ratings without board reloads,
  a racing progress count and avoiding duplicate original-position searches.
- TypeScript/Vite production build, targeted Ruff lint/format checks, Unraid XML
  parsing and Git whitespace checks passed.
