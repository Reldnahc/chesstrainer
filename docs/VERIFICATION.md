# Verification status

The repeatable procedure is in [TESTING.md](TESTING.md). This file retains the
latest complete verification and subsequent focused checks. Earlier dated passes
remain in Git history with their original scope, results and limitations.

## Nonhuman speaking rigs and voice auditions — October 1, 2026

All twenty nonhuman coaches now implement the shared nine speech shapes, with
species-owned placement, proportions, palette and mouth details. Walter retains
his dedicated rig. The remaining human rigs are unchanged. Coach Studio's Mouth
shapes view holds every shape with representative sounds at ordinary or enlarged
size and embeds the same recorded audition player used by Audio Studio.

Sixteen approved coaches have three independently prompted custom voice auditions
each: **48 unchanged recordings**, approximately 8–12 seconds (9.9s average).
The batch used **6,372 provider credits**, observed as usage 3,530 to 9,902.
Ziggy, Percy, Pip and Button have completed mouths and preserved casting briefs,
but their twelve paid auditions remain deferred: automatic approval review
considered those four outside the explicitly authorized animal/fantasy scope.
No saved production voices or account selections were changed.

- `node --test scripts/design_coach_voices.test.mjs scripts/record_coach_speech.test.mjs`:
  **53 passed**, including bounded paid requests, durable attempt handling,
  script/seed agreement, response validation, cached resume, no overwrites and
  the active/deferred distinction. No provider calls in tests.
- `node scripts/design_coach_voices.mjs --check` and
  `.venv/Scripts/python.exe -B -S scripts/prepare_cast_voice_auditions.py --check`:
  **all 48 verified**. Native automatic alignment produced 1,364 word segments,
  4,365 phones and 3,537 mouth cues. Compact tracks are 156 KB; full provenance
  archives are 1.26 MB. No hand timing or provider audio edits.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_cast_voice_auditions.py -q`:
  **58 passed**. Scoped Ruff lint/format checks passed. The strict cached check
  needs only the Python standard library; native authoring packages stay ignored.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_ci_plan.py -q`:
  **336 passed**. Cast-only changes select the frontend/audio/coach consumers
  and offline authoring checks; they do not trigger unrelated backend or Docker
  work. The production import guard rejects direct and lazy development assets.
- `npm --prefix frontend run build`: passed generated API agreement, all
  TypeScript checks, **24 style/boundary tests**, four real dependency guards and
  production build. `npm --prefix frontend run build:audio-studio` and standalone
  `node node_modules/vite/bin/vite.js build --config vite.coach.config.ts --outDir ../node_modules/.cache/cast-coach-build`
  (from `frontend`) passed. Existing large-chunk advisories remain.
- Focused shared audition/Walter browser tests: **52 passed**, desktop/mobile.
  Actual native audio decoding, selected-clip cue timing, visible mouth layers,
  direction changes, Still and device reduction, common player cancellation,
  development-only requests and 320px layout all passed.
- Full audio regression run from `frontend`, with
  `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`:
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --output node_modules/.cache/cast-final-audio --reporter=line`:
  **386 passed, no skips** in 5.1 minutes. This includes all twenty speaking rigs,
  static preview lifecycle, real recordings, production Walter speech selectors,
  Still/reduced-motion/hidden behavior, authored-face restoration and existing
  sound effects. The ignored config reuses the already-running local studio.
- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `npx playwright test --config node_modules/.cache/speech-coach-check.config.mjs speech-inspector.spec.ts`:
  **20 passed**, desktop/mobile. Held shapes have no running animation; authored
  fallback, sizing, reload and view switching passed. Shared volume/mute persist
  across coach changes. Switching coaches or leaving the inspector cancels
  pending bytes, pending native decode and active playback; cancelled clips do
  not start late, and a fresh explicit audition still works.
- Independent visual review covered all twenty rigs at **92.8px and 52.5px**,
  including authored fallback, O/oo readability, clipped teeth/tongue/fangs and
  preserved expression/idle wrappers. Live browser inspection exercised Fergus,
  Rivet, static shapes and real audition playback. Desktop/mobile screenshots
  were inspected. Listening quality remains an owner casting choice, not a claim
  made by provenance or timing tests.

The new auditions and inspector are development-only. LAN entrypoints are
`npm --prefix frontend run dev:audio:lan` (5176) and
`npm --prefix frontend run dev:coach:lan` (5174). This second phase did not rerun
the full backend/account suites, publish its local commits or update Unraid.

## Walter's completed recorded voice — October 1, 2026

Walter has 181 non-lesson recordings with generated, source-verified mouth tracks.
The 173 new clips used 1,948 provider credits, reconciled against every request ID.
Selectors consume supported rendered claims or authorized structured practice
facts. Automatic, On request and Off are account preferences; initial/restored
positions stay quiet and cold recall cannot reveal answers. Explicit replay can
interrupt another voice without interrupting board sounds. Lessons and the other
coaches remain text only at this checkpoint.

Published as `6b1c31711a2a7eb17da5a7b1ad495b9c7765e577`. Main
[CI run 36830904338](https://github.com/Reldnahc/chesstrainer/actions/runs/36830904338)
passed, including container publication, before the paid cast auditions began.

- `.venv/Scripts/python.exe -m pytest -q --durations=20 --basetemp data/verification/voice-bank-backend-20261001 -o cache_dir=data/verification/voice-bank-pytest-cache-20261001`:
  **1669 passed, 3 skipped**. Stockfish coverage ran. The three native Maia tests
  require optional pinned checkpoints/Torch; they were not claimed as passed.
  The subsequent reply-caption/API addition passed its **13 focused tests**.
- `python -B -S scripts/prepare_coach_voice_bank.py --check`: **181 verified**,
  no missing tracks; native generation was repeated for three representative
  clips with identical complete evidence. Alignment/pronunciation/bank tests:
  **304 passed**. Recorder Node tests: **14 passed**.
- Ruff checks/formatting, generated API agreement, fresh Alembic upgrade/check
  through `93a425f18cb6`, SQLite integrity and foreign-key checks: passed.
- `npm --prefix frontend run build`: passed API/types, **11 style guards**, all
  development style boundaries and production build. Audio-studio build passed.
  Existing Vite chunk-size advisory remains. Mouth tracks load separately;
  authoring models and alignment archives are not runtime downloads.
- From `frontend`, `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --output node_modules/.cache/walter-final-audio --reporter=line`:
  **326 passed**, desktop/mobile, including actual MP3 decoding, voice lifecycle,
  all bank assets, selection guards, global portrait observation with scoped
  controls, interruption, still/hidden behavior and rounded O/oo mouth geometry.
  The ignored config reuses the existing audio studio; no product flags change.
- Production game voice/navigation: **26 passed**, then the eight voice cases
  passed again after the final readiness correction. Production practice voice:
  **10 passed** (SRS counterreply/accepted feedback, cold/reload silence,
  explanation controls, opening recall, puzzle reveal/retry and late responses).
  Pure practice selectors: **10 passed**. Dedicated account suite: **8 passed**,
  including voice choice across devices/reload and other-account isolation.
  These runs used normal configs with separately managed fixture servers to
  avoid Windows Playwright-owned server teardown hanging after test completion.
- Existing main CI failures were reproduced and corrected: a real 320px toolbar
  overlap, stale Sound navigation/SRS mute assertions, and an import click during
  form expansion. Focused checks: **18 passed, 2 intentional viewport skips**;
  patched import interaction: **24 repeated passes**. The fresh focused wrapper
  itself timed out during Windows server cleanup; its verified disposable server
  was stopped. The repeated run exited successfully. CI selector tests:
  **346 passed**, including backend validation for speech assets and Python
  dependencies for audio fixtures.
- Live audio studio inspection verified complete-bank selection and playback.
  Mouth shapes were inspected at normal and small portrait sizes. Independent
  reviews found no unresolved scoped code issues. Timing/provenance checks do
  not establish perceptual accuracy of every phoneme in every recording.

## Paired coach hand orientation — October 1, 2026

Confirmed duplicated same-side hand outlines in the human, sci-fi, wizard and
animal rigs. Corrected local hand reflections, including finger/claw details;
arm paths, pose coordinates, animation wrappers and timing are unchanged.
Symmetric pet paws and hooves remain unchanged.

- `npm --prefix frontend run build`: passed API agreement, application/browser
  TypeScript, 11 style guards, three style boundaries and production build.
  Existing Vite chunk-size advisory remains.
- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`:
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/speech-coach-check.config.mjs idle-rig.spec.ts --output node_modules/.cache/hand-rig-results --reporter=line`:
  **4 passed**, desktop/mobile. Mounted rig capabilities remain intact.
- Same runner/config with `handedness.spec.ts --output node_modules/.cache/handedness-results --reporter=line`:
  **2 passed**, desktop/mobile. Checks 19 registered coaches × 20 expressions,
  opposite local orientation, reflected details and preserved wrist attachments
  in Still, reaction and idle CSS poses. Browser-test TypeScript also passed.
  The ignored config only reuses the existing development studio on port 5174.
- Live studio inspection covered the human raised hands, women's book poses,
  Walter's settled thinking pose, Orin's cheek pose, Fergus and Ziggy's raised
  hands. Independent code review found no remaining asymmetric hand primitive
  missing its opposite-side reflection. `git diff --check` passed.

Focused artwork verification only; no backend/account or full idle-matrix run.

## Generator-first Walter lip-sync refinement — October 1, 2026

The owner redirected polish toward automatic generation. Both comparison portraits
now use identical existing artwork and playback; the first Rhubarb cues remain
unchanged on the left, and public-API script/phoneme alignment drives the right.
No per-clip timing edits, new recordings, paid calls or production narration.

- Native PocketSphinx 5.1.1 generation produced **65 cues / 8.24s** and **55 cues /
  6.72s** from the two original recordings. Word/phone intervals, shared mapping,
  model/config fingerprints and source hashes are retained with the output.
  Repeating native generation produced byte-identical complete JSON files.
- Independent source audit found that the new phone evidence preserves P closures
  in "up" and "accepted", V/W distinctions in "even when", and the long sentence
  pause in Sound sacrifice that the first generator reopened early. Exact word
  order is enforced by alignment; that alone does not prove phonetic accuracy.
- `.venv/Scripts/python.exe -S scripts/align_coach_speech.py --check`: passed for
  both generators with the standard library only, including rederivation of
  revised mouth cues from stored phone evidence.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_speech_alignment.py backend/tests/test_speech_forced_alignment.py -q`:
  **211 passed**. Scoped Ruff check and format check passed for the two authoring
  scripts and two test files. Review caught and fixed the missing English G phone;
  a regression now covers the complete 39-phone CMU inventory plus silence.
