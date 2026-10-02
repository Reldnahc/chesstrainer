# Automatic lip-sync preview data

Two offline generators use the same existing Walter **Sound sacrifice** and
**Allowed checkmate** recordings. The audio studio comparison uses identical
mouth artwork, playback smoothing and audio for both sides. These are development
experiments, not approved timing for the full voice library. No script, recording
or individual mouth-cue boundary was manually corrected.

- `sound-sacrifice.json` / `allowed-mate.json`: the unchanged first Rhubarb output.
- `*-forced.json`: exact-transcript phone alignment and a shared automatic mapping.

## Revised generator

Pinned [PocketSphinx 5.1.1](https://pocketsphinx.readthedocs.io/en/latest/pocketsphinx.html#pocketsphinx.Decoder.set_alignment)
uses its public `set_align_text` word pass, then `set_alignment` phone pass. It
aligns the known recording script instead of merely using the text as recognition
hints. The generated evidence retains every native word and phone's integer
start/duration frames, including silence and dictionary pronunciation variants.
Only punctuation/case is normalized; unknown dictionary words, digits, SAN,
unsupported spelling, missing words, unknown phones and malformed spans fail.

The larger [production bank](../bank/README.md) exposed two authoring limits after
this preview was saved. New generation disables lattice best-path search so the
word spans remain compatible with the phone-state pass, and uses bounded regular
English morphology for missing dictionary inflections. Each such pronunciation
records its dictionary base and generic rule. Both original and current pinned
decoder profiles remain verifiable; these original preview tracks are retained
unchanged. Arbitrary unknown words still fail rather than being dropped.

`scripts/speech_forced_alignment.py` maps all 39 standard CMU ARPAbet phones plus
silence into the existing A–H/X mouth vocabulary. Bilabial P/B/M sounds close the
lips; F/V use the lip-bite shape, L the tongue shape, and vowels use open, rounded
or puckered shapes. A general diphthong rule uses two shapes only when each part
can last at least 40 ms; shorter phones keep their first shape. Equal adjacent
shapes merge. Original phone boundaries remain unchanged; no recording-specific
overrides, offsets, hand corrections or generated micro-shapes are introduced.
At most two unmodeled final analysis frames become rest, never an extended last
phoneme. Preview duration uses hundredths of a second, matching the first
generator's timeline; neither existing recording loses any audio.

The first experiment often collapsed adjacent syllables into one B shape. The
revised Sound sacrifice track has 65 cues instead of 47, and Allowed checkmate has
55 instead of 46. More cues alone are not a quality metric: judge the comparison
on audible syllables, lip closure, silence and naturalness at UI size.

Forced alignment still estimates timing. Exact word coverage is required by the
transcript and is **not** proof that each phone boundary or selected dictionary
pronunciation matches the performance. Initial phones can absorb a little leading
quiet; natural coarticulation is simplified into nine shapes. Those limitations
remain visible rather than hidden with per-clip edits.

## Provenance and offline reproduction

Each JSON retains the recording's path, SHA-256 and size, exact plan text and its
UTF-8 SHA-256, decoder/conversion details and a cue fingerprint. Forced tracks also
retain exact model/dictionary file hashes, the complete path-normalized decoder
configuration and its hash, 16 kHz resampling metadata, raw word/phone frames and
their hash, and versioned mapping rules. `--check` rederives every revised cue from
the saved phone evidence; updating a cue's hash alone cannot hide a hand edit.

The optional authoring environment is Python 3.12, NumPy 2.2.6, SoundFile 0.13.1
with libsndfile 1.2.2, and PocketSphinx 5.1.1. SoundFile/NumPy live under ignored
`.tools/audio-authoring`; PocketSphinx's packaged US-English model/dictionary live
under `.tools/phoneme-authoring`. These dependencies, model files and temporary
WAVs never enter application requirements, builds, Docker or normal playback.
Generation does not download anything or call a provider.

From the repository root, after the optional packages are locally installed:

```powershell
.venv/Scripts/python.exe scripts/align_coach_speech.py --generate
.venv/Scripts/python.exe -S scripts/align_coach_speech.py --check
.venv/Scripts/python.exe -m pytest backend/tests/test_speech_alignment.py backend/tests/test_speech_forced_alignment.py -q
```

`--generate` defaults to `--method forced`. The committed Opus recording is decoded without
trimming or gain changes into mono PCM16 at its original rate. Python 3.12's
`audioop.ratecv` resamples only the analysis input to 16 kHz with its documented
default weights; its exact PCM hash/frame count is retained. Original audio plays
unaltered. Native alignment runs in a subprocess with a 180-second limit per clip.
Both clips must pass validation before either committed track is replaced.
`--audio-deps`, `--phoneme-deps` and `--work-dir` accept local paths; scratch files
must remain under ignored `.tools`. No optional package is needed for `--check`,
which validates all four tracks using only the standard library.

### Reproduce the unchanged first generator

The [official Rhubarb 1.14.0 documentation](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/v1.14.0/README.adoc)
defines the A–H/X shapes, English `pocketSphinx` recognition, dialog-text hints and
JSON cues. The retained first tracks keep its native values and centisecond
duration. This method recognizes speech with transcript hints; it does not force
every known word into the audio.

Use the [official Windows 1.14.0 release](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/Rhubarb-Lip-Sync-1.14.0-Windows.zip)
under `.tools/rhubarb-1.14.0/`. ZIP SHA-256:
`62fa416a8d5e382a3828ee4bef358ce520d0b4cabdeaea75a7ac266d098d1fe3`.
The script pins executable and recognition-resource hashes. Keep the complete
release including `res/`; `--rhubarb` can select its local executable.

```powershell
.venv/Scripts/python.exe scripts/align_coach_speech.py --generate --method rhubarb
```

This explicit method reproduces only the two original tracks, with `--recognizer
pocketSphinx --exportFormat json --extendedShapes GHX --threads 1` and the exact
script as `--dialogFile`. Original WAV analysis stays at its source sample rate.
Both generators retain native scratch evidence only under `.tools/speech-alignment`.
