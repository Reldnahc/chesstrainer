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
collections. (The `walter-maia-v2` and `walter-pronunciation-v1` takes were all
Maia passages and left with the 2026-10-02 Maia removal.) The shared registry also points to Rivet's sibling
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

## Walter wording revision

`revisions/walter-language-v2.json` records the 81 reviewed script changes,
including every original “continuation” passage. That revision left the other 100 recordings
unchanged. The selected voice, recording settings, supported meanings and
non-lesson scope remain the same. Five bounded `plans/walter-language-v2-*.json`
files preserve the successful recording requests: 7,524 input characters and
907 settled provider credits, with no retakes. All 81 replacements received
automatic mouth timing through the existing generator.

The Audio Studio's **Walter wording** panel compares original/revised text,
audio and mouth timing. Its archived v1 manifest and compact tracks live in
`revisions/`; full original alignments are under `revisions/walter-language-v1-alignment`.
Superseded bank MP3s and provenance moved to `../recordings/walter-language-v1`;
the three superseded original contrasts retain their historical locations, as does the
retired Maia contrast `human-unusual-strong`, which no longer ships.
These archives preserve source hashes and exact generation history. They are
excluded from the production media imports. Earlier recording plans and script
inventories describe the original audit, not the active revision; do not overwrite
them to match a newly recorded script.

The subsequent `revisions/walter-pilot-v1.json` records two further corrections:
engine comparison does not promise survival in a lost position, and a demonstrated
capture does not alone prove net material gain. The bank also adds eleven opening
variants and fourteen whole objective/human-evidence combinations, for 206 active
meanings shared with Rivet. `../banks/pilot-additions.json` holds both characters'
authored scripts for those additions.

A later `maia-combinations.json` extended that pilot with 232 more combined
passages per character, for 438 non-lesson meanings: the original 181, eleven
opening variants and 246 objective/human-evidence combinations.