- `npm --prefix frontend run build`: passed API/type agreement, application and
  browser-test TypeScript, 11 style guards, all three development style boundaries
  and production build. `build:audio-studio` also passed. Existing Vite chunk-size
  advisory remains; generated alignment data is absent from production JS.
- From `frontend`, `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs lip-sync.spec.ts speech-animation.spec.ts speech-lifecycle.spec.ts walter.spec.ts --output node_modules/.cache/generator-polish-results --reporter=line`:
  **84 passed**, desktop/mobile. Verifies one shared recording, matching visual
  settings, distinct generated tracks, motion policy, interruption/cleanup and
  the unchanged ordinary voice audition. The ignored config reuses the LAN studio.
- Manual preview: both clips inspected on desktop and at 390px phone width.
  Both portraits stay visible together; the same-art comparison is ready in
  **Compare lip sync**. Git diff confirms the existing coach rig, speech hook,
  original Rhubarb files and original MP3s are untouched.

Recognition models remain optional offline authoring tools, outside Git and
Docker. No full backend/account/coach matrix run for this development-only pass.
Leading quiet and dictionary pronunciation choices remain limitations to judge
in the preview; this is not an assertion of perfect alignment.

## Automatic Walter lip-sync comparison — October 1, 2026

The development audio studio now compares energy-driven articulation against
unchanged Rhubarb-generated mouth cues for two existing recordings. Both portraits
share one native audio source and its absolute clock. No new recordings, provider
requests or production automatic narration were introduced.

- `.venv/Scripts/python.exe scripts/align_coach_speech.py --generate`: native pinned
  Rhubarb 1.14.0 produced 47 cues / 8.24s for Sound sacrifice and 46 / 6.72s for
  Allowed checkmate. A repeat generation produced identical cue hashes. Original
  MP3s and script text are unchanged; no cue boundaries were manually edited.
- `.venv/Scripts/python.exe -S scripts/align_coach_speech.py --check`: passed,
  using only the standard library, with no native tool/model invocation.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_speech_alignment.py -q`:
  **98 passed**. Ruff check and format check on the script and this test passed.
- `npm --prefix frontend run build`: passed API/type agreement, application and
  browser-test TypeScript, 11 style-guard tests, all three development style
  boundaries and production build. Existing Vite large-chunk advisory remains.
- `npm --prefix frontend run build:audio-studio`: passed.
- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **194 passed**, desktop/mobile audio suite. The ignored wrapper reuses the
  already-running LAN studio and normal audio test/output directories.
- Separate `lip-sync.spec.ts` under that configuration, with output isolated under
  `node_modules/.cache/lip-sync-results`: **18 passed**, desktop/mobile. Added
  after full-suite discovery; covers both native recordings, single-source
  playback, semantic cue parsing, artwork visibility, natural end, interruption,
  motion and phone geometry. A subsequent rendered aperture-order regression
  (`--grep 'rendered vowel and tongue'`) passed **2/2** after review corrected
  rounded and tongue shapes. All twenty new checks passed; they are not part of
  the 194 count above.
- Manual LAN preview: both examples inspected at desktop and 390px phone sizes.
  The two portraits remain side by side without overflow; Stop and motion retain
  the shared policy. Playback has no runtime recognizer/API dependency. Bundle
  inspection confirmed no cue provenance or audition imports in production JS.

This establishes a reproducible comparison, not perfect recognition or approval
for the full library. No full backend/account/coach matrix was run for this
development preview. Native recognition dependencies remain optional and ignored.

## Walter speaking articulation — October 1, 2026

The shared audio engine now publishes optional source-clock speech activity;
the shared portrait samples it only when its rig, identity, visibility and motion
policy permit animation. Walter's mouth/jaw follow existing recordings while
preserving expressions and independent idles. Other rigs remain unchanged.
No recordings were generated, and no production automatic speech was enabled.

- `npm --prefix frontend run build`: passed API/type agreement, application and
  browser-test TypeScript, 11 style-guard tests, all three style boundaries and
  production build. Existing Vite large-chunk advisory remains.
- `npm --prefix frontend run build:audio-studio`: passed; same chunk advisory.
- `npm --prefix frontend run test:types`: passed again after lifecycle coverage.
- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`:
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **184 passed**, desktop/mobile audio suite including native waveform animation,
  silence, motion, interruption, offscreen resume, provenance and existing sounds.
  The ignored wrapper only reuses the owner's already-running LAN studio and
  resolves the normal audio test/output directories.
- Separate `speech-lifecycle.spec.ts` under the same audio configuration, with
  isolated output: **10 passed**, desktop/mobile. Controlled real-component
  tests verify unsupported/mismatched coaches, coach changes, replacement,
  unmount, paused samples, and Still/Animated sampling. Added after full-suite
  discovery; the 184 count above does not include these ten checks.
- `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/speech-coach-check.config.mjs resting-faces.spec.ts idle-cadence.spec.ts idle-rig.spec.ts idle-articulation.spec.ts --reporter=line`:
  **86 passed**, desktop/mobile shared coach lifecycle, idle scheduling and actual
  artwork/track compatibility. The ignored configuration reuses the existing
  coach studio; no server or production configuration was changed.
- `node node_modules/@playwright/test/cli.js test game-audio.spec.ts game-audio-browser.spec.ts audio-study.spec.ts audio-preferences.spec.ts coach-logic.spec.ts --reporter=line`:
  **60 passed**, desktop/mobile production-build application audio and reaction
  regressions. Windows left the temporary backend tree alive during teardown
  after both browser workers exited; stopping that verified test-only tree let
  the runner report success (exit 0). The owner's studio servers stayed running.
- Manual LAN studio inspection: real examples played with Walter at existing
  desktop and 390px phone portrait sizes; positive and concerned expressions,
  mouth/jaw motion, In context, Still and Stop controls checked. Screenshot
  artifacts also captured by native-recording browser tests. This is energy-driven
  articulation, not phoneme recognition or forced alignment.

No backend/schema changes; full backend, account and complete coach-studio suites
were not run for this focused feature. No provider requests or paid generation
are part of these checks.

## Lesson speech deferral — September 30, 2026

Owner deferred all lesson narration for maintainability. Removed 334 lesson
scripts, four lesson aliases and the course-specific reveal alternatives/coverage
from the active voice plan; the preceding audit remains historical evidence.
Recomputed and independently checked **185** unique scripts / 17,096 characters /
2,913 words, or **181** / 16,936 / 2,888 with four transient/defensive entries silent.
The eight recorded audition texts still match active IDs, leaving **173** practical
recordings unrecorded. All 12 remaining aliases resolve and all text hashes match.
JSON/count consistency and `git diff --check` passed. Documentation-only scope
change: no audio generation, application behavior changes or full suites run.

## Whole-app Walter dialogue inventory — September 30, 2026

Planning audit at `855fbc5`, extending the prior game-only inventory. The durable
`walter-full-dialogue-inventory.json` retains **519** distinct proposed scripts,
source/trigger references, course revisions, reuse mappings, legal frame fixtures
and exclusions. Full draft: **53,645 characters / 9,265 words**. Three transient
states and one defensive fallback are recommended silent: **515** remaining
scripts / 53,485 characters. This is finite semantic-summary coverage plus current
authored lessons, not verbatim coverage of unrestricted runtime/user prose.

