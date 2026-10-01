# Walter recorded voice bank

`manifest.json` identifies the approved non-lesson speech, exact text, voice,
recording settings and asset paths. Five original contrast recordings are referenced
in place; the others live under `recordings/walter`, `recordings/walter-language-v2`
and the versioned `recordings/walter-pilot-v1` and `recordings/walter-maia-v2`
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
the three superseded original contrasts retain their historical locations.
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

`../banks/maia-combinations.json` extends that pilot with 232 more complete
passages per character. The active banks each have 438 meanings: the original
181, eleven opening variants, and 246 objective/human-evidence combinations.
The latter include the pilot's fourteen recordings, which are reused unchanged.
Each combined passage is one provider recording, never playback-time splicing.
Its shared primary/secondary IDs bind the spoken explanation to current rendered
chess evidence and the independently displayed human insight. Full source
provenance and automatically generated mouth timing follow the same workflow.

## Prepare or verify offline

From the repository root:

```powershell
.venv/Scripts/python.exe scripts/prepare_coach_voice_bank.py --generate
.venv/Scripts/python.exe scripts/prepare_coach_voice_bank.py --manifest frontend/src/audio/speech/banks/rivet/manifest.json --generate
.venv/Scripts/python.exe -S scripts/prepare_coach_voice_bank.py --check
```

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
.venv/Scripts/python.exe -m pytest backend/tests/test_speech_alignment.py backend/tests/test_speech_forced_alignment.py backend/tests/test_speech_pronunciation.py backend/tests/test_coach_voice_bank.py backend/tests/test_walter_language_revision.py -q
```
