# Walter recorded voice bank

`manifest.json` identifies the approved non-lesson speech, exact text, voice,
recording settings and asset paths. Eight existing recordings are referenced in
place; the rest live under `recordings/walter`. Recording sidecars retain the
provider request and source-audio fingerprints. Production never calls a speech
provider or an aligner.

`alignment/<id>.json` contains each original recording/script fingerprint,
automatic phone timing, pinned decoder/model configuration and mouth mapping.
These full authoring archives are not imported by the runtime. `tracks.json` is
the generated compact runtime projection: an object keyed by recording ID with
`durationSeconds` and semantic `{start,end,shape}` cues. Do not edit either output
by hand.

## Prepare or verify offline

From the repository root:

```powershell
.venv/Scripts/python.exe scripts/prepare_coach_voice_bank.py --generate
.venv/Scripts/python.exe -S scripts/prepare_coach_voice_bank.py --check
```

Generation uses the optional authoring dependencies documented in the
[alignment preview README](../alignment/README.md). It resumes verified archives
without repeating native alignment. Missing recordings and active recording locks
are reported as incomplete; completed archives remain available for the next run.
`tracks.json` is published atomically only after every manifest entry is present
and valid. Mismatched scripts, voice/settings, hashes, incomplete recording pairs
and stale archives fail instead of being silently accepted or overwritten.

The default check is strict, read-only and standard-library-only. It verifies all
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
.venv/Scripts/python.exe -m pytest backend/tests/test_speech_alignment.py backend/tests/test_speech_forced_alignment.py backend/tests/test_speech_pronunciation.py backend/tests/test_coach_voice_bank.py -q
```