- `.venv/Scripts/python.exe .tools/walter_all_lessons_inventory.py`: passed
  production course validation/player transitions/presentation enumeration and
  independent field/SAN checks. **3 courses / 11 chapters / 159 steps**; 338 authored
  fields became 326 exact texts. Current lessons alone have 379 literal texts
  including seven fixed messages and 46 SAN reveals; one proposed reveal summary
  instead of 46 recordings yields the 334-entry lesson contribution.
- `.venv/Scripts/python.exe .tools/build-walter-all-srs-inventory.py`: passed
  **19 legal non-start frame combinations** using python-chess; original-position
  frame is counted separately. **79 meanings / 11 game reuses / 68 additions**;
  tactical source branches, summary paths, 13 reachable teaching cues and notes
  were source-audited. No Stockfish, model, private database or provider calls.
- `node .tools/verify-walter-inventory.cjs`: prior game-bank reconciliation and
  **26 synthetic production-renderer probes** still pass. This is not an engine
  quality test or proof of every planned speech-selection path.
- `node .tools/build-walter-full-inventory.mjs`: all IDs, text uniqueness, hashes,
  reused texts and recorder per-script bounds passed. **580 source rows − 16
  cross-surface duplicate rows − 46 SAN variants + 1 summary = 519**. The manifest
  retains all 46 excluded exact SAN variants and 16 aliases. The eight new voice
  auditions are a subset, leaving 511 unrecorded; they are not counted twice.
- Independent cross-surface review confirmed count arithmetic and corrected four
  proposed tactical/frame wordings (pin capture, deflection causality, double check
  that can also be mate, and discovered check after promotion). A final consolidation
  pass distinguishes included lessons/deferred statuses from actual exclusions.
  Audit builders are ignored local working tools; the durable manifest and source
  identities preserve the plan. No broader recording generation, production speech
  implementation or full application suites were performed for this planning unit.

## Selected Walter contrasting audition — September 30, 2026

Saved the owner-selected Older teacher refinement as a separate permanent voice,
preserving Custom 1. Generated exactly eight short v4 TTS examples from the draft
game inventory: 830 input characters, 853,821 bytes, one take each. The studio
defaults to these examples and retains earlier comparisons. No production speech
integration, engine change or automatic generation was added.

- Recorder dry run before generation: eight new requests / 830 characters.
  After generation: zero requests / eight hash-verified existing recordings.
- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`:
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs walter.spec.ts --reporter=line`
  passed **34 desktop/mobile checks**, including all 26 exposed recordings,
  native audio starts, cancellation, preference isolation and layout. A focused
  layout rerun after a description correction passed **2/2**.
- Same command with `recording-provenance.spec.ts`: **14/14 passed**, including
  the new selected-voice identity, eight exact inventory texts, immutable asset
  hashes and the offline mocked recording-author safeguards. The ignored wrapper
  inherits `playwright.audio.config.ts` and reuses the running studio server.
- `npm.cmd run test:types`: passed. `npm.cmd run build:audio-studio`: passed,
  with the existing development-studio chunk-size warning. `git diff --check`:
  passed. Full application/backend/coach suites were not run for this isolated
  audition-data change.
- Used the actual LAN studio in the in-app browser: selected contrasting
  examples and exercised Play voice/In context. The studio remains available at
  its existing LAN address. Playback checks are not a subjective voice-quality
  verdict; the owner evaluates the eight performances by listening.

## Walter dialogue scope audit — September 30, 2026

Planning-only audit at `839da3e`; no production behavior or recording changed.
Traced all 64 template keys through production adapters/rendering, tactical and
positional producers, human facts and game relationships. The draft inventory
maps 52 structured game claim codes to 92 whole summary scripts: 71 primary-capable
and 21 secondary-only. All 12 excluded template codes and non-game coach surfaces
have explicit dispositions. Older teacher is recorded as the owner's voice choice;
it has not yet been saved as a refined permanent voice.

- `node .tools/build-walter-dialogue-inventory.mjs`: produced the draft inventory
  from the source-audit working notes; reconciled unique IDs, counts and all 64
  template keys. Primary text totals 1,227 words / 7,182 characters; all text totals
  1,619 words / 9,522 characters. This is not a provider charge/duration estimate.
- `node .tools/verify-walter-inventory.cjs`: passed inventory coverage/format/count
  checks and **26 synthetic production-function probes** using `gameIntent`,
  `renderDialogue` and Walter's real personality. Twelve actual positional cases
  can lead, twelve alternatives remain below an objective-loss claim while
  preserving conditional rendering, and two back-rank cases remain below mate
  claims. The ignored probe is bundled from `.tools/verify-walter-inventory-entry.ts`
  with the installed esbuild. It does not establish chess legality or end-to-end
  reachability for every inventory row; those classifications are source-audited.
- Independent source reviews covered tactical, positional and other claim
  producers, plus the renderer/entry-point partition and all 92 draft strings.
  Review corrected overly broad deflection wording for promotion witnesses and
  scoped family-specific evidence guards explicitly. Whitespace checks pass.
  No provider calls, saved-voice changes, generated audio, application changes,
  browser/full suites, deployment or push were performed for this planning task.

## Combined older teacher Walter audition — September 30, 2026

One authorized remix of saved Custom 1 combines the elder and teacher directions
using the same 141-character script. The retained first preview lasts **9.09
seconds**, is **145,494 bytes**, and used **141 credits** after the usage meter
settled. The provider returned three candidates; the new manifest accurately
records that count while retaining one. The studio now shows one representative
per custom prompt, defaults to Older teacher, and preserves earlier assets and
provenance. No padding, audio editing or permanent voice replacement occurred.

- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs walter.spec.ts recording-provenance.spec.ts --reporter=line`:
  **46 passed**, desktop/mobile, no skips. All 18 exposed clips play; selection,
  cancellation, context ordering, responsive controls, source/script/hash
  correspondence and truthful provider metadata remain covered. The ignored
  wrapper only reuses the running studio.
- `npm.cmd --prefix frontend run test:types` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed. The studio build
  retains all 28 MP3s, including archived alternatives; the existing large-chunk
  warning remains non-blocking.
- Inspected the actual LAN studio and desktop/mobile screenshots. Independent
  read-only data/provenance review found no actionable issues. No full repository
  suite, production build, deployment, push or remote CI run for this focused
  audition update. Voice quality remains the owner's listening decision.

## Teacher and elder Walter auditions — September 30, 2026

Two authorized remixes of saved Custom 1 returned six previews with a shared
141-character, self-contained teaching script. The raw files total **900,132
bytes**, last **8.99–9.72 seconds**, and used **282 credits**. Teacher & elder is
the default audition collection; prior recordings remain available. The owner
explicitly declined padding: files are unchanged, without fades, re-encoding,
trimming or playback timing changes.

- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs walter.spec.ts recording-provenance.spec.ts --reporter=line`:
  **44 passed**, desktop/mobile, no skips. All 27 clips decode and start locally;
  source/script/hash correspondence, truthful model attribution, cancellation,
  context ordering and responsive controls remain covered.
- `npm.cmd --prefix frontend run test:types` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed. The studio build
  contains 27 MP3s; its existing large-chunk warning remains non-blocking.
- Read-only tail inspection found approximately 8–115 ms below -40 dBFS at the
  end of the original six refinements, and 1–59 ms in the new clips. The focused
  `.tools/walter-runtime-endings.cjs` browser probe confirmed all original six
  completed their full decoded durations with zero stop calls or cancellations.
  This does not establish whether individual syllables sound complete.
- Inspected the actual LAN studio and desktop/mobile screenshots; independent
  data/provenance review and whitespace checks passed. No full repository suite,
  production build, deployment, push or remote CI run for this audition-only
  addition. Final delivery quality remains the owner's listening decision.

## Short Walter refinements — September 30, 2026

Two authorized remix requests use the saved Custom 1 voice and the same
140-character script. Each returned three previews (8.36–8.68 seconds); the six
unchanged files total **817,794 bytes**. Measured usage increased **280 credits**.
The source voice, original previews and production narration policy are unchanged.
The existing studio/player now defaults to Walter refinements, retaining both
earlier collections. Model attribution is explicitly provider-selected because
the remix response does not identify its model.

- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs walter.spec.ts recording-provenance.spec.ts --reporter=line`:
  **42 passed**, desktop/mobile, no skips. The ignored wrapper only reuses the
  existing studio. All 21 clips decode/start with finite durations and nonzero
  signal. Source/hash/script checks, cancellation, valid collection choices,
  local-only playback and responsive transcript coverage pass.
- `npm.cmd --prefix frontend run test:types`,
  `npm.cmd --prefix frontend run build`, and
  `npm.cmd --prefix frontend run build:audio-studio`: passed. API/types and **11**
  style tests pass. Production assets have no audition MP3s; the studio contains
  21. Existing chunk-size warnings remain non-blocking.
- Exercised Warmer 1 in the actual studio, inspected desktop/mobile screenshots,
  and completed independent source/provenance review without actionable findings.
  Whitespace checks pass. Voice quality and the chosen refinement remain the
  owner's listening decision. No full repository suite, deployment or push.

## Original Walter Voice Design audition — September 30, 2026

One authorized text-only design request returned three original voice previews.
The provider usage counter increased by **571 credits** after settling, matching
the shared 571-character script. No reference audio, permanent voice creation or
additional TTS request was used. Three unchanged MP3s total **1,965,378 bytes**;
their request, model, preview IDs and hashes are retained in the source manifest.
The Custom Walter collection is the studio default; the original 12 recordings
remain available for comparison through the same cancellable player.

- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs walter.spec.ts recording-provenance.spec.ts --reporter=line`:
  **40 passed**, desktop/mobile, no skips. The existing ignored wrapper reuses
  the running studio. All 15 recordings decode and start with finite duration
  and nonzero signal. Tests cover source/model labels, transcript correspondence,
  collection changes during loading/playback, valid selection resets, transcript
  scrolling, silence policies and original/new asset provenance.
