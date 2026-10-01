# Audio

Fieldwork uses one browser audio service for board moves and practice feedback.
Audio is presentation only: it never grades a move,
advances a session, changes the engine budget or infers a tactic from the board.
The bundled selection is the owner's mixed recording set, listed below. The
separate audio studio previews those same sounds in isolation and in context.
Rejected auditions and their selection/export UI have been removed.

## Controls and defaults

**Settings → Sound** contains the master switch, volume,
board/practice switches and an explicit test button. Defaults are sound
enabled, volume 35%, and board and practice enabled. Coach voice defaults to Automatic.
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
| Try again | Muted tongue drum |

All nine cues now have owner-approved sounds. `productionCuePalettes` is the
single per-cue default mapping. A null selection remains supported and suppresses
playback before a download or timer is created. The studio uses these same
defaults without reading or changing account preferences.
Ratings never have sounds: their cue types, emitters, assets, settings and saved
preference have been removed. The forward database migration drops only the
retired `audio_review` column and preserves remaining account preferences.

## Cue policy

| Cue | Meaning |
| --- | --- |
| Move / capture / castle / promotion | One committed or explicitly inspected board move |
| Check / mate | The server-supplied move notation contains check/checkmate; these take precedence over ordinary placement |
| Correct | The current practice attempt was accepted by its existing answer authority |
| Retry | A rejected practice attempt; the approved muted tongue drum follows the attempted move |
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
  palette metadata, per-cue asset availability and asset URLs. Engine and studio
  validate cue/palette pairs against it; each cue has one approved asset.
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

The nine approved WAVs use **six CC0 source recordings**: chess pieces, bronze
bell, music box, triangle, glass and steel tongue drum. They are trimmed, level
matched and faded; castling combines two recorded hits. These are the exact
owner-approved files, with no new DSP or oscillator tones. Unselected recordings
and their unused recipes/credits have been removed from the current tree; earlier
auditions remain in Git history.

The Freesound inputs are public HQ MP3 previews rather than original WAV downloads.
The other inputs are the publisher's downloadable MP3s. Resaving them as WAV does
not restore information removed by MP3 encoding.

`frontend/src/audio/assets/sources.json` records each retained source, author,
license, input/output hash and exact edit recipe. Its license map and asset README
retain attribution alongside `CC0-1.0.txt`. `scripts/prepare_audio.py --check`
verifies assets offline; explicit authoring can reproduce the edits from
hash-checked source files. The nine WAVs total **765,450 bytes** (about 0.77 MB).
Assets are bundled locally, fetched and decoded only as needed; normal
installation/build/playback does not contact a sound provider. Additional
palettes need not change event producers.

## Audio studio

From the repository root:

```sh
npm --prefix frontend run dev:audio
```

Open **http://127.0.0.1:5176**. This is a separate Vite process with no application
account/API connection and no production navigation route. A development-only
endpoint saves casting decisions on the studio host. It uses the actual audio engine
and the same nine approved defaults as the app.

- Play each sound alone; open its Source disclosure for the recording, author,
  edits and license. Exact recipes remain in the asset manifest.
- For Try again, choose **One retry**, **Repeated attempts** (default) or
  **Full sound mix**, then press **In context**. The longer previews repeat
  retries or include capture, check, correct and completion over about ten seconds.
  Retry/correct follow moves by 160ms, matching lesson playback. Switching context
  cancels playback and waits for another press.
- Play short board/practice scenarios with the approved set. Adjust volume,
  mute, stop or inspect playback history. Pending cues remain cancellable and do
  not preload or play early; the engine bounds delayed cues at 15 seconds.

There is no game-sound selection storage or export UI. Obsolete sound-palette
browser data is neither read nor rewritten. Playback never changes account
preferences. The studio shares application buttons and choice controls but owns
its layout. Its style boundary rejects application/board styles. CI has a
dedicated audio suite; audio-only changes do not require the coach artwork matrix.

## Walter's recorded coach voice

Walter (`classic`) has a complete **181-recording non-lesson bank**, using the
owner-selected **Older teacher** voice. The October 1 wording revision replaces
81 passages and retains 100 recordings unchanged. It removes repetitive
“continuation” language while preserving actual, possible, missed and
opponent-opportunity meanings. The revised passages used **7,524 input characters**
and **907 provider credits**; character counts are not billing units. Voice,
delivery settings and the bank's supported meanings are unchanged. No words or
sentence fragments are stitched together.

