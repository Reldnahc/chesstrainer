# Audio candidates and credits

There are 24 recorded cue slots across Recorded chess, Tabletop and Soft objects,
plus six Try again candidates, derived from 17 sources. The owner chose Soft objects for move/capture/castle/promotion/
mate and Tabletop for check/correct/complete; see [Audio](../../../../docs/AUDIO.md).
Try again has no approved sound and is silent in production. Remaining variants
are audition alternatives. The rejected object/instrument retry clips are removed.
The owner rejected Soft error's electronic texture, including its pitch/pattern
variants. Five new bases use actual recordings: a relay buzzer, a door buzzer,
a misplayed piano note, muted trombone and a falling slide whistle. They retain
their source pitch and speed, with only excerpting, level matching and boundary
fades. The unchanged Soft error remains last as a comparison reference; its
rejected variants are removed.
These are candidates for listening, not owner-approved production sounds.
All rating sounds have been removed.
Some slots reuse a recording with a different excerpt/tail. Neither
recording nor AI generation is attributed to Fieldwork.

The original recordings use **CC0-1.0**, retained in
[CC0-1.0.txt](CC0-1.0.txt). The five new recorded retry sources are also CC0.
The retained Soft error reference uses **CC BY 3.0**, linked below.
Their source titles, authors, licenses and Fieldwork
modifications are also visible in each studio Source disclosure. The assets and
Fieldwork's edits retain those respective terms independently of the application's
source-code license. Verified September 30, 2026.

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
| Signal Electric Mfg. Co. R-68 Morse Practice Buzzer | scruss | [Freesound 687948](https://freesound.org/people/scruss/sounds/687948/) |
| door_buzzzzer.aif | scarfield | [Freesound 52004](https://freesound.org/people/scarfield/sounds/52004/) |
| Piano, C# Octave, Miss-played | VizAion | [Freesound 795602](https://freesound.org/people/VizAion/sounds/795602/) |
| Charlie Brown Style Teacher — author's muted trombone performance | crashoverride6 | [Freesound 146933](https://freesound.org/people/crashoverride6/sounds/146933/) |
| slide whistle.wav | jcookvoice | [Freesound 586529](https://freesound.org/people/jcookvoice/sounds/586529/) |
| Error.wav — previous Soft error reference | LorenzoTheGreat | [Freesound 417794](https://freesound.org/people/LorenzoTheGreat/sounds/417794/) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

Freesound inputs are openly served HQ MP3 previews, not login-required original
downloads. BigSoundBank inputs are downloadable MP3s. WAV output preserves decoded
audio; it does not make lossy input lossless. Exact URLs and input hashes are in
[sources.json](sources.json), alongside every output's attribution, time ranges,
placement offsets, level target, peak ceiling and output hash.

Editing uses excerpts, mono/sample-rate conversion, DC-offset removal, gain
matching and boundary fades. Castling combines two recorded placements.
Fieldwork generates no new oscillator tones. Optional asset/take `playbackRate`,
take `gain`, and asset `fadeInSeconds` authoring fields support relative pitch,
note levels and softened entrances; the current retry set retains source speed
and pitch. `at` places each take on the timeline. Edits are baked into WAVs,
not applied at runtime.
The origin of LorenzoTheGreat's authored UI effect is not described as a physical
recording. Levels stay below 65.01% peak amplitude. Clips have an exact silent tail
and last approximately 0.117–2.056 seconds. The 30 mono 44.1 kHz / 16-bit WAVs total
**2,238,714 bytes**. All 24 non-retry clips and the original Soft error audition
are byte-for-byte unchanged. The six retry auditions last 0.386–1.006 seconds,
target active RMS 0.06–0.07 and cap peaks at 0.35–0.40. Each recipe is explicit in the
manifest, with no extra runtime dependency or synthesis.

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