- `npm.cmd --prefix frontend run test:types`,
  `npm.cmd --prefix frontend run build`, and
  `npm.cmd --prefix frontend run build:audio-studio`: passed. The production build
  includes API/type checks and **11** style tests. Production assets contain no
  audition MP3s; the studio build contains exactly 15. Existing chunk-size warnings
  remain non-blocking.
- Built-studio smoke test, served by Vite preview on port 5178:
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/walter-built-check.config.mjs --grep "Walter starts neutral" --reporter=line`:
  **2 passed**, desktop/mobile. All 15 compiled recording URLs decode and start;
  no provider/API requests or browser errors. The ignored wrapper uses the normal
  audio projects with the preview base URL and no development server.
- Exercised custom playback in the actual studio, inspected desktop/mobile
  screenshots, and completed independent code/provenance review without actionable
  findings. Whitespace checks passed. Auditory quality remains the owner's
  listening decision; these checks do not establish natural delivery.
- No full backend, account or coach-artwork suite, production speech integration,
  deployment, push or remote CI run for this development-only audition.

## Prerecorded Walter voice pilot — September 30, 2026

Added cancellable recorded-speech loading to the shared audio engine and a
development-only Walter audition with three voices and four identical teaching
examples per voice. The 12 local MP3s total **1,789,388 bytes**. A dry-run-first
authoring CLI records exact request provenance and reuses hash-verified outputs;
normal playback, tests and builds never generate speech or require credentials.
Production dialogue and automatic narration remain unchanged.

- `node --test scripts/record_coach_speech.test.mjs`: **14 passed**, no skips;
  fake-fetch coverage for explicit generation, bounded sequential requests,
  cancellation, redaction, safe publication and verified reuse. No paid requests.
- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **122 passed**, desktop/mobile, no skips. The ignored wrapper delegates to the
  normal audio config and only reuses the existing studio. Covers native decoding
  and playback of all 12 recordings, finite durations/nonzero signal, source and
  script correspondence, no provider requests, untouched account preferences,
  cold-load cancellation, voice changes, mute, hidden tabs and zero volume.
  Context speech waits for the move's actual start before its 350ms pause,
  including cold move/cached speech, failed and cancelled move cases.
- `npm.cmd --prefix frontend run build`: passed, including API/type checks,
  **11** style tests and entrypoint boundaries. Production assets contain no
  audition MP3s. `npm.cmd --prefix frontend run build:audio-studio`: passed;
  its output contains exactly 12 MP3s. Existing large-chunk warnings remain.
- Built-studio smoke test, served by Vite preview on port 5178:
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/walter-built-check.config.mjs --grep "Walter starts neutral" --reporter=line`:
  **2 passed**, desktop/mobile. The temporary wrapper uses the normal audio test
  projects with a preview base URL and no dev server. All 12 compiled asset URLs
  decode and start locally; no API/provider requests or browser errors.
- Offline authoring dry run against the checked-in plan and output directory:
  **12 verified recordings reused, 0 new requests, 0 characters**.
- Exercised the real studio and inspected desktop/mobile audition screenshots.
  Independent engine/authoring/integration reviews completed; the discovered
  cold-move ordering issue was corrected and regression-tested. Whitespace checks
  passed. Auditory quality and the final voice choice remain the owner's listening
  decision; decoding and visual checks cannot establish natural delivery.
- No full backend, coach-artwork or account suite, Docker deployment, push or
  remote CI run for this development audition. No production speech integration.

## Separate Sound settings tab — September 30, 2026

Moved the existing AudioSettings component to `?section=sound`, using the shared
Settings navigation. Coach & animations retains motion controls and coach
selection. Preference storage, playback and assets are unchanged. Updated test
navigation labels and mixed account flows to visit the appropriate tab explicitly.

- `npm.cmd --prefix frontend run build`: passed, including API/type checks,
  **11** style tests and entrypoint boundaries. Existing chunk-size warning only.
- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test settings.spec.ts audio-preferences.spec.ts --reporter=line`:
  **36 passed**, desktop/mobile, no skips. Covers independent tab contents,
  Sound deep links, Back/Forward/reload, narrow layouts, sound persistence,
  error recovery, mute and pending-preview cancellation.
- Same environment,
  `node node_modules/@playwright/test/cli.js test --config playwright.accounts.config.ts --grep "account signup, engine-free sync" --reporter=line`:
  **2 passed**, desktop/mobile, no skips. Account sound/coach preferences restore
  across devices and remain isolated after account changes with the new tabs.
- Inspected the focused diffs and narrow sound-control screenshot; whitespace
  checks passed. No full backend/coach suite or Docker deployment for this UI move.

## Final sound inventory cleanup — September 30, 2026

Removed 18 unselected WAVs, their unused recipes/source credits, and the studio's
retired audition selection/persistence/export code. The studio now previews the
same nine defaults as production. All nine WAVs, recipes and the production
mapping are unchanged. Bundled audio fell from 1,999,734 to **765,450 bytes**
(61.7% smaller). Six CC0 source recordings remain. Locally, 50 rejected cache/
research files and 14 superseded helper files were removed from ignored `.tools`;
the six required source MP3s and authoring dependencies were preserved.

- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **74 passed**, desktop/mobile, no skips. Covers all nine real assets, exact
  manifest/default/source coverage, retained context timings, cancellation,
  mute/hidden behavior, retired caller rejection, untouched legacy browser
  storage and narrow-phone controls. The local wrapper only reuses the running
  studio and delegates to the repository audio config.
- `node node_modules/@playwright/test/cli.js test audio-study.spec.ts --reporter=line`
  in the same environment: **16 passed**, desktop/mobile, no skips. Real puzzle,
  lesson, opening recall and SRS paths retain their audio and silence policies.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including API/type
  checks, **11** style tests and entrypoint boundaries. Both output directories
  contain exactly the nine approved WAV hashes. Existing large-chunk warning
  remains non-blocking.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **9 assets**,
  **765,450 bytes**, hashes/levels/provenance valid. Cached offline `--prepare`
  with the existing pinned NumPy/SoundFile authoring environment reproduced every
  file without changing hashes or downloading anything. Direct comparison against
  pre-cleanup Git blobs confirmed all nine files are byte-identical.
- Inspected the live studio and its retained context playback. Independent staged
  review found no actionable issue; staged whitespace check passed. No full
  backend/coach suite, Docker deployment, push or remote CI run for this cleanup.

## Approved Try again sound — September 30, 2026

Promoted audition 13, Muted tongue drum, to the production `retry` default.
The other eight approved choices, all sound files, feedback timing and engine
behavior are unchanged. Updated the previous silence assertions to verify the
selected sound while preserving cold-position/reload silence and cancellation.

- From `frontend` with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **78 passed**, desktop/mobile, including default selection and studio fallback.
- `node node_modules/@playwright/test/cli.js test audio-study.spec.ts --reporter=line`
  in the same environment: **16 passed**, desktop/mobile. Exercises actual
  puzzle, lesson, opening recall and SRS rejected-answer audio, reveals, reloads,
  counter-reply cancellation and late responses after navigation. No skips.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including API/type
  checks and **11** style checks. Existing production chunk-size warning remains.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **27 assets**,
  **1,999,734 bytes**, unchanged hashes/levels/provenance valid.
- Live studio restored **9 / 9 picked** with Muted tongue drum selected. Current
  documentation records all nine approvals. Working/staged whitespace checks
  passed. No full backend/coach matrix, Docker deployment, push or remote CI run.

## Retry finalists and longer context — September 30, 2026

Shortlisted original candidates 13 (Muted tongue drum), 18 (Fret catch) and 29
(Wood & damped strings). All retained WAVs remain unchanged from `6fb6b7c`;
27 total assets use 15 source recordings. Other retry assets/credits are removed
from the current catalogue. Eight production choices and unapproved retry silence
remain intact. Context options compare one retry, repeated attempts and a fuller
sound mix, using the lesson player's 160ms feedback delay and saved/default cues.

- Focused desktop/mobile audio suite via the existing local wrapper:
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`
  from `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`:
  **78 passed**, no skips. New checks cover original finalist numbers, all context
  cue boundaries/palettes, preserved picks and cancellation when switching modes.
