# Original chess sound palettes

All 42 sounds were synthesized specifically for this project by
[`scripts/generate_audio.py`](../../../../scripts/generate_audio.py). They contain
no recordings, downloaded samples, external sound libraries, speech, or music.
The synthesis source and generated assets are licensed under GPL-3.0-or-later,
following the repository's original source; see the root `LICENSE` and `NOTICE.md`.

Each palette provides the same 14 cues: `move`, `capture`, `castle`, `promotion`,
`check`, `mate`, `correct`, `retry`, `complete`, `brilliant`, `great`, `miss`,
`mistake`, and `blunder`.

| Palette | Character |
| --- | --- |
| `warm-wood` | Soft noise impacts and damped, inharmonic wooden body resonances. |
| `clean-minimal` | Brief, rounded two-partial clicks with restrained tonal feedback. |
| `soft-digital` | Gentle FM onset, a warm sub-tone, and a quiet fifth shimmer. |

Board sounds stay brief. Related rising intervals mark positive feedback; subdued
falling intervals mark retries and errors. Check uses a close rising interval and
mate uses a neutral descending resolution. No cue assumes the player won a game.
All assets are mono, 22,050 Hz, signed 16-bit PCM WAVs, with durations from 160 to
560 milliseconds and peak amplitude below 45% of full scale. Every sound fades
out to four milliseconds of exact silence. The full collection is under 1 MB.

Regenerate from the repository root with Python 3.12 or later (standard library
only):

```sh
python scripts/generate_audio.py
python scripts/generate_audio.py --check
```

For the repository's Windows environment:

```powershell
.\.venv\Scripts\python.exe scripts/generate_audio.py
.\.venv\Scripts\python.exe scripts/generate_audio.py --check
```

The generator uses fixed SHA-256 seeds for its impact noise and contains no
timestamps or random system entropy. `--check` synthesizes the entire collection
again and compares every byte to the committed assets without modifying them.
