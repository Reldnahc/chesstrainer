# Create a Fieldwork coach

This is the end-to-end authoring guide for a selectable, animated, written and
voiced coach. Read it before adding a character or bringing an existing character
up to the current Walter/Rivet standard. It connects the implementation references;
it does not introduce another registry, renderer or recording pipeline.

The references were checked against the implementation after Rivet's October 1,
2026 wording revision, and again after the remaining nine humans received
speaking mouths later that day. At that point the app had 30 selectable
characters, 30 speaking rigs and two production voice banks; Winston's and
Button's banks were recorded and registered on October 2. Those are different
completion states: a working mouth or an approved audition is not a finished voice bank.
Discover current coverage from the registries rather than treating these counts
as limits or assuming every character already meets the same spoken-writing bar.

## Reference map

| Question | Reference |
|---|---|
| Who is this character, and how should they teach? | [Cast bible](COACH_CAST_BIBLE.md) |
| How do artwork, reactions, idle behavior, mouths and settings work? | [Animated coach](COACH.md) |
| Which chess facts may dialogue communicate? | [Evidence-led dialogue](COACH_DIALOGUE.md) |
| How do I author and assess a distinct writing voice? | [Character writing](COACH_PERSONALITIES.md) |
| How are recordings selected, played, cancelled and attributed? | [Audio](AUDIO.md#recorded-coach-voices) |
| How do I cast and approve a voice? | [Cast auditions](../frontend/src/audio/speech/cast-auditions/README.md) |
| How do I build and verify a complete recorded bank? | [Bank authoring](../frontend/src/audio/speech/bank/README.md) |
| What produces mouth timing, and what must be installed locally? | [Alignment tooling](../frontend/src/audio/speech/alignment/README.md) |
| How do I inspect the actual sentence/evidence chain? | [Intelligence laboratory](INTELLIGENCE_LAB.md) |
| Which components and verification workflows should I reuse? | [UI component bible](UI_COMPONENTS.md), [testing](TESTING.md) |

## Quality bar: use Walter and Rivet as references

These are standards to review, not a request to make everyone sound like Walter
or Rivet. Walter connects ideas as a warm older teacher; Rivet organizes the
problem and consequence with literal precision and occasional dry understatement.

| Area | Acceptance standard |
|---|---|
| Identity | Several lines remain recognizable with the portrait/name hidden. A catchphrase pasted onto neutral text does not establish a character. |
| Teaching | Lead with the supported chess idea. Distinguish what happened, what the opponent can do, what might happen after further choices, and what an unplayed alternative would do. |
| Acting | Expressions read at real review sizes; Brilliant and Blunder are unmistakably different. Rest, speech and idle movement keep the emotion rather than flashing back to an unrelated face. |
| Idle behavior | Use the shared coordinator, expression-compatible repertoire and two character signatures. Sustain natural activity without replaying entrances or adding a character-owned clock. |
| Opening variety | Use the shared deterministic recognition/sequence meanings. Test a run of Book moves, including the opponent's moves, rather than one isolated example. Recognition alone never means a move is good. |
| Human evidence | Keep Maia's human-likeness/difficulty separate from Stockfish's objective judgment. Preserve uncertainty and data-domain qualifications without turning every line into a methodology lecture. |
| Recorded speech | Author complete, natural summaries of supported ideas. When a current chess explanation and Maia insight have an approved combination, use one complete recording; never splice sentences at playback. |
| Playback | One automatic spoken turn per review action. Late Maia can improve written feedback and the next manual replay without causing a second automatic speech turn. |
| Mouths | Inspect all nine sound shapes and real recordings at normal sizes. Use automatic alignment against the actual audio clock, not hand-timed per-clip animation. |
| Completion | Tests establish correctness and provenance; listening, reading blind comparisons and watching real reviews establish perceptual quality. Record both honestly. |

The latest [Rivet revision ledger](../frontend/src/audio/speech/banks/rivet/revisions/wording-v3.json)
preserves concrete before/after examples and reasons. It is an editorial example,
not runtime input. The [verification history](VERIFICATION.md) records the checks
actually performed for Walter and Rivet and their limits.

## 1. Define identity and scope

Inspect the live [coach registry](../frontend/src/coach/registry.ts),
[personality contract](../frontend/src/dialogue/personality.ts) and
[voice bank registry](../frontend/src/audio/speech/banks/registry.json).
For an existing coach, preserve the stable account ID. Display names, collection
IDs, family IDs, personality versions, local voice keys and provider voice IDs
serve different jobs; do not interchange them.

Write or update the character's bible: temperament, teaching approach, rhythm,
celebration, correction and things to avoid. Define a visual silhouette and acting
style that support that temperament. Record what is being delivered: artwork and
written coaching, speaking capability, approved casting, or a complete voice bank.
Do not present an intermediate stage as a fully voiced coach.

Preserve these authority boundaries throughout:

- python-chess owns legality/history; Stockfish owns objective evaluation.
- Fieldwork rules own grades and supported evidence; Maia describes human behavior.
- Review intelligence derives relationships; dialogue communicates supported facts.
- Personality changes presentation. It never changes evidence, grades or searches.
- Cold SRS/puzzle feedback must not reveal the answer before product rules allow it.

Adding a personality is not a reason to change any of those chess systems.

## 2. Build on the shared character framework

Follow [Adding a coach](COACH.md#adding-a-coach) for the detailed integration points.
The essential order is:

1. Add the stable ID to `backend/trainer/contracts/preferences.py` and the relevant
   collection in `frontend/src/coach/studies/catalog.ts` or `cast/catalog.ts`.
   Collections feed the one selectable registry; Settings consumes it automatically.
2. Reuse an appropriate rig under `coach/human`, `coach/studies` or `coach/cast`.
   Keep character geometry and namespaced styles with the artwork. Use the shared
   `CoachCharacter`/`ReviewCoach` presentation rather than a page-specific portrait.
3. Supply expression coverage, defaults, capabilities and sensible fallbacks through
   `coach/model.ts`. The current roster supports all 20 semantic states; fallback
   support is not a reason to leave major emotions indistinguishable.
4. Add the acting profile, real available rig channels and signature timelines to
   `motionVocabulary.ts`, `idleRig.ts` and `idleSignatures/`. Current repertoire
   checks require at least eight compatible choices across three groups per
   expression and two authored signatures per coach. Declare only parts the SVG has.
5. Regenerate the API contract and frontend types using the existing tools. Adding
   an allowed string ID alone does not require a database migration. Preserve
   existing selections and explicit retirement/fallback behavior.

From the repository root with the virtual environment activated:

```sh
python scripts/export_api_contract.py
npm --prefix frontend run api:generate
```

Never hand-edit `api.generated.ts` or the exported contract. If a coach is being
upgraded without changing IDs or API fields, do not regenerate unrelated contracts.

Run `npm run dev:coach` from `frontend` and inspect http://127.0.0.1:5174.
Use all expressions, natural idle playback, seeded diagnostics, signature replays
and transitions. Check attached limbs, handedness, eye masks, clipping, small-size
readability and stable layout. The shared 500–1000ms idle gaps and independent eye
activity already exist; do not add another scheduler to make a character feel alive.

Motion follows the saved System/Animated/Still choice. System uses the browser
preference; explicit Animated overrides it. Hidden/offscreen behavior and cleanup
belong to shared lifecycle code. Still must retain an expressive static face.

## 3. Write the character before recording

Use [Character writing](COACH_PERSONALITIES.md) and [the dialogue contract](COACH_DIALOGUE.md).
Register a `CoachPersonality` with its bible, communication behavior, factual
templates, claim/length budget and delivery metadata in the character's catalogue
entry. Reuse the shared intent/projection/composition pipeline. Do not implement a
second evidence-to-English generator in the character or audio code.

Walter's `characters/storyteller.ts` and Rivet's `characters/robot.ts` are current
examples. Their `tacticalWording: "witness"` and `openingWording: "sequence"`
options are deliberate opt-ins. Another character needs its own complete authored
forms through `characters/scopedTactics.ts` / `scopedTacticalWording.ts` and the
opening-sequence contract before enabling those options. Enabling a flag alone
does not supply distinctive prose. Most other existing coaches still use the
earlier wording; do not copy that merely because it compiles.

Preserve required slots and qualifications in mandatory factual fragments.
Positional alternatives remain hypothetical. A mover's abandoned defender is not
an opponent-performed tactic. A tactic further down a searched line is not already
on the board; replace repetitive “in this continuation” with meaningful timing and
conditions, not false certainty. Keep shared neutral fallback for unsupported or
invalid forms, but investigate frequent fallback on common supported situations.

Run `npm run dev:intelligence` from `frontend` (port 5175). Compare the same facts
across characters with names hidden, then import a real review and inspect the
exact claim/variant trace. Review praise, correction, recovery, opponent success,
forced defense, quiet improvement, mate, uncertainty and cold practice. Check an
opening run and Maia combinations as sequences, including revisits/reloads.
Inspect the real bubble on desktop and phone; a corpus report cannot judge warmth,
robotic character, readability or repetition for you.

## 4. Design the spoken coverage

Visible prose and recorded scripts are different artifacts. The bubble can name
a move, piece, square, opening or score. The recording communicates the supported
idea without those position-specific details, so one recording can truthfully
serve many positions. It is not verbatim TTS of every rendered sentence.

Start from `audio/speech/meanings.json` and the production selectors
`gameSelection.ts` / `practiceSelection.ts`. Inventory supported primary meanings,
intentional silence and reachable objective/Maia pairs before counting clips.
The current complete banks each have 438 recordings: 181 original meanings,
11 varied opening meanings and 246 whole combinations. That is today's measured
coverage, not a required count to copy into every future test or a budget ceiling.

Use `banks/pilot-additions.json` and `banks/maia-combinations.json` as current
authored-script references. They contain Walter/Rivet prose, not an automatic
third-coach generator. Write each new character's complete versions and verify
meaning coverage; do not rename Walter's scripts and call them another personality.
When adding shared meanings, update production selection and evidence tests
coherently rather than adding recordings that are unreachable from actual review.

Review every script for the quality bar above. Alternate cases must stay alternate;
possible gains stay possible; only-move claims remain bounded by the searched
choices. Book recordings must not invent development advice. Avoid ambiguous
“separate”/“separately” in spoken scripts, whose pronunciation caused actual
recording problems. Prefer direct teaching over repeated engine-report framing.
Lessons remain text only; do not quietly expand this bank into lesson narration.

## 5. Approve the voice and record bounded batches

Use the [casting workflow](../frontend/src/audio/speech/cast-auditions/README.md)
and [bank authoring reference](../frontend/src/audio/speech/bank/README.md).
Compare distinct short voice directions, then obtain the owner's final choice
before purchasing a full bank. Preserve any existing authorization; do not ask
again for an already approved voice and recording scope. Use short auditions
around 8–10 seconds, then contrasting praise/correction/quiet teaching examples
to expose delivery weaknesses before bulk generation.

An audition vote, a saved provider voice and a registered production bank are
different steps. Walter's approval is in `walter-selected-voice.json`; other
current approvals are in `cast-auditions/locked-voices.json`. The strict bank
validator requires that identity binding. A new human outside the current casting
plan needs an explicit supported approval record/workflow, not a bypass of the
check or a fabricated nonhuman audition. Record source/permission information using
the existing [voice notices](AUDIO.md#locked-voice-and-permissions).

Prepare reviewed plans for `scripts/record_coach_speech.mjs`: exact voice/model,
settings, scripts and versioned output paths. Default invocation is a dry run.
Paid generation requires `--generate` and the process environment's
`ELEVENLABS_API_KEY`; neither the app nor the container needs that secret.
Plans are bounded to 20 voice/script pairs, 1,000 characters per script and
10,000 characters in total. The recorder encodes each take to the banks' Opus
before saving it. Preserve Opus/provenance pairs, request fingerprints and
actual provider usage. Do not infer credits from character counts or blindly retry
interrupted purchases. Existing verified takes are reusable and never overwritten.

Listen throughout generation. Check pronunciation, tone, complete endings and
whether the wording still sounds like this character. A changed script needs a
new full recording, matching provenance and new alignment—not a text-only edit
to a manifest. Preserve a concise old/new editorial record for revisions, as with
Rivet, while keeping superseded media out of production asset globs.

## 6. Add the speaking rig and automatic mouth timing

Follow [Speaking articulation](COACH.md#speaking-articulation). Reuse
`SpeechMouthLayer` and `OrganicSpeechMouth` for suitable faces; Walter's mouth and
Rivet's segmented display show how distinct geometry consumes the same controls.
Use the optional human mouth slot with the shared `human/HumanSpeechMouth` when
extending another human, as the men, women and children do. Implement all
nine semantic shapes, including a legible rounded O, and opt the rig into speech
only when it is supported. Do not copy another coach's lips onto an incompatible
face or use a separate timer to approximate the recording.

Inspect **Mouth shapes** in the Coach Studio, then listen and watch actual clips in
the Audio Studio (`npm run dev:audio` from `frontend`, port 5176). Automatic
PocketSphinx alignment creates detailed authoring evidence and compact runtime
tracks; see the [pinned native dependencies and commands](../frontend/src/audio/speech/alignment/README.md).
`prepare_coach_voice_bank.py --manifest PATH --generate` prepares one bank using
its exact recordings. It is local alignment, not another paid voice request.
Use the shared generator's improvements rather than hand-adjusting every clip.

Check consonant closures, O shapes, pauses, ends and transitions at real review
size. The audio clock drives both organic and mechanical mouths. Audio-reactive
fallback is not phoneme alignment. Still affects mouth motion, not permission to
play audio; switching coaches, rapid navigation, hidden tabs and unmount must
follow the shared cancellation policy. Alignment validation establishes provenance
and timing consistency, not proof of perfect pronunciation or believable acting.

## 7. Install and exercise the completed bank

Place a new bank under `audio/speech/banks/<voice-key>/` with its manifest,
active recordings/provenance, detailed alignment archives and generated
`tracks.json`. Add the coach/voice/manifest association to `banks/registry.json`.
Follow the exact integration checks in [Bank authoring](../frontend/src/audio/speech/bank/README.md):
the runtime's globs, shared selectors and lazy track loader already support this
layout. Keep audition and superseded files outside production media globs.

Registration is not a quality certificate: check complete semantic coverage,
matching approved voice identity, speech capability, generated tracks and UI
availability. Missing/unknown meanings or voices remain silent; never substitute
Walter's audio for another character. Do not weaken selectors to make unused clips
play or add another speech trigger to a Maia panel.

Exercise game review, a variation, practice feedback and saved explanations in
the application. Include delayed Maia, rapid forward/back navigation, replay,
coach changes, reload and a cold position. Confirm sound preferences, one automatic
turn, no old clip over a new position, faithful written/spoken meaning, and no new
engine work when selecting a different coach. Account persistence is shared; it
does not need a new character-specific settings table.

## 8. Validate, review and commit

Use [TESTING.md](TESTING.md) for setup, native dependencies and the current CI
selection policy. Run a focused subset while iterating; do not launch the whole
cast matrix for a prose-only documentation edit. A complete new character crosses
several layers and needs their relevant checks before being called finished.

| Changed layer | Relevant coverage |
|---|---|
| Identity/preferences | `backend/tests/test_coach_preferences.py`; app `coach-selection.spec.ts`, `coach-logic.spec.ts`, `coach.spec.ts`; account suite when persistence changes |
| Rig/acting | Coach Studio suite: full cast/expressions, repertoire, signatures, channels, hands, cadence, resting faces, diagnostics, motion and visibility |
| Written personality | App dialogue/personality tests and Intelligence Lab suite: required slots, scoped tactics, alternatives, attribution, deterministic composition, blind samples and cold feedback |
| Recorded scripts/selection | `test_coach_voice_bank.py`, `test_coach_pilot_scripts.py`; audio meaning coverage, production game/practice selection, prepared insight and delayed-Maia playback tests |
| Recording/alignment | Recorder Node tests; speech alignment/forced-alignment/pronunciation Python tests; strict complete-bank check; actual browser decode/playback |
| Speaking mouth | Audio Studio activity, lip-sync, speech animation/lifecycle and nonhuman mouth tests, plus manual character-sized viewing |

These commands are useful entry points, with the virtual environment activated
and working directory at the repository root:

```sh
python -B -S scripts/prepare_coach_voice_bank.py --check
node --test scripts/record_coach_speech.test.mjs
python -m pytest backend/tests/test_coach_preferences.py backend/tests/test_coach_voice_bank.py backend/tests/test_coach_pilot_scripts.py backend/tests/test_speech_alignment.py backend/tests/test_speech_forced_alignment.py backend/tests/test_speech_pronunciation.py -q
npm --prefix frontend run build
```

Browser commands run from `frontend`, sequentially, on isolated test servers.
Stop only development servers you own that occupy the required test ports; do not
point tests at a live account database or quietly kill someone else's instance.

```sh
npx playwright test coach-selection.spec.ts coach-logic.spec.ts coach.spec.ts personality.spec.ts dialogue-logic.spec.ts
npx playwright test --config playwright.coach.config.ts
npx playwright test --config playwright.intelligence.config.ts
npx playwright test --config playwright.audio.config.ts
```

Narrow these by test file during iteration; both desktop and mobile projects are
configured. Build before application tests that consume `dist`, and do not rebuild
during another suite. Use the normal lint/API/account/install checks when their
inputs change. Paid generation and native alignment are authoring operations,
never verification prerequisites for someone downloading the container.

Before calling the coach finished:

- Read blind dialogue samples and listen to the bank for personality drift,
  repetition, awkward pronunciation and conflicting tone.
- Watch sustained idle, expressions and speaking in real desktop/mobile reviews;
  inspect Still, System reduced motion and explicit Animated override.
- Check cold feedback, alternative scope, opponent attribution, delayed Maia,
  one automatic turn, selection persistence, cancellation and fallback behavior.
- Verify committed media/provenance/tracks agree, production includes only intended
  assets, and no credentials/native tools/private data entered the changes.
- Update the cast/reference docs and record actual commands, results, usage and
  perceptual limitations in [VERIFICATION.md](VERIFICATION.md). Never claim a
  listening review based solely on decoding files or capturing screenshots.
- Commit each coherent verified unit under [AGENTS.md](../AGENTS.md). Push only
  when requested. Tests passing do not replace the owner's final voice choice.