- The initial longer-context tests exposed the engine's five-second delay clamp:
  later cues collapsed to the same instant. Increased the bounded delay ceiling
  to 15 seconds; regression coverage verifies exact 5.9/6.06/7.6-second scheduling,
  the upper clamp and cancellation without asset loads. Full focused rerun passed.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed after the correction,
  including API/type checks, **11** style tests and all entrypoint boundaries.
  Existing production chunk-size warning remains non-blocking.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **27 assets**,
  **1,999,734 bytes**, hashes/levels/provenance valid. No clips were reauthored.
- Independent code review found no remaining actionable issue. Manual live
  studio showed 13/18/29, eight saved picks and all nine expected starts in the
  repeated-attempt comparison, ending with Correct and Complete. No subjective
  listening-quality claim. Working/staged whitespace checks passed.
- No unrelated backend/coach suites, deployment, push or remote CI run.

## Broad recorded retry auditions — September 30, 2026

Replaced the rejected buzzer/brass/whistle/electronic choices with 30 numbered
Try again candidates across six material families, retaining Piano slip exactly.
Twenty-one new recorded sources support singles, paired contacts and five blends.
Context previews use the existing engine and saved/approved surrounding sounds
without writing selections. All 24 non-retry WAVs and Piano slip match `ac0bb15`;
the eight production choices and silent unapproved retry remain unchanged.

- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **70 passed**, desktop/mobile, no skips. The local wrapper reuses the owner's
  running studio. Covers all 54 assets, every source credit, narrow-phone layout,
  persisted picks, retired choices, context timing/palette selection and
  stop/replacement/mute cancellation, alongside engine visibility/disposal tests.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including generated
  API checks, application/test TypeScript, **11** style tests and entrypoint
  boundaries. Existing production chunk-size warning remains non-blocking.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **54 assets**,
  **3,156,038 bytes**, hashes/levels/provenance valid. Cached `--prepare` using
  NumPy 2.2.6 / SoundFile 0.13.1 reproduced every WAV without hash updates.
- Independent review confirmed unchanged retained binaries, distinct retry hashes,
  onset delays at most 45ms, retry durations 0.226–0.856s, clean boundaries,
  complete blend credits and preserved cancellation. A stale removed-candidate
  engine-test reference was corrected before the passing run.
- Manual live studio check: six numbered families rendered, eight owner picks
  preserved, Board & cello context produced Move/Retry/Move/Correct with approved
  surrounding sounds. Actual playback starts were observed; subjective listening
  quality is not claimed as verified. Final sound selection remains the owner's.
- `git diff --check` and staged whitespace check passed. No unrelated backend or
  coach matrix, deployment, push or remote CI was run for this audition change.

## Recorded retry source comparison — September 30, 2026

The owner rejected the electronic texture of the pitch/pattern set. Replaced
those 16 variants with five independently sourced CC0 recordings: real relay
and door buzzers, a misplayed piano note, muted trombone and slide whistle.
Retained the exact previous Soft error as a labelled electronic comparison.
All 25 retained binaries and recipes match `020d04f`. Excerpts retain original
speed and pitch; no runtime/authoring architecture or production choices changed.

- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **62 passed**, desktop/mobile. The wrapper reuses the owner's studio. Covers
  playback of all 30 files, attribution, new source licenses, responsive six-way
  comparison, preserved picks, rejected old choices and unapproved retry silence.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including API/type
  checks, **11** style tests and entrypoint boundaries.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **30** assets,
  **2,238,714 bytes**, valid. Cached `--prepare` with the pinned NumPy/SoundFile
  environment reproduced every output exactly without updating hashes.
- `git diff --check` and `git diff --cached --check`: passed.

Independent review verified the five primary publisher pages, recorded origins,
CC0 declarations, output levels and zero-valued edit boundaries; no actionable
defects. Manual studio reload showed the new sources, eight preserved picks and
successful Mechanical buzzer playback. Auditory preference is not claimed as
verified; these are candidates for the owner. No unrelated backend/coach matrix,
deployment or remote CI was run.

## Broader higher-pitched retry auditions — September 30, 2026

Replaced three rejected subtle edits with 16 stronger pitch/pattern alternatives;
the unchanged Soft error reference makes 17 retry choices. Five pitch levels
span approximately +7 to +28 semitones, with separate repeated, descending,
isolated-note and envelope alternatives. Source edits remain offline. All 25
retained WAVs and recipes match `9b0739a`; the 16 new hashes are distinct. No
production choices, account preferences or engine behavior changed.

- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **62 passed**, desktop/mobile. The local wrapper reuses the owner's running
  studio. Tests play all 41 assets, check descriptions/source attribution,
  three-column desktop/two-column 320px phone layout, retained selections,
  retired-choice filtering, cancellation and production retry silence.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including API/type
  checks, **11** style tests and entrypoint boundaries. Existing chunk-size
  advisory only.
- `.venv/Scripts/ruff.exe check scripts/prepare_audio.py` and
  `.venv/Scripts/ruff.exe format --check scripts/prepare_audio.py`: passed.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **41** assets,
  **2,464,756 bytes**, valid. Cached `--prepare` reproduced every output exactly
  without hash updates using the pinned NumPy/SoundFile authoring environment.

Independent review found no actionable defects; retry edit boundaries are zero,
durations are 0.116–0.766s and level limits/attribution remain intact. Manual
studio inspection confirmed 17 choices, eight preserved picks and successful
Highest error playback. Listening preference remains for the owner to judge.
No unrelated backend/coach matrix, deployment or remote CI was run.

## Soft error refinements — September 30, 2026

Kept the original Soft error audition byte-for-byte and added Warmer (89% speed),
Shorter (earlier fading finish), and Gentler onset (85ms onset, lower level).
Removed the other two retry directions. All 25 retained assets and recipes match
`5780678`; new derivatives retain LorenzoTheGreat's CC BY 3.0 attribution. Rate
and onset edits are offline authoring options, with unchanged defaults for old
recipes. No production selection or account behavior changed.

- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **62 passed**, desktop/mobile, including all assets, 2×2 layout at 320px,
  preservation of original retry/approved picks and rejection of retired choices.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including types/API,
  **11** style tests and boundaries; existing chunk-size advisory only.
- `.venv/Scripts/ruff.exe check scripts/prepare_audio.py` and
  `.venv/Scripts/ruff.exe format --check scripts/prepare_audio.py`: passed.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **28** assets,
  **2,152,358 bytes**, valid. The cached `--prepare` invocation documented below
  reproduced all outputs exactly without updating hashes.

Independent review found no actionable issues and confirmed the retained files,
actual variant levels/durations, silent tails and attribution. Manual studio
reload preserved eight owner picks and Warmer reached played status. Subjective
approval remains with the owner. No unrelated backend/coach matrix or deployment.

## Focused soft retry audition — September 30, 2026

