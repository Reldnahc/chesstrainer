# Audio candidates and credits

The studio contains **27 recorded cue slots**: the 24 original alternatives for
the eight approved cues and three owner-shortlisted Try again auditions.
Original audition numbers and audio are preserved:

| Number | Candidate | Recorded texture | Duration |
| --- | --- | --- | --- |
| 13 | Muted tongue drum | Short rubber-mallet steel-tongue-drum note | 0.526 s |
| 18 | Fret catch | Damped nylon-guitar strings and finger contact | 0.226 s |
| 29 | Wood & damped strings | Muted woodblock followed by cloth-prepared piano | 0.446 s |

All 27 retained WAVs are byte-for-byte unchanged from `6fb6b7c`. The other retry
candidates are removed from the current catalogue and remain in Git history.
The owner's eight production choices remain Soft objects for move/capture/castle/
promotion/mate and Tabletop for check/correct/complete. Retry remains unapproved
and silent in production. No rating sounds are included.

Each finalist can play alone or with the selected **Comparison context**:
One retry (~3 seconds), Repeated attempts (~10 seconds, the default) or Full sound
mix (~10 seconds, including capture/check/success/completion). These use saved
studio choices or approved defaults for the other sounds. Retry and correct
feedback follow moves by 160ms, matching lesson playback. Changing mode, stopping
or starting another audition cancels the prior context. Listening never selects
a finalist or changes account preferences.

## Attribution

The 15 source recordings use CC0 or CC BY 4.0. Source pages and licenses were
checked September 30, 2026. The studio Source disclosure names each distinct
recording, its author, source and license, including both inputs to number 29.
Fieldwork's edits appear separately. Audio and edits retain their respective CC
terms independently of the application's source-code license.
CC0 text is retained in [CC0-1.0.txt](CC0-1.0.txt).

| Recording | Creator | Publisher / license |
| --- | --- | --- |
| Piece Placement | el_boss | [Source](https://freesound.org/people/el_boss/sounds/546119/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Piece Capture | el_boss | [Source](https://freesound.org/people/el_boss/sounds/546120/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Chess pieces | simone_ds | [Source](https://freesound.org/people/simone_ds/sounds/366065/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Board Game Pieces | taure | [Source](https://freesound.org/people/taure/sounds/555190/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Moving piece on a boardgame | zachrau | [Source](https://freesound.org/people/zachrau/sounds/556387/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Bronze bell #8 | Pierre SIBANARCO | [Source](https://bigsoundbank.com/bronze-bell-8-s2710.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Gong, sweet | Joseph SARDIN | [Source](https://bigsoundbank.com/gong-sweet-s1482.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Block Meinl in wood | Joseph SARDIN | [Source](https://bigsoundbank.com/block-meinl-in-wood-s0466.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Music box, C #1 | Joseph SARDIN | [Source](https://bigsoundbank.com/music-box-c-1-s1867.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Triangle #3 | Joseph SARDIN | [Source](https://bigsoundbank.com/triangle-3-s1689.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Cheers, Champagne Flute #1 | Joseph SARDIN | [Source](https://bigsoundbank.com/cheers-champagne-flute-1-s1335.html) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| G3 - steel tongue drum | hollandm | [Source](https://freesound.org/people/hollandm/sounds/692568/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Woodblock-soft.wav | hollandm | [Source](https://freesound.org/people/hollandm/sounds/692828/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Acoustic Guitar - Fret 3.wav | digifishmusic | [Source](https://freesound.org/people/digifishmusic/sounds/49860/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| prepared piano.WAV | Escarielle | [Source](https://freesound.org/people/Escarielle/sounds/394059/) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

Freesound inputs are openly served HQ MP3 previews, not login-required original
downloads. BigSoundBank inputs are downloadable MP3s. WAV conversion does not
recover information removed by lossy encoding. [sources.json](sources.json)
pins input/output hashes, credits and recipes, including each excerpt, offset,
gain, fade and level target. All retained retry excerpts keep original speed
and pitch. Edits use mono/sample-rate conversion, DC-offset removal, level
matching and boundary fades; number 29 layers two CC0 recordings.

The 27 mono 44.1kHz / 16-bit WAVs total **1,999,734 bytes**. The finalists retain
active RMS targets of 0.075, 0.085 and 0.08 respectively, with a 0.40 peak ceiling
and zero-valued tails. The approved sounds retain their original levels.
There are no new oscillator tones, runtime effects or authoring dependencies in
Docker, and normal build/playback never contacts a sound provider. The existing
offline authoring tool supports optional per-take rate/gain and asset fade fields.
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
