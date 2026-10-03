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

The shared board workspace has a quick mute control, the last button in the board controls. It applies to the current
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
account/API connection and no production navigation route. It uses the actual audio
engine and the same nine approved defaults as the app.

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

## Recorded coach voices

Walter (`classic`) and Rivet (`robot`) each have a **195-recording bank**: 185
non-lesson meanings, the game-review opener and the nine generic lesson prompts,
using their owner-selected Older teacher and Retro speech terminal voices.
The earlier Walter wording revision replaced 81 passages and retained 100 recordings. It removed repetitive
“continuation” language while preserving actual, possible, missed and
opponent-opportunity meanings. The revised passages used **7,524 input characters**
and **907 provider credits**; character counts are not billing units. Voice,
delivery settings and that revision's supported meanings were unchanged. No words or
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
Unsupported or freeform text remains written. The bubble shows what the coach
says: the selected coach's spoken line (its recording, or its script for a
line written but not yet recorded) replaces the written sentence whenever one exists, with voice on
or off, and game review adds a moves line for the concrete reply and opening; see
[Bubble text is the spoken line](COACH_DIALOGUE.md#bubble-text-is-the-spoken-line). Coaches never speak a Maia
(human-move model) reading: the Maia badge, its popup and the written Maia sentence
stay, but no Maia recording exists or is selected (owner decision, 2026-10-02).
Lessons voice only nine generic
prompts (wrong, correct, revealed, follow the line, play your studied move,
alternative, chapter complete, full game and error), one per lesson command; course
additions, hints, game annotations and edits still do not require voice assets.

### Bank and authoring

The [Walter manifest](../frontend/src/audio/speech/bank/manifest.json) and
[Rivet manifest](../frontend/src/audio/speech/banks/rivet/manifest.json) identify
all recordings and their local paths. Each covers 96 game-review meanings, 68
additional practice/explanation meanings, 10 opening-recall/preview meanings,
eight puzzle states and three finite review statuses. Four audited transient or
defensive states deliberately remain silent: thinking, checking, loading an
explanation and no-renderable-claim. Shared meanings reuse recordings; the
[full inventory](../frontend/src/audio/speech/walter-full-dialogue-inventory.json)
retains trigger definitions, aliases and the original script audit. The active
manifest is the current script source; the
[wording revision](../frontend/src/audio/speech/bank/revisions/walter-language-v2.json)
records the exact old/new text and the reason for each change.
The shared `meanings.json` catalogue adds eleven Book variants, the game-review
opener and nine lesson prompts to 174 of the original 181 meanings, for **195
meanings**. `banks/pilot-additions.json` holds Walter's and Rivet's opening,
opener and lesson scripts. Until 2026-10-02 the catalogue also had the seven
standalone human-model readings and 246 objective/Maia combinations (448 in all,
with `banks/maia-combinations.json`); those 253 meanings, their scripts, clips,
provenance and alignments were removed when Maia speech was retired. Git history
keeps them. Existing recordings are reused, not regenerated to expand the catalogue.

Rivet's [spoken editorial revision](../frontend/src/audio/speech/banks/rivet/revisions/wording-v2.json)
reviews those 257 additions and replaces 197 passages, retaining 60 additions
and all 181 original recordings. His spoken writing follows the same character
bible as his text: lead with the concrete chess event, use compact cause/result
clauses when they clarify it, then (in the since-retired Maia passages) state the
relevant human-model assessment.
Keep occasional earned understatement, not a diagnostic catchphrase on every
line. Remove repeated methodology explanations and redundant closing summaries,
especially across consecutive Book moves. Tactical opportunities remain possible
replies, not events already played; difficult defenses stay estimates bounded
to the searched choices. These editorial choices do not alter recording IDs,
evidence, selection, or Walter's scripts.

The later [distinct-voice revision](../frontend/src/audio/speech/banks/rivet/revisions/wording-v3.json) replaces 294 Rivet
recordings whose sentences matched Walter's, or a few of Jun, Scout, Wisp and
Ziggy, with labeled robot readouts, and says "the other side" on plain alert
clips that can play on either side's move. IDs, evidence and selection are unchanged.

The coverage inventory follows the actual claim producers and rendering rules,
not an unrestricted product of every move grade and model result. Allowed/missed
back-rank mate uses the higher-priority mate explanation, and hidden history or
positional alternatives cannot displace a stronger visible explanation merely
because a recording exists.

Recordings ship as local assets in the container. Installing, building and
playing Fieldwork needs no ElevenLabs account, API key, model download or runtime
synthesis. The development-only `scripts/record_coach_speech.mjs` uses explicit
paid generation, sequential plans of at most 20 requests, hash-verified reuse and
no automatic paid retries. Its only credential source is the process environment.
Each recording retains the exact voice/model/settings, text, request and file hash.

Committed speech is mono Ogg Opus at about 24 kbps (48 kHz, libsndfile
compression level 0.93), roughly a fifth of the provider's 128 kbps MP3 with the
same timeline. ElevenLabs' smallest Opus output is 32 kbps, so the recorder still
requests `mp3_44100_128` and `scripts/encode_coach_speech.py` encodes it before
anything is written; the provider MP3 never reaches a bank. Each sidecar keeps the
provider request, records the MP3's fingerprint as `providerAudio` and the
encoding settings as `encoding`, and its `sha256`/`bytes` bind the committed Opus
file. Bank and audition checks reject any clip that is not this exact encoding or
exceeds its bitrate. Browsers decode it through Web Audio; Safari needs 18.4 or
later. A recorded bank costs about 13 MB, and the source download lists recorded
audio by hash instead of storing a second copy.
Avoid “separate” and “separately” in new spoken scripts: the selected voices do
not reliably deliver the intended pronunciation. Choose natural wording such as
“distinct,” “different,” or “distinguish,” preserving the supported meaning. A
registered-bank regression check enforces this authoring rule. Text corrections
require a new complete recording and regenerated mouth timing; changing a
transcript without replacing its audio is not valid.
The [speech authoring history](../frontend/src/audio/speech/README.md) preserves
the owner-approved voice experiments and their usage provenance.

`scripts/prepare_coach_voice_bank.py` automatically aligns the known text and
recording using PocketSphinx's public word/phoneme API and the shared mouth rules.
Detailed source/phoneme archives remain authoring evidence; `bank/tracks.json` is
Walter's compact runtime projection, and `banks/rivet/tracks.json` is Rivet's.
Each is loaded separately from the initial application.
Every clip has generated timing. No individual clip was aligned by hand, and no
native aligner or model is required by playback. See the
[bank verification workflow](../frontend/src/audio/speech/bank/README.md).

### Spoken quality standard

Walter and Rivet are the current end-to-end reference banks, not scripts to copy
and relabel for another character. Use their **active manifests** and the
**Recorded coach comparison** studio collection; earlier plans and archived
auditions preserve history rather than the latest wording. The
[coach creation guide](COACH_CREATION_GUIDE.md) puts voice authoring in the wider
artwork, animation and dialogue workflow.

- Preserve the character's teaching voice across ordinary feedback, adverse
  outcomes and repeated Book moves. Walter explains
  patiently; Rivet leads with patterns and consequences in compact clauses.
  Merely adding a catchphrase to neutral prose does not meet this standard.
- Explain the supported idea without depending on a particular square, SAN move,
  numerical score, player name or count. Specifics remain visible in the text.
  A recording may name a piece when the shared meaning itself establishes it;
  avoid both unsupported specificity and vague boilerplate such as "in this
  continuation" that does not help the learner understand the idea.
- Keep actor and branch identity intact. An allowed reply is an opportunity for
  the opponent; an unplayed alternative is hypothetical; a searched mating route
  is not an already completed checkmate. Human-model estimates must never become
  engine evaluation, population percentages or promises of survival.
- Do not write Maia lines. Human-move model readings stay written in the Maia
  popup; no bank records them alone or combined with another meaning.
- Scripts are on-screen text as well as speech: the bubble shows a coach's
  recorded line, or its `scripts.json` line when it has no recording, so a script
  must read well in the bubble at phone width.
- Inspect an opening sequence, not just an isolated Book clip. Recognition and
  follow-on variants should feel varied without claiming a Book move is best or
  safe. Sequence wording requires the existing verified prefix; invented history
  cannot be used to make the delivery more interesting.
- Listen to beginnings, endings, pronunciation, pace and volume in context with
  the board sounds. Check the real portrait at application sizes, including quiet
  pauses, rounded vowels, interruption and return to its expression. Hashes and
  complete phone coverage prove artifact consistency, not pleasing delivery or
  perceptually correct lip sync.

The current 185 non-lesson recordings are a coverage snapshot, not a per-coach
quota. A new bank should cover the current reachable non-lesson meanings
intentionally; do not invent meanings to reach a number. Missing meanings can remain safely silent
during development, but a partially registered bank is not a completed coach.
The [bank workflow](../frontend/src/audio/speech/bank/README.md#adding-or-revising-a-production-bank)
separates artifact checks, semantic coverage and human listening review.

### Meaning and selection

Game dialogue owns recording selection, preserving rendered claims' exact
identities. The selector validates their supporting facts, actor and scope. A Maia
(human-model) claim never selects a recording, whether it renders in the bubble or
only in the Maia badge. A Maia sentence adds nothing to speech: the first other
rendered sentence leads, even when the Maia sentence is shown before it, and a
bubble whose only claim is Maia stays silent. Unrendered objective claims are never
searched for a convenient recording.

An unavailable lead recording never silently promotes a lower-priority claim.
Opening the Maia badge does not trigger speech. Show Why and practice retain their
own selection rules.
Played, allowed, missed, mover-caused and hypothetical positional explanations
remain distinct. A completed checkmate requires the board's actual termination;
a forced-mate search is not an already finished game. Human-model claims remain
estimates, separate from objective engine evaluation.

Book narration uses three generic recognition variants and eight follow-on
variants. Follow-on wording requires a contiguous reviewed prefix with matching
frames, report generations, catalogue version and game-context nodes. Unknown
prefixes and variations use generic recognition. The variant is stable for a
position across visits and refinement; a confirmed run cycles without adjacent
repeats. Neither recognition nor repetition establishes objective move quality.

The bank includes secondary meanings, but explanation findings and note
disclosures do not automatically speak. Their explicit listening actions use the
currently visible supported selection. The Maia insight popover has no voice
control, and no Maia reading is ever spoken. Practice
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
A game-review move has exactly one coach playback and one Listen/Stop control.
A Maia sentence in the bubble is never voiced. When both bubble sentences are
objective and have recordings, the two existing clips are
joined into one buffer with a 250 ms gap (`audio/speech/sequence.ts`), and the
second clip's mouth timing is offset by the first clip plus the gap. Stop ends
both, and nothing overlaps. No extra recordings are needed for these pairs.
Selection and lifecycle checks happen again after asynchronous mouth/audio loads.
Navigation, retry, changing coach, mute, hidden tabs and unmounting invalidate
obsolete work. No playback backlog accumulates. Initial hydration, restored
feedback, coach changes and background refinement are not fresh narration events.
Opening an untouched review in-app at its starting position is the one exception:
it speaks the coach's fact-free `game-review-opened` greeting once, after saved
voice preferences load and the review session has restarted (restarting begins a
new analysis epoch, which would otherwise cancel the greeting). A restored later move, a branch, a review error or a fresh
document without a prior gesture stays silent, and the first navigation replaces
the greeting with that move's own line. The greeting is the mainline start's own
line, so returning there shows and speaks it again like any other position. While
the greeting is the active line, the bubble shows its text. It is written and recorded for all 30 coaches.
Opening the Maia insight popover neither plays nor consumes the main coach's
pending automatic opportunity. Late Maia
evidence can update visible text (and so the bubble's objective recording) without
replaying speech or interrupting an already playing, still-supported clip. Removing its
support cancels it. Changing Automatic to On request also revokes automatic work.

The audio engine's read-only playback handle supplies the actual source clock to
the shared portrait. Mouth motion cannot start while the recording is loading;
stopping or replacing audio invalidates its handle. Multiple visible explanation
surfaces can share the portrait while retaining their own speech scope and controls.

### Locked voice and permissions

Walter's voice is locked by the owner. Audio Studio's **Walter wording** section
compares original and revised passages in that same voice, using the real portrait
and automatic mouth timing. Choose eight representative examples or all 81 revised
clips, then Original/Revised and Play or In context. This does not reopen voice
casting or change account preferences. The earlier voice auditions, the
complete-bank selector and the cast audition studio were removed from the tree on
2026-10-03; Git history retains them.

The **Recorded coach comparison** panel compares Walter and Rivet for the same
meaning, with Opening run and All lines collections. It uses the same
local recordings, portrait and mouth-track loader as production. Casting choices
and account preferences are unaffected. The other 28 coaches retain their wording.
Original recordings and timing archives remain authoring history; the separate
downloadable source snapshot includes repository archives as well as active media.

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

The studio's Walter wording and recorded coach comparison panels drive the real
shared portrait from the engine's live playback handle. Loading and the context
move sound cannot start the mouth; Stop, mute, zero volume, example changes and
hiding the page cancel speech and mouth together. Their local Coach motion
selector uses the shared device/Animated/Still policy without changing account
preferences. The complete bank also powers application narration. Lessons remain
out of scope.

### Automatic lip-sync comparison (development only)

`audio-tests/lip-sync.spec.ts` keeps the retained **Sound sacrifice** and
**Allowed checkmate** comparison tracks (`speech/alignment/`): the first Rhubarb
generator and the revised script-aligned generator for the same recordings. The
interactive Compare lip sync panel was removed with the Walter audition on
2026-10-03. No new recordings or paid generation were needed.

The original Rhubarb Lip Sync 1.14.0 tracks remain unchanged. The revised generator
uses PocketSphinx 5.1.1's public word/phoneme alignment API against the known script,
then a shared English sound-to-mouth mapping. Generated artifacts retain word and
phone evidence as well as mouth cues. No clip-specific timing fixes or artwork
adjustments are used.

The improved method now generates the complete production bank. The
[alignment README](../frontend/src/audio/speech/alignment/README.md) documents
reproduction, source/tool hashes, conversion details and read-only verification.
The native tool, recognition resources and temporary WAVs stay outside Git and
Docker. The two original comparison archives remain development-only; the production
bank uses its separate generated compact cue projection.

### Cast voice locks

Voice casting is complete. `audio/speech/cast-auditions/locked-voices.json` binds
each cast coach's approved ElevenLabs voice (Walter's approval is
`walter-selected-voice.json`); `scripts/prepare_coach_voice_bank.py --check`
refuses a registered bank whose provider voice differs from its lock, and
`scripts/record_coach_speech.mjs` records banks against those locks. The audition
recordings, their alignment data, the cast audition studio, the casting server,
`design_coach_voices.mjs` and `prepare_cast_voice_auditions.py` were removed from
the tree on 2026-10-03, after casting finished; Git history retains them with
their provenance. Casting used **9,935 ElevenLabs credits** in total, and Walter's
completion batch used **1,948 credits** separately. Locking selects a voice design;
it does not record or install a dialogue bank.

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