The owner rejected the six object/instrument clips as unsuitable for a soft
"oops, try again". Replaced them with Soft error (LorenzoTheGreat's authored
error effect), Gentle downturn (SFXMint's AI-generated failure cue), and Quiet
oops (WIM's recorded voice). Trimmed silent tails and set quieter audition level
targets. These are listening candidates only; production retry remains null,
all eight picks are preserved and all 24 non-retry assets/recipes match `8efb6e9`.
Studio source disclosures now retain each clip's actual CC0/CC BY license and
Fieldwork edits instead of incorrectly labeling all sources CC0.

- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **62 passed**, desktop/mobile. Covers actual playback, source/license/edit
  disclosures, three choices at 320px, all six retired IDs rejected without
  fetching/scheduling, preserved eight picks and new retry selection persistence.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including API/types,
  **11** style tests and entrypoint boundaries. Existing chunk-size advisory only.
- `.venv/Scripts/ruff.exe check scripts/prepare_audio.py` and
  `.venv/Scripts/ruff.exe format --check scripts/prepare_audio.py`: passed.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **27** assets,
  **2,021,432 bytes**; hashes, metadata, duration, peak levels and silent tails pass.
- `.venv/Scripts/python.exe -c "import sys,runpy; sys.path.insert(0,'.tools/audio-authoring'); sys.argv=['scripts/prepare_audio.py','--prepare']; runpy.run_path('scripts/prepare_audio.py',run_name='__main__')"`:
  reproduced all outputs exactly from cached sources without updating hashes.

Manual reload confirmed eight saved picks and three unselected retry candidates;
Soft error reached played status. Publisher descriptions establish intended use;
automated checks do not establish subjective sound quality. No new production
sound was approved, and no backend/coach matrix, deployment or remote CI ran.

## Six new recorded Try again candidates — September 30, 2026

Replaced the three rejected retry clips with six distinct recordings: cork pop,
page flick, short zip, muted guitar strum, soft kalimba and conga tap. The studio
supports candidates for individual cues without inventing complete palettes.
All 24 non-retry WAVs and recipes match `cf58500`; the eight approved production
choices are unchanged. Retry remains silent in production and ratings stay absent.

- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **60 passed**, desktop/mobile. The ignored wrapper reuses the live studio.
  Checks all 30 actual assets, source disclosures, six named choices at 320px,
  preserved eight picks, dropped rejected retry picks, new retry persistence and
  scenario playback. Unavailable cue/candidate pairs never fetch or schedule;
  existing silence, cancellation, visibility and speech-foundation tests pass.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including API checks,
  app/browser/contract types, **11** style tests and standalone boundaries.
  Existing production chunk-size advisory only.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **30** candidates,
  **2,171,240 bytes**, hashes/format/duration/levels/tails/provenance valid.
- `.venv/Scripts/python.exe -c "import sys,runpy; sys.path.insert(0,'.tools/audio-authoring'); sys.argv=['scripts/prepare_audio.py','--prepare']; runpy.run_path('scripts/prepare_audio.py',run_name='__main__')"`:
  all **30** outputs reproduced exactly from cached sources without hash updates.
  Authoring dependencies and downloaded inputs remain ignored.

Independent review found no actionable defects and confirmed all six primary
publisher pages declare CC0. Manual studio reload preserved eight owner picks;
Practice displays all six new choices and Cork pop reached the played state.
Listening preference is for the owner to judge; no subjective audio-quality
approval is claimed. No unrelated backend/coach matrix, deployment or remote CI.

## Owner sound selections and removal of rating audio — September 30, 2026

Applied the eight choices read from the owner's visible studio mapping:
Soft objects for move/capture/castle/promotion/mate; Tabletop for
check/correct/complete. Try again has no approved clip and stays silent before
fetching or scheduling. Rating cues, callers, assets, settings and preference
storage are removed; board and practice playback remain independent of grading.
Migration `342fd86bc105` drops only `audio_review`.

- `.venv/Scripts/python.exe -m pytest -q backend/tests/test_audio_preferences.py backend/tests/test_api_contract.py --basetemp=data/verification/remove-rating-green -o cache_dir=data/verification/remove-rating-cache`:
  **14 passed**. The new migration test failed before the fix with the obsolete
  column still present. It now preserves all remaining preference values and user
  rows for two accounts, verifies foreign keys/integrity and checks schema parity.
- `.venv/Scripts/python.exe -m pytest -q backend/tests/test_coach_preferences.py backend/tests/test_motion_preferences.py backend/tests/test_accounts.py --basetemp=data/verification/remove-rating-neighbors -o cache_dir=data/verification/remove-rating-cache`:
  **63 passed**. Both backend runs report two existing dependency deprecations.
- `.venv/Scripts/ruff.exe check backend/trainer/contracts/preferences.py backend/trainer/models.py backend/trainer/preferences.py backend/tests/test_audio_preferences.py migrations/versions/342fd86bc105_remove_rating_audio.py`
  and the same paths with `ruff format --check`: passed.
  `scripts/export_api_contract.py` and `npm.cmd --prefix frontend run api:generate`
  regenerated contracts; their `--check` / `api:check` counterparts passed.
- From `frontend`, with `PLAYWRIGHT_BROWSERS_PATH=../.tools/playwright`,
  `node node_modules/@playwright/test/cli.js test --config ../.tools/ui-standardization.config.ts tests/game-audio.spec.ts --reporter=line`:
  **18 passed**, desktop/mobile. The all-ratings regression first failed on an
  unwanted Brilliant event. It now covers all nine qualities, silent completed
  analysis and existing graph/variation cancellation and delayed-response cases.
- From `frontend`, with the same browser cache,
  `node node_modules/@playwright/test/cli.js test --config node_modules/.cache/recorded-audio-check.config.mjs --reporter=line`:
  **52 passed**, desktop/mobile. The ignored wrapper reuses the live studio.
  Covers the exact approved asset mapping, no loading/timer for unapproved retry,
  runtime rejection of stale rating cues, preservation of the owner's eight
  browser picks, per-cue scenario defaults and the existing engine lifecycle.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/audio-preferences.spec.ts tests/audio-study.spec.ts tests/game-audio-browser.spec.ts --reporter=line`:
  **34 passed** across desktop/mobile. Checks real settings, board moves, silent
  rejected answers, successful practice, cold/reloaded silence and cancellation.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py accounts --reporter=line`:
  **8 passed**, desktop/mobile, including cross-device sound persistence, absence
  of the retired setting and account isolation.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed, including API/types,
  **11** style tests and dependency boundaries. Existing chunk-size advisory only.
- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: **27** remaining
  files, **1,971,510 bytes**, valid. Independent review compared every retained
  hash/recipe to the previous commit: the auditioned clips were not changed.

Independent code review found no actionable defects. Manual studio reload
confirmed all eight owner choices persisted and rating choices were absent.
No full unrelated coach matrix, Docker/deployment or remote CI run is claimed.

## Recorded audio audition replacements — September 30, 2026

The rejected synthetic palettes and their generator are removed. Three recorded
palettes now fill all 42 audition slots using edits of 11 CC0 sources. This is an
owner audition round, not an approved final sound selection. The production
fallback uses Recorded chess. Source disclosures reuse the application SourceLine
and native disclosure styles without importing application shells. Picks/export
are version 2 so old choices cannot approve replacement assets.

- `.venv/Scripts/python.exe scripts/prepare_audio.py --check`: all **42** outputs
  verified offline against hashes, format, duration, peak, silent-tail and source
  metadata checks; **3,051,748 bytes** total. An independent review repeated this
  check and validated all 11 cached input hashes against the manifest.
- `.venv/Scripts/python.exe -c "import sys,runpy; sys.path.insert(0,'.tools/audio-authoring'); sys.argv=['scripts/prepare_audio.py','--prepare']; runpy.run_path('scripts/prepare_audio.py',run_name='__main__')"`:
  reproduced all **42** outputs byte-for-byte from pinned cached recordings with
  NumPy 2.2.6 and SoundFile 0.13.1. No hash updates were accepted. The temporary
  authoring dependencies/cache are ignored and are not app dependencies.
- `.venv/Scripts/ruff.exe check scripts/prepare_audio.py scripts/ci_plan.py backend/tests/test_ci_plan.py`
  and the same paths with `ruff format --check`: passed after formatting the new
  CI condition.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_ci_plan.py -q`:
  **302 passed**, including the narrow application/audio classification for shared
  source disclosures. From `frontend`, `node --test scripts/style-boundaries.test.mjs`:
  **11 passed**.
- From `frontend`, `npx playwright test --config node_modules/.cache/recorded-audio-check.config.mjs`:
  **36 passed / 6 failed** because the already-running studio retained an old
  Vite asset glob after the directory replacement. Invalidated that cached module;
  rerunning the same command with `--last-failed` passed **all 6** affected cases.
  The ignored wrapper preserves the normal desktop/mobile configuration and
  reuses the live audition server. Coverage includes actual playback of all 42
  WAVs, every source disclosure, stale-pick rejection and 320px controls.
- With the same browser configuration, `--grep 'clearing studio picks'`:
  **2 passed**, desktop/mobile; resetting choices persists across reload, leaves
  unrelated/legacy storage intact, permits new choices and makes no API requests.
  `npm run test:types` passed after that small studio addition.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/audio-preferences.spec.ts tests/game-audio-browser.spec.ts --reporter=line`:
  **18 passed**, desktop/mobile, including real new-default audio playback,
  persistence, silence preferences, delayed preview cancellation and quiet graph
  dragging.
- `npm.cmd --prefix frontend run build` and
  `npm.cmd --prefix frontend run build:audio-studio`: passed. The app build checks
  API agreement, app/browser/contract types, **11** style tests and standalone
  dependency boundaries. Existing large-chunk advisory remains.

Manual studio interaction confirmed recorded move playback, its expanded
author/license/source disclosure and clearing the test selection. Automated browser tests play every candidate;
subjective listening approval remains with the owner. No AI-generated audio,
account migration, dependency lock changes, Docker build, unrelated full coach
matrix or remote CI/deployment is claimed for this focused pass.

## Shared audio and audition studio — September 30, 2026

Board, practice and optional learner-side review cues now use one cancellable
browser service. Account preferences, device-local mute and a separate audition
studio are wired through real application paths. Coach speech has a prepared-clip
boundary and playback bus only; no speech generation or narration is enabled.
See [Audio](AUDIO.md) for cue policy, defaults and ownership.

- `.venv/Scripts/python.exe -m pytest -q backend/tests/test_audio_preferences.py backend/tests/test_coach_preferences.py backend/tests/test_motion_preferences.py backend/tests/test_api_contract.py --basetemp data/verification/audio-backend-tests -o cache_dir=data/verification/audio-backend-cache`:
  **70 passed**. Includes strict preference validation, account isolation,
  preservation of coach/motion choices, and an upgrade from the previous schema
  with local/named users. Alembic reported no schema drift and SQLite integrity
  and foreign-key checks passed. Two existing dependency deprecation warnings.
- `.venv/Scripts/ruff.exe check backend/trainer/contracts/preferences.py backend/trainer/preferences.py backend/trainer/routes/workspace.py backend/trainer/models.py backend/tests/test_audio_preferences.py migrations/versions/0d6a3c81f294_audio_preferences.py` and
  `.venv/Scripts/ruff.exe format --check backend/tests/test_audio_preferences.py migrations/versions/0d6a3c81f294_audio_preferences.py`: passed.
- `.venv/Scripts/python.exe scripts/export_api_contract.py --check` and
  `npm.cmd --prefix frontend run api:check`: backend schema and generated types agree.
- `.venv/Scripts/python.exe scripts/generate_audio.py --check`: all **42** original
  assets reproduced byte-for-byte, **662,016 bytes** total.
- `npm.cmd --prefix frontend run test:audio`: **38 passed**, covering the engine
  and real-asset studio at desktop/mobile sizes. Covers activation rejection,
  duplicate suppression, pending decode cancellation, voice limits, category/mute
  behavior, hidden tabs, prepared speech, persisted audition picks and scenario
  cancellation. `npm.cmd --prefix frontend run build:audio-studio` also passed.
- From `frontend`, `npm exec playwright test -- --config=test-results/game-audio.config.ts game-audio.spec.ts`:
  **18 passed**, using an ignored copy of the normal app config with no external
  webServer; this fixture starts its own ephemeral Vite server. Includes explicit
  navigation, learner-only accents, graph scrubbing, stale analysis and delayed,
  failed or superseded variation-position responses. No sound precedes a missing
  variation board; cached positions can sound immediately.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/audio-preferences.spec.ts tests/settings.spec.ts tests/motion.spec.ts tests/game-review.spec.ts tests/review-lifecycle.spec.ts tests/study-puzzles.spec.ts tests/study-lessons.spec.ts tests/opening-due.spec.ts --reporter=line`:
  **104 passed** across desktop/mobile.
- After the final variation timing and settings layout corrections,
  `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/audio-preferences.spec.ts tests/audio-study.spec.ts tests/game-audio-browser.spec.ts tests/game-review.spec.ts --reporter=line`:
  **53 passed, 1 failed** on an ambiguous test locator matching both notation and
  a newly analyzed graph node. Scoped both notation assertions to the move list;
  `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/audio-preferences.spec.ts --reporter=line`
  then passed **all 16** cases. The other **38** final-build cases passed in the
  preceding run. Real Web Audio source starts are observed after native playback
  succeeds, without production test globals. Coverage includes cold/restored
  silence, reveal without praise, Still/natural playback, visible replies,
  cancellation after navigation/unmount, settings failure recovery and pending saves.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py accounts --reporter=line`:
  **8 passed**. Sound choices follow the account onto another browser, quick mute
  stays local, sign-out/account changes preserve isolation, and actual preview
  audio follows those preferences. An initial **7 passed / 1 failed** run exposed
  the same notation/graph locator ambiguity; the final run uses a scoped selector.
- `npm.cmd --prefix frontend run build`: passed API agreement, application,
  browser and contract type checks, **11** style-boundary tests, all three
  standalone dependency graphs and production Vite build. Existing large-chunk
  advisory remains. The CI planner's **302** tests passed after adding the audio
  lane; audio-only work does not select the full coach artwork matrix.

Independent review found and resolved early variation-navigation audio. Manual
studio interaction confirmed cue playback status; desktop and 320px application
sound settings and studio screenshots were inspected. The final scenario wording
distinguishes a capture followed by a separate checking move from the single-cue
policy for a checking capture. No subjective speaker/headphone calibration,
physical iOS/Safari check, fresh Docker build, full unrelated backend/coach matrix
or remote CI run is claimed for this local pass. No production database or
deployment was changed.

## Opening curriculum restructuring — September 30, 2026

Chapter boundaries now follow distinct learning problems, with no standard
chapter count. White Italian v2 has three substantially rebuilt chapters:
quiet setup, completing development, and choosing the central break. The former
standalone Two Knights setup is an optional comparison rather than a duplicate
unit. Black Italian v3 has four chapters: its post-castling bishop plan becomes
active instruction, while the connected central sequence stays together. King's
Gambit v3 has four chapters: the Falkbeer countergambit separates from the bishop
refusal, and the Modern chapter asks learners to apply its central-support plan.
Later rehearsals start at their chapter's established position. Explicit Due
enrollment still uses full line history and deduplicates shared positions.

The source records explain retained, condensed and expanded material:
[White Italian](ITALIAN_COURSE_SOURCES.md),
[Black Italian](ITALIAN_BLACK_COURSE_SOURCES.md), and
[King's Gambit](KINGS_GAMBIT_COURSE_SOURCES.md).
These are deeper starter courses, not exhaustive opening repertoires.

A separate Stockfish 18 authoring audit examined 104 unique position/move pairs,
including rejected candidates, through 220 independent unrestricted/forced-root
searches and 15 MultiPV position searches. Baseline searches used two million
nodes; concerns were repeated at five or ten million nodes, reaching depths
20–35. Hash was cleared between searches; concurrency was bounded to four
processes, each with one thread and 64 MB hash. The audit distinguishes the
premature early ...d5 pawn concession from a later sound ...d5 break; motivates
Bxe6 before cxd4 to avoid ...Bg4; and identifies ...exf4 as the stronger Falkbeer
reply than the classical ...e4 teaching branch. The latter is labeled honestly
and linked to the already taught Modern transposition. These bounded searches
are authoring evidence, not exhaustive proof or a production engine-budget
change. Temporary probes and results remain outside Git.

- `.venv/Scripts/python.exe -m pytest backend/tests/test_italian_course.py backend/tests/test_italian_native.py backend/tests/test_italian_black_claims.py backend/tests/test_kings_gambit_claims.py backend/tests/test_study_lessons.py backend/tests/test_lesson_journey.py backend/tests/test_opening_sources.py backend/tests/test_opening_castling.py backend/tests/test_lesson_castling.py -q`:
  **136 passed**, including native Stockfish, exact histories, branches,
  rehearsal, snapshots and explicit enrollment. Two existing deprecation warnings.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_italian_white_claims.py -q`:
  **10 passed**, checking defenders, blockers, material, recaptures, early versus
  prepared ...d5, branch returns and chapter rehearsal anchors.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_italian_course.py -k content_identity -q`:
  **3 passed, 11 deselected** after strengthening the publication fingerprints
  to cover all three revised courses. Two existing deprecation warnings.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/italian-course.spec.ts tests/opening-courses.spec.ts tests/source-attribution.spec.ts --reporter=line`:
  **30 passed** across desktop/mobile; wrapper exited zero and cleaned up its
  server. Coverage includes every new chapter's guided moves, optional branches,
  reload/return, anchored rehearsal, cold feedback boundaries, source attribution,
  drag targets and source-game navigation without coach/control flashing.
- `.venv/Scripts/python.exe .tools/check_curriculum_upgrade.py`: all three
  actual previous course definitions passed a disposable-database upgrade check.
  Saved lesson responses remained identical, old sessions continued with their
  original revisions, and enrolled lines retained their original versions and
  full histories while the library exposed the new revisions. This temporary
  probe supplements the committed generic snapshot regression tests.
- `npm.cmd --prefix frontend run build`: passed generated API agreement,
  application/browser/contract type checks, seven style-boundary checks and the
  production bundle. The existing large-chunk advisory remains. The source
  archive and Vite bundle were refreshed after staging new content modules so
  the downloadable source includes them.
- `.venv/Scripts/ruff.exe check backend/trainer/study_lessons/courses backend/tests/test_italian_course.py backend/tests/test_italian_white_claims.py backend/tests/test_italian_black_claims.py backend/tests/test_kings_gambit_claims.py scripts/smoke_install.py`
  and the same paths with `ruff format --check`: passed, 18 files formatted.
  `git diff --check` passed.
- Manually used an isolated production app to open the revised course library,
  play Ng3 and d4 in the new White center chapter, and enter the prepared ...d5
  comparison. Inspected desktop/mobile browser captures. Independent final
  content/code review found no remaining actionable issues.

Focused curriculum verification only; no full backend, account, coach, lab or
Docker suite. The installation smoke assertion was updated to validate actual
chapter metadata instead of imposing three chapters, but Docker smoke was not
run. Production frontend code, API contracts and the lesson framework are
unchanged. No push or deployment.

## Opening-course teaching-quality review — September 30, 2026

Both new courses now use revision `2026-09-v2`; existing saved sessions remain
pinned to their original snapshots. The original White Italian revision is
unchanged. Research decisions and attribution are recorded in
[Black Italian sources](ITALIAN_BLACK_COURSE_SOURCES.md) and
[King's Gambit sources](KINGS_GAMBIT_COURSE_SOURCES.md).

The review found accommodating Black replies in two King's Gambit scripts,
incorrect material wording, and insufficient explanation of plans after the
opening. The revised King's Gambit uses stronger resistance, concrete optional
mistake demonstrations and a directly relevant historical Black win. The Black
Italian retains its recall lines while explaining the f7 defense, quiet
middlegame plan, isolated d-pawn tradeoffs and an actual Evans central break.
These remain bounded starter courses, not exhaustive opening repertoires.

Authoring research included a separate Stockfish 18 audit of both players'
scripted moves: 86 unique original move/position pairs, each with independent
unrestricted and forced-root searches at two million nodes (depths 19–30).
Ten concerns were repeated at ten million nodes; eight line endpoints received
ten-million-node MultiPV searches. Added Italian continuations and revised
King's Gambit choices received further five-million-node comparisons. Hash was
cleared between independent searches. The audit found no tactical refutation of
the originally taught learner moves; it did expose weaker opponent replies and
the difference between a playable instructional choice and an engine preference.
In particular, it does not support declaring the old `6.d4` line refuted. These
bounded authoring searches are not an opening-proof claim or a production engine
budget change. Local probe scripts/results remain outside Git.

- `.venv/Scripts/python.exe -m pytest backend/tests/test_italian_course.py backend/tests/test_italian_native.py backend/tests/test_italian_black_claims.py backend/tests/test_kings_gambit_claims.py -q`:
  **32 passed**, including native Stockfish coverage, with two existing
  deprecation warnings. Checks include exact attacks/defenders, pawn counts,
  exchange consequences, historical mate geometry, branch contracts, unchanged
  White-course content, and revision/snapshot behavior.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_kings_gambit_claims.py backend/tests/test_italian_black_claims.py -q`:
  **17 passed** after the final wording correction. The declined-gambit example
  no longer claims that fxe5 opens queen diagonals which were already open.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/opening-courses.spec.ts tests/italian-course.spec.ts --reporter=line`:
  **16 browser tests passed**, desktop/mobile. The wrapper then exited with a
  server-cleanup permission/timeout error; this was not a browser-test failure.
  The exact disposable server process was identified and stopped. Repeating
  `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/opening-courses.spec.ts --reporter=line`
  with sufficient process-cleanup permission passed **4 tests**, exited zero,
  and cleaned up successfully. New assertions cover optional contrast branches,
  reload at their endpoints, exact return to the main line, and the distinction
  between a bad-move demonstration and a required/rehearsed answer.
- `npm.cmd --prefix frontend run test:types`: passed.
- `.venv/Scripts/ruff.exe check backend/trainer/study_lessons/courses backend/tests/test_italian_black_claims.py backend/tests/test_kings_gambit_claims.py`
  and the same paths with `ruff format --check`: passed. `git diff --check` passed.
- Inspected desktop/mobile captures and manually used an isolated production app
  to resume an existing v1 Black session, start the revised King's Gambit, watch
  the declined-gambit counterexample through checkmate, and return to the exact
  main-line decision. Independent content/code review found no remaining
  actionable issues.

Focused content verification only. No full backend, account, coach, lab, Docker
or frontend production-build rerun; production frontend code and API contracts
are unchanged. No push or deployment.

## Black Italian and King's Gambit courses — September 30, 2026

Two bundled three-chapter courses reuse the existing lesson player and explicit
opening enrollment. Both include guided decisions, historical game passages,
returnable alternatives and rehearsal. Shared SAN authoring helpers preserve the
original White Italian revision exactly. Black course previews retain their
learner side across reload; users can still choose either side before enrollment.

- `.venv/Scripts/python.exe -m pytest backend/tests/test_italian_course.py backend/tests/test_italian_native.py backend/tests/test_italian_black_claims.py backend/tests/test_kings_gambit_claims.py -q`:
  **25 passed**, including native Stockfish checks of all three courses. Two
  existing deprecation warnings. Every chapter/accepted decision is exercised;
  concrete chess claims, source endpoints, independent progress, immutable
  snapshots and no automatic recall scheduling are covered.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_study_lessons.py backend/tests/test_lesson_journey.py backend/tests/test_lesson_castling.py backend/tests/test_opening_sources.py backend/tests/test_opening_castling.py -q`:
  **96 passed**, with two existing deprecation warnings.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/opening-courses.spec.ts tests/italian-course.spec.ts --reporter=line`:
  **16 passed** across desktop/mobile. Covers both new courses and the original
  White Italian player, source-game navigation, reload, rehearsal, optional
  enrollment, Black orientation and the selected enrollment side.
- The same app wrapper with
  `tests/opening-library.spec.ts tests/navigation.spec.ts --grep 'catalogue search|only designated|every screen' --reporter=line`:
  **6 passed** across desktop/mobile for existing library/navigation consumers.
- `npm.cmd --prefix frontend run build`: passed API agreement, application/browser
  TypeScript, seven style-boundary checks and Vite. Existing large-chunk advisory
  remains. `npm.cmd --prefix frontend run test:types` passed after final test edits.
- `.venv/Scripts/ruff.exe check backend/trainer/study_lessons backend/tests/test_italian_course.py backend/tests/test_italian_native.py backend/tests/test_italian_black_claims.py backend/tests/test_kings_gambit_claims.py scripts/smoke_install.py`
  and the same paths with `ruff format --check`: passed.
  `.venv/Scripts/python.exe scripts/export_api_contract.py --check` and
  `git diff --check`: passed; no API/schema change.
- Inspected desktop/mobile course captures and manually played the first Black
  decision in an isolated production app. Independent code/content review found
  no remaining actionable issues. Native authoring checks caught a loose h-pawn
  in the draft King's Gambit line; the final line supports it with g3. The Black
  central line was refined to the sounder Bd2 continuation before final checks.

Focused verification only; full backend, account, coach, lab and Docker suites
were not run. Fresh-container smoke expectations were updated for the three-course
registry, but the Docker smoke itself was not run. No push or deployment.

## Home recent-games presentation — September 29, 2026

Home uses a compact variant of shared GameHistory inside a matching panel. Player
rows keep aligned scores; a wrapping footer carries outcome, time, date, completed
accuracy and review state. The Games library retains its comparison layout.

- `npm.cmd --prefix frontend run build`: passed API agreement, TypeScript,
  seven style-boundary checks and Vite; existing large-chunk advisory remains.
- `npm.cmd --prefix frontend run test:types`: passed after the final test edits.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/dashboard.spec.ts tests/game-history.spec.ts --reporter=line`:
  **24 passed** across desktop and mobile. Includes long names at 320–1440px,
  queued/running/cancelled/failed review states, completed-only accuracy, missing
  accuracy, scores, review links and the unchanged full Games library.
- Inspected real-application desktop/mobile screenshots. `git diff --check` passed.
- Follow-up layout balance: Home retains its wider left desktop column with paired
  card bottoms aligned to the tallest content in each row, retaining natural
  stacked heights on phones. `node node_modules/vite/bin/vite.js build` from
  `frontend` passed. The app wrapper with `tests/dashboard.spec.ts --grep
  'Home presents|recent games retain' --reporter=line` passed **4 tests** across
  desktop/mobile; inspected both updated screenshots and checked the diff. After
  the owner clarified that only heights should match, restored the original
  1.65:1 desktop width split and tablet override; repeated the build and four
  focused checks successfully and inspected the corrected desktop layout.

Focused frontend checks only; no full backend, coach, lab or Docker suites.

## Home dashboard — September 29, 2026

Home at `/` combines authoritative due counts, four saved games, lesson resumes,
active opening lines and three server-ranked tactical practice priorities. It
reads existing account-scoped metadata only. Shared GameHistory now responds to
container width; StatList owns featured count sizing and ResumeLink owns wrapping.

- `npm.cmd --prefix frontend run build`: passed generated API agreement,
  application/browser TypeScript checks, seven style-boundary checks and Vite.
  The existing large-chunk advisory remains.
- `.venv/Scripts/python.exe -m pytest backend/tests/test_ci_plan.py -q`:
  **275 passed**, including the new app-only Home module/style selection.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py app tests/dashboard.spec.ts tests/navigation.spec.ts tests/game-history.spec.ts --reporter=line`:
  **31 passed, 1 intentional mobile modifier-click skip**. Covers metadata-only
  loading, no engine/session writes, authoritative counts, bounded priorities,
  independent loading/retries, stale responses, history/reload and 320–1440px layout.
- The same app wrapper with
  `tests/training.spec.ts tests/study-puzzles.spec.ts tests/study-lessons.spec.ts tests/statistics.spec.ts --grep 'Study home|removed lesson|redesigned screens|compact workspace|lesson library resumes|statistics|statistic' --reporter=line`:
  **10 passed** (Study, lessons and training navigation). The unmatched statistics
  filename selected no tests; the actual shared statistics suite ran below.
- The app wrapper with `tests/stat-list.spec.ts tests/resume-links.spec.ts --reporter=line`:
  **4 passed** for existing shared-component consumers.
- `.venv/Scripts/python.exe .tools/run_ui_checks.py accounts --grep 'account signup|Study progress' --reporter=line`:
  **4 passed**, including Home game/lesson/opening-count isolation across devices,
  sign-out and different accounts.
- Final app-wrapper check with
  `tests/dashboard.spec.ts tests/study-puzzles.spec.ts --grep 'Home presents|Study home' --reporter=line`:
  **4 passed** after the last compatibility adjustment; desktop/mobile captures saved.
- Manually inspected empty/populated Home at desktop and 390px, followed scheduled
  recall into its cold board and returned through browser history. Independent
  review moved long-label wrapping into the shared component. `git diff --check`
  passed.

Focused checks only; no full backend, coach, lab or Docker suites, push or deployment.

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
