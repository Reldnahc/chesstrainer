# Audio

Fieldwork uses one browser audio service for board moves and practice feedback.
Audio is presentation only: it never grades a move,
advances a session, changes the engine budget or infers a tactic from the board.
The bundled selection is the owner's mixed recording set, listed below. The
separate audition studio remains available for comparing sounds. The original
procedurally synthesized audition sets were rejected and have been removed.

## Controls and defaults

**Settings → Coach & sound → Sound** contains the master switch, volume,
board/practice switches and an explicit test button. Defaults are sound
enabled, volume 35%, and board and practice enabled.
Account preferences use the existing owned `user_preferences` row, including the
reserved local user. A failed initial preference load keeps audio silent until
retried. Audio changes do not overwrite coach or motion choices.

The shared board workspace has a quick mute control. It applies to the current
account on this browser/device, persists locally, and synchronizes across tabs
through the storage event. It does not change the account's sound settings on
other devices. Stored mute is an enhancement; if browser storage is unavailable,
mute still works for the current page.

Audio is independent of both animation settings and reduced motion. Browser
autoplay permission is separate from Fieldwork preferences: the service unlocks
from a trusted interaction, remains silent if blocked, and never queues blocked
sounds to surprise the user later. Hidden tabs stop playback. Reopening a tab
does not replay missed events. All feedback remains understandable without sound.

## Selected sounds

| Cues | Owner's selection |
| --- | --- |
| Move, capture, castle, promotion, checkmate | Soft objects |
| Check, correct answer, completion | Tabletop |
| Try again | Silent; none of the audition candidates was approved |

`productionCuePalettes` is the single per-cue default mapping. A null selection
suppresses playback before a download or timer is created. The studio can
explicitly audition a different candidate without changing production choices.
Ratings never have sounds: their cue types, emitters, assets, settings and saved
preference have been removed. The forward database migration drops only the
retired `audio_review` column and preserves remaining account preferences.

## Cue policy

| Cue | Meaning |
| --- | --- |
| Move / capture / castle / promotion | One committed or explicitly inspected board move |
| Check / mate | The server-supplied move notation contains check/checkmate; these take precedence over ordinary placement |
| Correct | The current practice attempt was accepted by its existing answer authority |
| Retry | A rejected practice attempt; reserved semantic cue, currently silent |
| Complete | A puzzle or lesson has just completed; replaces the ordinary correct cue |

No move classification triggers a sound. Checkmate in a
historical game has a neutral finish, rather than implying the learner won.
Revealing an answer plays the board cue without a success reward. A correct
opening rehearsal is an accepted authored answer, not a claim of objective Best.

Game review navigation emits only on deliberate actions. A single forward step
uses the server SAN; backward or multi-ply jumps use a neutral placement. Timeline
dragging is silent until release, with at most one neutral cue; cancellation does
not commit a sound. Initial loads, page reloads, board flips, return-to-game,
background refinement and analysis polling are silent. An uncached variation
step sounds only after its matching position response is accepted; failed or
superseded navigation stays silent. Completed variation analysis is silent.

Study playback sounds track explicitly displayed frames. Still mode collapses a
continuation to the visible final move without a burst of skipped sounds. Reset,
retry, navigation and unmount cancel queued audio. Saved feedback restored by GET
never counts as a fresh attempt. Cold practice emits no answer/evaluation hints
before an attempt or reveal permits feedback.

## Ownership and lifecycle

- `frontend/src/audio/model.ts` owns semantic cue, preference and prepared-speech
  types. `cueForMove` interprets canonical server SAN, not FEN or local chess rules.
- `catalog.ts` owns cue categories, priorities, approved production choices,
  palette metadata, per-cue candidate availability and asset URLs. Engine,
  studio and stored selections all validate cue/candidate pairs against it.
- `engine.ts` owns a lazily created Web Audio context, decoded asset cache, master
  gain, separate effects/speech buses, bounded playback, short cancellation fades,
  duplicate suppression, visibility and disposal. Suppressed requests are dropped.
- `AudioProvider.tsx` lives inside the existing account boundary and reuses
  `useSavedPreferences`. `useAudioScope` gives session hooks stable play/move/cancel
  methods and cancels their work on scope changes or unmount. The Board and coach
  artwork do not play sounds based on render effects.
