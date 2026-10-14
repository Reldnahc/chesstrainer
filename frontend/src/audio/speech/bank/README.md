# Recorded coach bank authoring

Walter's bank lives in this directory. The other 29 coaches' banks live
under `../banks/<voice>`; all use the same production registry, meaning catalogue, validator and runtime.
For the full character workflow, start with the
[coach creation guide](../../../../../docs/COACH_CREATION_GUIDE.md). This page
covers reproducible recordings and generated mouth timing; the
[audio quality standard](../../../../../docs/AUDIO.md#spoken-quality-standard)
defines the editorial and listening bar.

`manifest.json` identifies the approved non-lesson speech, exact text, voice,
recording settings and asset paths. Four original contrast recordings are referenced
in place; the others live under `recordings/walter`, `recordings/walter-language-v2`
and the versioned `recordings/walter-pilot-v1` and `recordings/walter-lessons-v1`
collections. The shared registry also points to Rivet's sibling
bank under `../banks/rivet`; the same validator and runtime handle both.
Recording sidecars retain the
provider request and source-audio fingerprints. Production never calls a speech
provider or an aligner.

`alignment/<id>.json` contains each original recording/script fingerprint,
automatic phone timing, pinned decoder/model configuration and mouth mapping.
These full authoring archives are not imported by the runtime. `tracks.json` is
the generated compact runtime projection: an object keyed by recording ID with
`durationSeconds` and semantic `{start,end,shape}` cues. Do not edit either output
by hand.

## Revisions and archives

`revisions/walter-language-v2.json` and `revisions/walter-pilot-v1.json` are
Walter's script-change ledgers, and Rivet's live in
[wording-v2](../banks/rivet/revisions/wording-v2.json) and
[wording-v3](../banks/rivet/revisions/wording-v3.json). Each records old and new
text with an editorial reason; the active manifest and authored script files hold
the current text. Engine comparison never promises survival in a lost position,
and a demonstrated capture does not alone prove net material gain.

The Audio Studio's **Walter wording** panel compares original/revised text,
audio and mouth timing. Its archived v1 manifest and compact tracks live in
`revisions/`; full original alignments are under `revisions/walter-language-v1-alignment`
and superseded MP3s and provenance under `../recordings/walter-language-v1`.
These archives are excluded from the production media imports. Earlier recording
plans and script inventories describe the original audit, not the active
revision; do not overwrite them to match a newly recorded script. Superseded
recordings of other banks stay in Git history rather than under production asset
globs.

`../banks/pilot-additions.json` holds Walter's and Rivet's authored scripts for the
shared additions to their base banks (opening variants, the game-review opener,
grade takes and piece variants).

## Cast banks

Every other coach has a registered production bank under `banks/<voice>` built
from its own `scripts.json`, recorded with the coach's locked voice from
`cast-auditions/locked-voices.json`, `eleven_v4` and the shared settings. Each
owns its full authored text instead of adding columns to the Walter/Rivet files;
the manifest records exactly those scripts. All 30 banks cover the 195 catalogue
meanings (185 non-lesson meanings, the game-review opener and nine lesson prompts).
The catalogue has no Maia meanings and no clock observations.

Plain clips also play on the opponent's moves, so reactions there must not
assume the learner moved. A bank's `revisions/side-neutral-v1.json` lists lines
reworded for that, with their previous text.

Forced alignment accepts the weak form of "have" in "would have" as recorded
`reducedForms` evidence. Interjections the dictionary lacks go in the short
reviewed lexicon `speech_pronunciation.LEXICON`; new inflections and compounds go
in the morphology rules. `backend/tests/test_coach_bank_scripts.py` checks
catalogue coverage, the spoken-text rules (including that the question-free
personalities ask none aloud) and that each registered manifest matches its
scripts.

A character review approving scripts for recording is not the owner's recording
approval.

## Adding or revising a production bank

All paths below are relative to `frontend/src/audio/speech`, unless stated
otherwise. These are deliberate authoring steps; there is no command that
automatically writes a finished personality or turns all coach prose into speech.

1. **Confirm the voice and permissions.** A casting preview, a saved provider
   voice and a complete production bank are different artifacts. A non-Walter
   registered bank must match its owner-approved `savedVoiceId` in
   `cast-auditions/locked-voices.json`. Walter uses `walter-selected-voice.json`.
   Preserve the approved source identity; do not invent a lock entry for an
   unheard voice. Follow the [cast voice locks](../../../../../docs/AUDIO.md#cast-voice-locks) and
   [media notice](../README.md#permissions-and-attribution). Recheck provider
   terms for new paid generation; do not treat historical approval as a license
   for a different voice or subscription tier.
2. **Audit the supported meanings before writing.** `meanings.json` owns shared
   IDs/groups, not character-specific prose. It has no Maia meanings: coaches
   never voice a Maia reading.
   Trace eligibility through `gameSelection.ts`, `practiceSelection.ts`, the
   producer and dialogue claims. Retain cold-practice gates, the four silent
   states and the lesson rule (generic prompts only). New characterization normally changes
   scripts only, not those facts or selection rules. Adding a genuinely new
   semantic meaning needs producer/selector regression coverage.
3. **Write and review complete scripts.** Use the character bible plus the
   spoken quality standard. Preserve the distinction between actual, allowed,
   missed, mover-caused and alternative consequences. Review consecutive
   opening variants as units. Existing Walter/Rivet authoring
   sources are `banks/pilot-additions.json`,
   with `banks/rivet/scripts.json` for Rivet's base meanings; these are curated
   two-character data, not a general automatic script generator. Keep a new
   bank's authored source and consistency tests explicit rather than modifying
   another coach's text fields. Avoid "separate"/"separately" in active speech.
4. **Create bounded plans and record only approved work.** Use the existing
   `scripts/record_coach_speech.mjs` schema with the selected voice and current
   recording settings. Plans allow at most 20 voice/script pairs, 1,000
   characters per script and 10,000 characters total. Dry-run first; `--generate`
   explicitly spends provider credits. Never print or commit the process-only
   API key. Use a new take directory for changed text, inspect failed/incomplete
   attempts, and do not repeat paid requests blindly. The recorder encodes each
   provider MP3 to the banks' Opus before saving and refuses to start if the
   encoder is unavailable; see [encoding](../../../../../docs/AUDIO.md). Preserve
   Opus/provenance pairs and record actual settled provider usage separately from
   character counts. See [recording CLI instructions](../README.md#record-selected-examples).
5. **Bind the exact artifacts in a manifest.** Prefer
   `banks/<voice>/manifest.json`, with active Opus recordings and provenance under its
   `recordings/` directory and `alignment/<meaning-id>.json`. Match the selected
   coach ID, local voice ID, provider voice, model, settings, script, IDs and
   paths exactly. Revisions get an old/new script ledger; changing a transcript
   without new matching audio is invalid. Remove superseded files from active
   recording directories so the production glob does not ship unused audio.
6. **Generate and check mouth timing.** Prepare the manifest with the commands
   below. Fresh alignment archives are generated automatically from the new
   recording and exact text. For a replacement, preserve needed historical
   evidence before removing its superseded archive; the tool deliberately
   rejects a stale archive rather than overwriting it. Do not hand-edit cues or
   transcribe different words merely to make alignment pass.
7. **Register only the intended bank.** Add its coach/voice/manifest mapping to
   `banks/registry.json`. `voiceBank.ts` already discovers
   `banks/*/manifest.json`, `banks/*/tracks.json` and
   `banks/*/recordings/**/*.opus`; keep that layout instead of adding bespoke
   loader code. Game selection and shared playback read the registry. The
   studio's `recordedCoachCatalog.ts` automatically offers selectable coaches
   with recordings. Another coach's voice is never a fallback.
8. **Verify coverage, rendering and listening separately.** The strict check
   below validates every *registered recording*, but deliberately allows a
   partial bank. Compare the bank's IDs against the reachable shared catalogue
   and add/update script-consistency and selection tests before calling it
   complete. All 30 registered banks currently cover all 195 meanings; that number is
   not a substitute for checking the catalogue. Exercise actual game/practice
   playback, late Maia results (shown, never spoken), manual replay, cancellation and cold positions.
   Use Recorded coach comparison in the Audio Studio for editorial/listening
   review and inspect mouth animation at desktop/mobile application sizes.

Ordinary authoring should not require edits to the audio engine, a second speech
hook, or a coach-specific move-selection system. A new art rig still needs the
shared mouth vocabulary and motion/lifecycle integration described in the
[coach guide](../../../../../docs/COACH.md#speaking-articulation).

## Prepare or verify offline

From the repository root:

```powershell
.venv/Scripts/python.exe scripts/prepare_coach_voice_bank.py --generate
.venv/Scripts/python.exe scripts/prepare_coach_voice_bank.py --manifest frontend/src/audio/speech/banks/rivet/manifest.json --generate
.venv/Scripts/python.exe -S scripts/prepare_coach_voice_bank.py --check
```

`--generate` without `--manifest` prepares Walter only. Default `--check`
verifies all registered banks; an explicit manifest checks just that bank and
does not apply the registry's approved-voice/catalogue checks. Use an explicit
manifest while a new bank is unregistered, then run the default strict check
after registration. A successful generation with a nonempty `missing` list is
partial progress, not a ready bank.

Generation uses the optional authoring dependencies documented in the
[alignment preview README](../alignment/README.md). It resumes verified archives
without repeating native alignment. Missing recordings and active recording locks
are reported as incomplete; completed archives remain available for the next run.
`tracks.json` is published atomically only after every manifest entry is present
and valid. Mismatched scripts, voice/settings, hashes, incomplete recording pairs
and stale archives fail instead of being silently accepted or overwritten.

The default check is strict, read-only and standard-library-only. It verifies all registered banks' approved voices, shared meaning IDs and
recordings, source requests, archives and the exact compact projection. A missing
clip or a changed runtime cue fails validation. No native binary, decoder or
network request is needed to check committed files.

## Alignment policy

Generation uses PocketSphinx 5.1.1's public word/phone alignment APIs and the exact
recorded text. Lattice best-path search is disabled for newly generated tracks:
PocketSphinx's phone-state aligner warns that this search can produce impossible
word spans. Both this pinned configuration and the original preview configuration
remain verifiable; an already verified archive is not automatically rewritten.

The bundled CMU dictionary does not include every regular English inflection.
A bounded, shared morphology fallback covers possessives, regular plurals/third
person verbs, `un-`, `-able` and `-al` only when the base word exists in the pinned
dictionary. Each use records the base pronunciation, rule and derived phones in
the archive. Unsupported words still fail with their spellings. These are general
authoring rules, not a dictionary of per-recording fixes or manual mouth timing.
They are deliberately narrower than a general text-to-phoneme model; future
unusual words need an explicit authoring solution rather than invented guesses.

Phone timing and simplified mouth shapes remain estimates. Source provenance and
complete word coverage establish reproducibility, not perfect pronunciation or
perceptual lip sync. The shared artwork/playback system handles expression and
interpolation separately from the generated evidence.

Focused validation:

```powershell
.venv/Scripts/python.exe -m pytest backend/tests/test_speech_alignment.py backend/tests/test_speech_forced_alignment.py backend/tests/test_speech_pronunciation.py backend/tests/test_coach_voice_bank.py backend/tests/test_walter_language_revision.py backend/tests/test_coach_pilot_scripts.py -q
node --test scripts/record_coach_speech.test.mjs
```

From `frontend`, use the checked-in desktop/mobile audio configuration, with
port 5176 free for its managed studio:

```powershell
npx playwright test --config playwright.audio.config.ts voice-registry.spec.ts recorded-coach-comparison.spec.ts coach-speech.spec.ts game-speech-maia-silence.spec.ts
```

Add the producer-level `game-speech-*-policy.spec.ts` coverage when meanings or
selection change;
add the rig/articulation suites when mouth artwork or playback changes. Build
the application and audio studio to verify asset boundaries. These focused
commands are not the full browser suite; choose additional checks from
[Testing](../../../../../docs/TESTING.md) for the actual change, and record what
ran rather than describing all available checks as passed.