**Settings → Sound → Coach voice** offers **Automatic** (the default), **On
request**, and **Off**. Automatic narration follows fresh supported interactions;
On request uses the coach's **Listen** control. Other selected coaches remain
text-only until their own approved bank is available. Voice shares the existing
master sound switch, volume, device mute, account persistence and browser
activation policy. It is independent of coach/interface motion preferences;
Still keeps the portrait still without muting audio.

Audio summarizes the supported idea while exact moves, squares, scores, names and
historical counts stay written. It is not a verbatim reading of every paragraph.
Unsupported or freeform text remains written. All lessons remain excluded: course
additions, hints, game annotations and edits do not require maintaining voice assets.

### Bank and authoring

The [bank manifest](../frontend/src/audio/speech/bank/manifest.json) identifies
all recordings and their local paths. It covers 92 game-review meanings, 68
additional practice/explanation meanings, 10 opening-recall/preview meanings,
eight puzzle states and three finite review statuses. Four audited transient or
defensive states deliberately remain silent: thinking, checking, loading an
explanation and no-renderable-claim. Shared meanings reuse recordings; the
[full inventory](../frontend/src/audio/speech/walter-full-dialogue-inventory.json)
retains trigger definitions, aliases and the original script audit. The active
manifest is the current script source; the
[wording revision](../frontend/src/audio/speech/bank/revisions/walter-language-v2.json)
records the exact old/new text and the reason for each change.

Recordings ship as local assets in the container. Installing, building and
playing Fieldwork needs no ElevenLabs account, API key, model download or runtime
synthesis. The development-only `scripts/record_coach_speech.mjs` uses explicit
paid generation, sequential plans of at most 20 requests, hash-verified reuse and
no automatic paid retries. Its only credential source is the process environment.
Each recording retains the exact voice/model/settings, text, request and file hash.
The [speech authoring history](../frontend/src/audio/speech/README.md) preserves
the owner-approved voice experiments and their usage provenance.

`scripts/prepare_coach_voice_bank.py` automatically aligns the known text and
recording using PocketSphinx's public word/phoneme API and the shared mouth rules.
Detailed source/phoneme archives remain authoring evidence; `bank/tracks.json` is
its compact runtime projection, loaded separately from the initial application.
Every clip has generated timing. No individual clip was aligned by hand, and no
native aligner or model is required by playback. See the
[bank verification workflow](../frontend/src/audio/speech/bank/README.md).

### Meaning and selection

Game dialogue owns recording selection, preserving the first successfully rendered
claim's exact identity. The selector validates its supporting facts, actor and
scope. An unavailable primary never silently promotes a lower-priority claim.
Played, allowed, missed, mover-caused and hypothetical positional explanations
remain distinct. A completed checkmate requires the board's actual termination;
a forced-mate search is not an already finished game. Human-model claims remain
estimates, separate from objective engine evaluation.

The bank includes secondary meanings, but unopened human-insight popovers,
explanation findings and note disclosures do not automatically speak. Their
explicit listening actions use the currently visible supported selection. Practice
producers provide structured summary, move-frame and finding facts; selectors do
not parse English or infer tactics from ratings or facial expressions.

Cold practice may give neutral task instructions, never answer, evaluation or
motif hints. Authorized attempt/reveal gates control subsequent feedback and
saved continuations. Reveals never sound like unassisted success; restored GET
feedback does not trigger a fresh reward. Opening acceptance means selected
repertoire membership, and puzzle acceptance means the authored answer. Neither
is recast as an objective Best move.

### Playback and cancellation

`PreparedSpeechClip` and `playRecordedSpeech` use the existing cancellable speech
bus, with priority/interruptibility and quieter effects while narration plays.
The shared `useCoachSpeech` adapter submits only the current supported recording.
Selection and lifecycle checks happen again after asynchronous mouth/audio loads.
Navigation, retry, changing coach, mute, hidden tabs and unmounting invalidate
obsolete work. No playback backlog accumulates. Initial hydration, restored
feedback, coach changes and background refinement are not fresh narration events.

The audio engine's read-only playback handle supplies the actual source clock to
the shared portrait. Mouth motion cannot start while the recording is loading;
stopping or replacing audio invalidates its handle. Multiple visible explanation
surfaces can share the portrait while retaining their own speech scope and controls.

### Locked voice and permissions

Walter's voice is locked by the owner. Audio Studio's **Walter wording** section
compares original and revised passages in that same voice, using the real portrait
and automatic mouth timing. Choose eight representative examples or all 81 revised
clips, then Original/Revised and Play or In context. This does not reopen voice
casting or change account preferences. Earlier voice auditions and the old
complete-bank selector remain isolated test fixtures.

