# Recorded audio candidates

These are edits of real recordings, replacing the rejected procedural palettes.
There are 42 cue slots across Recorded chess, Tabletop and Soft objects, derived
from 11 sources. They are offered for owner audition, not approved final sound
design. Some slots reuse a recording with a different excerpt/tail. Neither
recording nor AI generation is attributed to Fieldwork.

All source pages declare **CC0-1.0**. The full dedication is in
[CC0-1.0.txt](CC0-1.0.txt); these assets keep that dedication independently of the
application's source-code license. Attribution is retained even though CC0 does
not require it. Verified September 30, 2026.

| Recording | Creator | Publisher / license evidence |
| --- | --- | --- |
| Piece Placement | el_boss | [Freesound 546119](https://freesound.org/people/el_boss/sounds/546119/) |
| Piece Capture | el_boss | [Freesound 546120](https://freesound.org/people/el_boss/sounds/546120/) |
| Chess pieces | simone_ds | [Freesound 366065](https://freesound.org/people/simone_ds/sounds/366065/) |
| Board Game Pieces | taure | [Freesound 555190](https://freesound.org/people/taure/sounds/555190/) |
| Moving piece on a boardgame | zachrau | [Freesound 556387](https://freesound.org/people/zachrau/sounds/556387/) |
| Bronze bell #8 | Pierre SIBANARCO | [BigSoundBank 2710](https://bigsoundbank.com/bronze-bell-8-s2710.html) |
| Gong, sweet | Joseph SARDIN | [BigSoundBank 1482](https://bigsoundbank.com/gong-sweet-s1482.html) |
| Block Meinl in wood | Joseph SARDIN | [BigSoundBank 0466](https://bigsoundbank.com/block-meinl-in-wood-s0466.html) |
| Music box, C #1 | Joseph SARDIN | [BigSoundBank 1867](https://bigsoundbank.com/music-box-c-1-s1867.html) |
| Triangle #3 | Joseph SARDIN | [BigSoundBank 1689](https://bigsoundbank.com/triangle-3-s1689.html) |
| Cheers, Champagne Flute #1 | Joseph SARDIN | [BigSoundBank 1335](https://bigsoundbank.com/cheers-champagne-flute-1-s1335.html) |

Freesound inputs are openly served HQ MP3 previews, not login-required original
downloads. BigSoundBank inputs are downloadable MP3s. WAV output preserves decoded
audio; it does not make lossy input lossless. Exact URLs and input hashes are in
[sources.json](sources.json), alongside every output's attribution, time ranges,
placement offsets, level target, peak ceiling and output hash.

Editing uses excerpts, mono/sample-rate conversion, DC-offset removal, gain
matching and boundary fades. Castling combines two recorded placements; Tabletop
blunder combines two wood-block hits. No oscillators, synthesized noise, pitch
shifting or game rips are used. Levels stay below 65.01% peak amplitude. Clips have
an exact silent tail and last approximately 0.117–2.056 seconds. The 42 mono
44.1 kHz / 16-bit WAVs total **3,051,748 bytes**. Listening preferences remain
subjective and are left for the owner in the studio.

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