- Session command handlers emit feedback after their existing generation guards.
  Display-only playback handlers emit move cues. Explicit replays get fresh event
  identities; deduplication does not globally suppress repeated chess positions.

The current candidates are excerpts of **17 CC0 recordings**: real chess/wooden
pieces, wood block, music box, bronze bell, triangle, glass, a soft gong, cork,
paper, zipper, muted guitar, kalimba and conga.
They are trimmed, level matched and faded; castling combines two recorded hits.
No tones are generated, no pitch is synthesized, and no AI generation is claimed.
The Freesound inputs are public HQ MP3 previews rather than original WAV downloads.
The other inputs are the publisher's downloadable MP3s. Resaving them as WAV does
not restore information removed by MP3 encoding.

`frontend/src/audio/assets/sources.json` records every source, author, license,
input/output hash and exact edit recipe. The asset README and `CC0-1.0.txt` retain
the notices. `scripts/prepare_audio.py --check` verifies assets offline; explicit
authoring can reproduce the edits from hash-checked source files. The 30 candidate
WAVs comprise eight cues in three palettes and six retry-only choices, totaling
approximately **2.17 MB**; some cues share a source recording. Assets are bundled locally, fetched and decoded only
as needed; normal installation/build/playback does not contact a sound provider.
Additional palettes need not change event producers.

## Audition studio

From the repository root:

```sh
npm --prefix frontend run dev:audio
```

Open **http://127.0.0.1:5176**. This is a separate Vite process with no account/API
connection and no production navigation route. It uses the actual audio engine.

- Compare Recorded chess, Tabletop and Soft objects for the eight approved cues.
  Try again has six named choices: Cork pop, Page flick, Short zip, Muted strum,
  Soft kalimba and Conga tap. These replace its rejected original three clips;
  the other clips and their production defaults are unchanged.
- Open a candidate's Source disclosure for its recording, author and CC0 license.
  Approved production choices are listed above; other variants remain audition
  candidates. Exact edit recipes are recorded in the asset manifest.
- Pick a different palette for each cue; picks persist only in studio storage.
  Clear picks resets that audition selection without changing account settings.
- Play short scenarios using one palette or the current mixed selection.
  Unpicked cues use their approved production choice. Try again stays silent
  unless explicitly picked in My picks; it is not available in the three
  general palettes. Engine requests for unavailable pairs never load or schedule.
- Adjust volume, mute, stop or inspect the playback history.
- Copy/download the selected mapping for review and a later deliberate product
  change. Studio selections do not silently alter production account preferences.

Selection storage remains version 2, preserving the owner's eight choices.
Retired retry/palette pairs are discarded independently; a new retry choice
persists without resetting other picks.
Export is version 3 and includes the explicit per-cue production fallback map,
including null for silence. Previous synthetic-set picks cannot silently approve
replacement sounds; old palette IDs and removed rating cues are discarded.

The studio shares application buttons and choice controls but owns its layout.
Its style boundary rejects application/board styles. CI has a dedicated audio
suite; audio-only changes do not require the entire coach artwork matrix.

## Coach speech foundation

`PreparedSpeechClip` accepts an already prepared `AudioBuffer` plus the existing
`CoachUtterance`, scope and event identity. The engine has a cancellable speech
bus, respects priority/interruptibility when replacing speech, and lowers effects
while speech plays. This is an extension point, not a production voice feature.

A future speech adapter owns obtaining a clip and checking whether an utterance
is still current before submitting it. The calling policy decides whether speech
is manual or permitted by `autoSpeakSuitable`. Visible/spoken text remains owned
by dialogue; audio never rewrites chess claims or generates character prose.
There is no TTS provider, voice catalogue, speech setting, automatic narration or
network speech request in this release.

## Verification

Engine tests cover cue precedence, mute/categories, activation failure, duplicates,
delayed and stale decoding, cancellation, hidden tabs, bounded voices, prepared
speech and disposal. Browser tests observe actual Web Audio source starts and
cover the production preference/session/navigation paths without production test
globals. Studio tests exercise real assets, persisted selections and cancellation.
Run the affected application/account suites alongside the dedicated audio suite
when changing integration. See [Testing](TESTING.md) and the dated
[verification record](VERIFICATION.md) for commands and actual results.
