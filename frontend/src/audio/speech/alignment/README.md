# Automatic lip-sync preview data

These two tracks are unchanged automatic Rhubarb output for the existing Walter
**Sound sacrifice** and **Allowed checkmate** recordings. They are a development
comparison, not approved timing for the full voice library. No recording, script
or mouth-cue boundary was manually corrected.

The [official Rhubarb 1.14.0 documentation](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/v1.14.0/README.adoc)
defines the `A`–`H` and `X` mouth shapes, English `pocketSphinx` recognition,
dialog-text hints and JSON cue format. Each cue keeps the native `start`, `end`
and `value`; adjacent cues share a boundary. Native duration is truncated to
hundredths of a second. The dialog file helps recognition; this is automatic
speech recognition and animation, not a claim of exact phonetic alignment.

Each JSON track maps its runtime script ID and voice to the original MP3's path,
SHA-256 and byte count, exact plan text and its UTF-8 SHA-256, tool/options and
conversion details. `cueSha256` fingerprints the native cue array serialized as
compact JSON. The imported metadata omits the tool's machine-specific working
path. Source time remains the MP3's decoded timeline: no trimming, resampling,
gain changes or timing offsets.

## Reproduce offline

Use the official [Windows 1.14.0 release](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/Rhubarb-Lip-Sync-1.14.0-Windows.zip),
extracted under `.tools/rhubarb-1.14.0/`. The expected ZIP SHA-256 is
`62fa416a8d5e382a3828ee4bef358ce520d0b4cabdeaea75a7ac266d098d1fe3`.
The authoring script also checks the executable and recognition-resource hashes
before running anything. Keep the complete release together, including `res/`.

The local authoring environment uses Python 3.12, NumPy 2.2.6, SoundFile 0.13.1
and its libsndfile 1.2.2 Windows decoder. SoundFile is installed under the ignored
`.tools/audio-authoring` directory. These are optional developer dependencies;
they are not added to application requirements, builds or Docker.

From the repository root:

```powershell
.venv/Scripts/python.exe scripts/align_coach_speech.py --generate
.venv/Scripts/python.exe scripts/align_coach_speech.py --check
.venv/Scripts/python.exe -m pytest backend/tests/test_speech_alignment.py -q
```

`--generate` decodes the existing MP3 with SoundFile, averages channels if needed,
and writes a complete mono PCM16 WAV at the original sample rate. It feeds the
exact script text to Rhubarb with `--recognizer pocketSphinx --exportFormat json
--extendedShapes GHX --threads 1`. Temporary WAVs, text and raw output stay under
`.tools/speech-alignment/`. Only the two cue/provenance JSON files are replaced.
`--rhubarb`, `--audio-deps` and `--work-dir` can select other local locations;
working files must remain under `.tools` and the tool pin still applies.

`--check` is read-only and uses only the Python standard library. It verifies
source hashes, exact script identity, tool options, conversion metadata and
complete contiguous cue timing. It invokes no native tools or providers.
Hash/timing validity establishes provenance, not perceptual accuracy; the
side-by-side studio preview is where the automatic result is assessed.