**Maia is no longer spoken (owner decision, 2026-10-02).** Coaches never voice a
Maia (human-move model) reading. The Maia badge, its popup and the written bubble
sentence are unchanged. The 253 Maia meanings (the seven standalone `human-*`
readings and all 246 objective/Maia combinations, including the pilot's fourteen)
were removed from `../meanings.json`, every `scripts.json`, `pilot-additions.json`
and the five recorded banks, together with their clips, provenance and alignments;
`maia-combinations.json` was deleted. Git history keeps them. The catalogue now
has **195 meanings**: 174 of the original 181, eleven opening variants, the
game-review opener and nine lesson prompts.

Rivet's [wording revision](../banks/rivet/revisions/wording-v2.json) reviewed all
257 additions, replaced 197 complete recordings and retained 60 additions plus
all 181 original recordings. The revision restores his compact pattern-first
voice without changing supported meanings or Walter's scripts. The active
manifest and matching authored script files contain the current text; the
revision ledger records old/new text and editorial reasons. Superseded Rivet
recordings are preserved by Git history rather than left under production asset globs.
The later [distinct-voice revision](../banks/rivet/revisions/wording-v3.json) replaced 294 more
recordings whose wording matched Walter's or another coach's, using the same
ledger format and workflow.

## Winston and Button banks

Winston (`banks/winston`, coach `capybara`, locked voice "Welsh companion") and
Button (`banks/button`, coach `mushroom`, locked voice "Woody contralto") are
registered production banks covering all 195 catalogue meanings. Each owns its
full authored text in `scripts.json` instead of adding
columns to the Walter/Rivet files; the manifest records exactly those scripts.
`backend/tests/test_coach_bank_scripts.py` checks catalogue coverage, the
spoken-text rules and that each registered manifest matches its scripts.

Both were recorded in one pass of 44 bounded plans (22 per coach, 120,354 input
characters) with `eleven_v4` and the Walter/Rivet settings, under
`recordings/<voice>-v1/`. ElevenLabs history billed 14,551 credits (0.121 per character)
during the Eleven v4 launch discount. Their scripts needed regular `-ed`/`-ing`
inflections ("castled", "castling", "reloading"), now covered by morphology
revision v2; earlier archives keep revision v1.

Plain clips also play on the opponent's moves, so reactions there must not
assume the learner moved. `revisions/side-neutral-v1.json` in each bank lists the
reworded lines, three for Button and three for Winston, with their previous text.
They were re-recorded with the same voices and settings under
`recordings/<voice>-v2/`, and `scripts.json` and the manifest carry the new text.

## Arjun bank

Arjun (`banks/arjun`, coach `man-partner`, locked voice "Chennai club mentor") is
a registered production bank covering all 195 catalogue meanings, including the
game-review opener and lesson prompts, from his own `scripts.json`. It was recorded
on October 2 in 23 bounded plans (57,994 input characters) with `eleven_v4` and the
shared settings, under `recordings/arjun-v1/`. ElevenLabs history billed
7,024 credits for the 448 matched request IDs (before the Maia removal); one request timed out uncharged and
was made again. His script needed one new inflection ("steadies"), covered by
morphology revision v4's `-ies` plural rule.

## Cast banks recorded October 3

The remaining 25 coaches (Alfie, Bandit, Biscuit, Celeste, Ember, Felix, Femi,
Fergus, Ingrid, Jun, Juniper, Marisol, Mateo, Monty, Orin, Percy, Pickle, Pip,
Réka, Scout, Tala, Tamar, Waffles, Wisp and Ziggy) are registered production banks
built from their own `scripts.json`, covering all 195 catalogue meanings, under
`recordings/<voice>-v1/`. They were recorded on October 3 with each coach's locked
voice from `cast-auditions/locked-voices.json`, `eleven_v4` and the shared
settings: 250 bounded plans, 4,875 clips and 443,642 input characters. The
recorder refused retired Maia meanings, so none were bought. The account's usage
rose by **53,712 credits** for the run, which includes a few retakes and two
rate-limited batches that were redone. Every manifest request ID matched the
provider history. Alfie and Percy each have one line under `retake-2/` where the
first take ran "would have" together; forced alignment now also accepts that weak
form of "have" as recorded `reducedForms` evidence. The scripts needed morphology
revision v5 for a few compounds and inflections, plus a short reviewed lexicon of
interjections (`speech_pronunciation.LEXICON`). `backend/tests/test_coach_bank_scripts.py`
checks catalogue coverage, the spoken-text rules (including that the
question-free personalities ask none aloud) and that each registered manifest
matches its scripts.

### Bank status

One row per coach whose scripts have been authored for a production bank.
"Review passed" means the character review approved the scripts for
recording; it is not the owner's recording approval. Add a row when a coach's
scripts pass review, and record the commits once the bank is recorded and
registered.

| Coach (id) | Scripts | Review passed | Recorded | Registered |
|---|---|---|---|---|
| Winston (`capybara`) | Written, 195 | Yes, 2026-10-02, at commits `ad56063`/`4cddfc5` | Yes, `32abf9c` | Yes, `12a01f7` |
| Button (`mushroom`) | Written, 195 | Yes, 2026-10-02, at commits `ad56063`/`4cddfc5` | Yes, `83dd5df` | Yes, `12a01f7` |
| Wisp (`ghost`) | Written, 195 | Yes, 2026-10-02, at commit `6b2f07b` | Yes, 2026-10-03, `9fe6d54` | Yes, `9fe6d54` |
| Pip (`slime`) | Written, 195 | Yes, 2026-10-02, at commit `7e07eff` | Yes, 2026-10-03, `5f18e4a` | Yes, `5f18e4a` |
| Ziggy (`alien`) | Written, 195 | Yes, 2026-10-02, at commit `a0a9881` | Yes, 2026-10-03, `f16a0e8` | Yes, `f16a0e8` |
| Percy (`living-pawn`) | Written, 195 | Yes, 2026-10-02, at commit `7e07eff` | Yes, 2026-10-03, `752fc87` | Yes, `752fc87` |
| Orin (`wizard`) | Written, 195 | Yes, 2026-10-02, at commit `f9e8a4f` | Yes, 2026-10-03, `08cc04c` | Yes, `08cc04c` |
| Felix (`cat-tuxedo`) | Written, 195 | Yes, 2026-10-02, at commit `5669e4e` | Yes, 2026-10-03, `48c9717` | Yes, `48c9717` |
| Bandit (`raccoon`) | Written, 195 | Yes, 2026-10-02, at commit `7e07eff` | Yes, 2026-10-03, `a18cc62` | Yes, `a18cc62` |
| Alfie (`dog-gentle`) | Written, 195 | Yes, 2026-10-02, at commit `5b3a4af` | Yes, 2026-10-03, `642e7c4` | Yes, `642e7c4` |
| Pickle (`cat-kitten`) | Written, 195 | Yes, 2026-10-02, at commit `7e07eff` | Yes, 2026-10-03, `8e0c112` | Yes, `8e0c112` |
| Ember (`dragon`) | Written, 195 | Yes, 2026-10-02, at commit `ee90487` | Yes, 2026-10-03, `1cb4ae7` | Yes, `1cb4ae7` |
| Scout (`dog-collie`) | Written, 195 | Yes, 2026-10-02, at commit `3354f70` | Yes, 2026-10-03, `8d554a0` | Yes, `8d554a0` |
| Juniper (`cat-black`) | Written, 195 | Yes, 2026-10-02, at commit `38d3920` | Yes, 2026-10-03, `5417767` | Yes, `5417767` |
| Waffles (`dog-corgi`) | Written, 195 | Yes, 2026-10-02, at commit `49dd577` | Yes, 2026-10-03, `87512d8` | Yes, `87512d8` |
| Celeste (`unicorn`) | Written, 195 | Yes, 2026-10-02, at commit `eddc967` | Yes, 2026-10-03, `38e86a8` | Yes, `38e86a8` |
| Jun (`man-expert`) | Written, 195 | Yes, 2026-10-02, at commit `e32c28f` | Yes, 2026-10-03, `1344220` | Yes, `1344220` |
| Fergus (`frog`) | Written, 195 | Yes, 2026-10-02, at commit `b2e5e45` | Yes, 2026-10-03, `f973435` | Yes, `f973435` |
| Arjun (`man-partner`) | Written, 195 | Yes, 2026-10-02, at commit `91cda3c` | Yes, 2026-10-02 | Yes, 2026-10-02 |
| Femi (`man-host`) | Written, 195 | Yes, 2026-10-02, at commit `8ef13cd` | Yes, 2026-10-03, `22ae506` | Yes, `22ae506` |
| Marisol (`woman-analyst`) | Written, 195 | Yes, 2026-10-02, at commit `0ca83fa` | Yes, 2026-10-03, `cae6ea2` | Yes, `cae6ea2` |
| Monty (`gorilla`) | Written, 195 | Yes, 2026-10-02, at commit `6de6a66` | Yes, 2026-10-03, `bde6d38` | Yes, `bde6d38` |
| Ingrid (`woman-blonde`) | Written, 195 | Yes, 2026-10-02, at commit `5268032` | Yes, 2026-10-03, `3254fd1` | Yes, `3254fd1` |
| Biscuit (`dog-puppy`) | Written, 195 | Yes, 2026-10-02, at commit `abd5405` | Yes, 2026-10-03, `ec18ba8` | Yes, `ec18ba8` |
| Réka (`woman-spark`) | Written, 195 | Yes, 2026-10-02, at commit `bbef4b3` | Yes, 2026-10-03, `fc041fe` | Yes, `fc041fe` |
| Mateo (`human-boy`) | Written, 195 | Yes, 2026-10-02, at commit `8907d2e` | Yes, 2026-10-03, `bf75fab` | Yes, `bf75fab` |
| Tamar (`woman-captain`) | Written, 195 | Yes, 2026-10-02, at commit `129a272` | Yes, 2026-10-03, `8e72ed6` | Yes, `8e72ed6` |
| Tala (`human-girl`) | Written, 195 | Yes, 2026-10-02, at commit `ed96ae2` | Yes, 2026-10-03, `c900a47` | Yes, `c900a47` |
| Game review opener (`game-review-opened`), all 30 coaches | Written, 1 each | Yes, 2026-10-02, at commit `d8bbadb` | Yes, all 30 | Yes, all 30 |
| Lesson prompts (`lessons` group), coaches 1–10 (Alfie to Fergus) | Written, 9 each | Yes, 2026-10-02, at commit `88b9b84` | Yes | Yes |
| Lesson prompts (`lessons` group), coaches 11–20 (Ingrid to Pip) | Written, 9 each | Yes, 2026-10-02, at commit `899fc94` | Yes | Yes |
| Lesson prompts (`lessons` group), coaches 21–30 (Réka to Ziggy) | Written, 9 each | Yes, 2026-10-02, at commit `b19c358` | Yes | Yes |

The opener row is a cast-wide meaning added after the banks above. Walter's and
Rivet's lines sit in `banks/pilot-additions.json`.

The script counts were 438 when those reviews passed. On 2026-10-02 the 253 Maia
rows were removed (see above), leaving 195 rows per coach (185 non-lesson
meanings, the opener and nine lesson prompts); the remaining rows' review status is
unchanged. All 30 coaches now have 195 recordings each.

The lesson-prompt rows cover the nine generic `lessons` meanings. Each batch of
coaches adds its own row as it lands; a coach's lesson lines stay silent until
they are recorded. With coaches 21–30 in, all 30 coaches have their lesson lines
written, and all of them are recorded.

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
