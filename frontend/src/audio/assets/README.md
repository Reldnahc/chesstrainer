# Approved audio and credits

Only the **nine owner-approved sounds** are bundled:

| Cues | Recording set |
| --- | --- |
| Move, capture, castle, promotion, checkmate | Soft objects |
| Check, correct answer, completion | Tabletop |
| Try again | Muted tongue drum (original audition 13) |

These WAVs are byte-for-byte unchanged from their auditioned versions. Unselected
sounds, recipes and source records have been removed; earlier auditions remain in
Git history. No rating sounds are included. The standalone audio studio previews
the approved set individually and in board/practice contexts. It uses the same
production defaults and never changes account preferences.

## Attribution

The six retained source recordings use CC0. Source pages and licenses were checked
September 30, 2026. The studio Source disclosure names each recording, its author,
source and license, with Fieldwork's edits listed separately. Audio and edits
retain their CC0 terms independently of the application's source-code license.
Complete text is retained in [CC0-1.0.txt](CC0-1.0.txt).

| Recording | Creator | Publisher / license |
| --- | --- | --- |
| Chess pieces | simone_ds | [Source](https://freesound.org/people/simone_ds/sounds/366065/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Bronze bell #8 | Pierre SIBANARCO | [Source](https://bigsoundbank.com/bronze-bell-8-s2710.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Music box, C #1 | Joseph SARDIN | [Source](https://bigsoundbank.com/music-box-c-1-s1867.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Triangle #3 | Joseph SARDIN | [Source](https://bigsoundbank.com/triangle-3-s1689.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Cheers, Champagne Flute #1 | Joseph SARDIN | [Source](https://bigsoundbank.com/cheers-champagne-flute-1-s1335.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| G3 - steel tongue drum | hollandm | [Source](https://freesound.org/people/hollandm/sounds/692568/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

Freesound inputs are openly served HQ MP3 previews, not login-required original
downloads. BigSoundBank inputs are downloadable MP3s. WAV conversion does not
recover information removed by lossy encoding. [sources.json](sources.json)
pins input/output hashes, credits and recipes, including each excerpt, offset,
gain, fade and level target. Edits use mono/sample-rate conversion, DC-offset
removal, level matching and boundary fades. Castling pairs two recorded hits.
The approved Try again sound retains original speed and pitch.

The nine mono 44.1kHz / 16-bit WAVs total **765,450 bytes**. Approved levels and
zero-valued tails are unchanged. There are no runtime effects or authoring
dependencies in Docker, and normal build/playback never contacts a sound provider.
Numeric and browser checks establish technical behavior, not auditory preference.

## Verify or reproduce

Offline verification requires Python 3.12+ standard library only:

```sh
python scripts/prepare_audio.py --check
```

Optional authoring uses NumPy 2.2.6 and SoundFile 0.13.1. Install these in a
separate temporary environment; they are not app/Docker dependencies:

```sh
python -m venv .tools/audio-authoring-env
# Activate that environment using the command appropriate for your shell.
python -m pip install numpy==2.2.6 soundfile==0.13.1
python scripts/prepare_audio.py --prepare --fetch
```

`--fetch` explicitly acquires absent sources into ignored `.tools/audio-sources`.
Every input must match its recorded hash. Omit `--fetch` for cached/offline work.
Every prepared output must match its hash before any output is written. Decoder
differences may produce a mismatch: investigate rather than silently accepting it.
For an intentional, reviewed recipe change, `--prepare --update-hashes` updates
outputs and manifest. Review both together. No package install, download or
authoring step runs during normal frontend builds or playback.