The original recordings, scripts and mouth tracks remain a development-only
comparison archive. Production playback imports only the current 181 recordings;
the separate downloadable source snapshot still includes repository archives. The rest
of the cast's dialogue and casting choices are unchanged by this Walter pilot.

The voice recordings are separate media assets, not CC0 effects or automatically
licensed under the repository's source-code license. Their
[permissions notice](../frontend/src/audio/speech/README.md#permissions-and-attribution)
and per-recording provenance travel with them. Published ElevenLabs
[TTS terms guidance](https://elevenlabs.io/text-to-speech) permits paid-plan output
in games/apps, while its
[subscription policy](https://help.elevenlabs.io/hc/en-us/articles/15993008593297-What-happens-to-my-content-after-my-subscription-ends)
retains commercial rights for paid-period output after cancellation. Applicable
terms must be checked for each new generation, especially when changing voice
source or subscription. These permissions do not grant model rights, a person's
identity, or unrestricted relicensing of the voice assets.

## Verification

### Recording-driven coach mouths

`AudioEngineOptions.onSpeechPlayback` is an optional presentation observer. It
receives a read-only handle after a speech source actually starts, and `null`
when that session ends or is cancelled. Each handle carries scope, event, coach
and utterance identity. `read()` returns elapsed source seconds, normalized energy
and a rough brightness hint using `AudioContext.currentTime`; it returns `null`
when paused/expired or permanently invalidated. Cancelled handles never revive,
and an older callback cannot clear a replacement session.

Only engines with this observer summarize decoded speech PCM. The 10ms summaries
are cached per AudioBuffer in a WeakMap; board effects never incur this work.
Normalization uses the recording's voiced level, with a silence/noise gate and
channel energy that cannot cancel opposing stereo phases. There is no continuously
running audio-side animation loop. The coach owns smoothing and artwork, described
in [Animated coach](COACH.md#speaking-articulation).

The Walter audition passes the matching live handle to the real shared portrait.
Loading, the context move sound and its delay cannot start his mouth. Stop, mute,
zero volume, example changes and hiding the page cancel both together. The local
Coach motion selector uses the shared device/Animated/Still policy without
changing account preferences. Existing prerecorded examples are unchanged; the complete bank also powers
application narration. Lessons remain out of scope.

### Automatic lip-sync comparison (development only)

The isolated Walter browser-test fixture retains **Compare lip sync**.
**Sound sacrifice** and
**Allowed checkmate** each drive two shared Walter portraits from one audio
source: the first Rhubarb generator and the revised script-aligned generator.
Both use identical mouth artwork, expression and playback smoothing, so this
comparison isolates generation quality. Independent idle gestures are
paused to make the comparison easier. Play voice, In context, Stop and the motion
selector keep their existing behavior. No new recordings or paid generation
were needed.

The original Rhubarb Lip Sync 1.14.0 tracks remain unchanged. The revised generator
uses PocketSphinx 5.1.1's public word/phoneme alignment API against the known script,
then a shared English sound-to-mouth mapping. Generated artifacts retain word and
phone evidence as well as mouth cues. No clip-specific timing fixes or artwork
adjustments are used. The ordinary **Voice audition** still previews the simpler
energy-driven mouth.

The improved method now generates the complete production bank. The
[alignment README](../frontend/src/audio/speech/alignment/README.md) documents
reproduction, source/tool hashes, conversion details and read-only verification.
The native tool, recognition resources and temporary WAVs stay outside Git and
Docker. The two original comparison archives remain development-only; the production
bank uses its separate generated compact cue projection.

### Animal and fantasy voice auditions

The separate audio studio's **Cast voice auditions** selector compares three
independently described custom voices for each of twenty approved nonhuman
coaches (60 active recordings). Eighteen approved designs are now locked, so the
studio defaults to the two remaining coaches under **Needs a voice**. **Locked
voices** permits read-only inspection. All twenty speaking rigs can be inspected independently.
The coach studio's **Mouth shapes** view embeds the same audition panel for its
selected character. These tools share `useStudioPlayer`, `StudioTransport`,
`CastVoiceAudition` and the existing audio engine. Selecting another character
or direction cancels playback; all sound and mouth timing use the same source
clock. Neither surface changes account preferences or installs a production voice.

**Choose this voice** saves the currently auditioned direction as that coach's
casting decision. **Keep looking** records that none of the present options fits;
an optional note explains what to change. Listening or changing the candidate
does not vote. The saved direction remains visible while comparing another one,
and **Clear choice** returns the coach to undecided. The compact overview counts
chosen, keep-looking and undecided coaches.

A Keep looking decision belongs to the candidate set actually reviewed. When
new recordings arrive, its notes remain but the new round awaits a fresh decision;
legacy rejections without a set identity also need review. The browser must show
the same recording identities as the service before rejecting the set, and a set
changed during a save produces a conflict rather than approving unseen content.

An explicit owner approval can promote a selected direction into the tracked
`cast-auditions/locked-voices.json`. Its eighteen entries bind exact approved
preview bytes and source identity to saved ElevenLabs voices. These immutable
approvals survive a fresh clone without local draft files; the service rejects
changing or clearing them. Corrupt/missing lock data fails closed and mismatched
recordings show a stale warning. Locking selects a voice design; it does not
record or install a full dialogue bank. Walter remains the completed production bank.

Both studios use the same development-only persistence service and fixed
`data/voice-casting` directory. Choices survive reloads and studio restarts and
are available from other LAN devices; browser local storage is not the source of
truth. Per-coach records bind the decision to the recording's fingerprint, so a
replaced candidate is flagged for review rather than silently approved. Failed
loads or writes are visible. Choice files are ignored authoring data, not account
preferences or production assets. A casting decision makes no ElevenLabs request,
saves no provider voice slot and does not generate a bank.

The running Vite studios provide this service; a static studio build alone does
not save choices. Concurrent edits use per-coach revisions and exclusive locks.
If a crashed save leaves a lock, the error identifies it: stop both studios,
remove only that coach's named `.lock` file, then restart. Keep the `.json`
decision files. Locks are never automatically evicted during another save.

`audio/speech/cast-auditions/design-plan.json` records the short script and distinct
casting prompts. `scripts/design_coach_voices.mjs` is an offline authoring tool:
dry-run by default, explicit paid generation, bounded sequential requests, a
durable attempt before each request, no automatic retries and no saved-voice API.
It retains one preview per independent prompt, with request, generated voice ID,
seed and audio fingerprint. Re-running verifies and reuses existing audio;
incomplete paid attempts require inspection rather than another charge.

Candidate media and generated alignment are development-only. The production
application still has Walter's completed voice bank; the other human voices are
deliberately untouched. No installation or listening session contacts ElevenLabs.
The selected generated voice ID can later be saved when the owner chooses a
direction; auditioning does not consume a saved-voice slot per option.

The first 48 auditions used **6,372 ElevenLabs credits** (usage 3,530 to 9,902).
The final twelve used **1,593 credits** (9,902 to 11,495): **7,965 total** for all
sixty. A subsequent Biscuit/Pip replacement round increased usage by **800
credits** (11,495 to 12,295), totaling **8,765 casting credits**. It produced six
new previews; one rejected request is included in that session's usage interval.
The six rejected first-round directions retain their original source assets and
archived briefs, outside the active manifest. Walter's completion batch used
**1,948 credits** separately. Replaying either collection is local and free. Audition files are unchanged provider output,
about 8–12 seconds, with no padding or manual timing edits. Use
`npm --prefix frontend run dev:audio:lan` for the audio studio on port 5176, or
`npm --prefix frontend run dev:coach:lan` for the mouth inspector on port 5174.

### Coverage

Production voices are registered in `audio/speech/banks/registry.json`. Each entry
binds a coach and voice to its manifest; `voiceBank.ts` resolves that coach's local
recordings and lazily loads only its compact mouth tracks. Unknown coaches and
missing meanings stay silent, without borrowing another character's voice.
`speech/meanings.json` names shared semantic recording IDs independently of their
per-character scripts. The default `prepare_coach_voice_bank.py --check` validates
all registered banks, their meaning/group membership and approved voice identity;
an explicit `--manifest` remains available for preparing an unregistered bank.

Engine tests cover cue precedence, mute/categories, activation failure, duplicates,
delayed and stale decoding, cancellation, hidden tabs, bounded voices, prepared
speech and disposal. Browser tests observe actual Web Audio source starts and
cover the production preference/session/navigation paths without production test
globals. Studio tests exercise all approved assets, source coverage, context timing and cancellation.
Run the affected application/account suites alongside the dedicated audio suite
when changing integration. See [Testing](TESTING.md) and the dated
[verification record](VERIFICATION.md) for commands and actual results.
