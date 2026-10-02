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

## Recorded coach voices

Walter (`classic`) and Rivet (`robot`) each have a **438-recording non-lesson bank**,
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
Unsupported or freeform text remains written. All lessons remain excluded: course
additions, hints, game annotations and edits do not require maintaining voice assets.

### Bank and authoring

The [Walter manifest](../frontend/src/audio/speech/bank/manifest.json) and
[Rivet manifest](../frontend/src/audio/speech/banks/rivet/manifest.json) identify
all recordings and their local paths. Each covers 349 game-review meanings, 68
additional practice/explanation meanings, 10 opening-recall/preview meanings,
eight puzzle states and three finite review statuses. Four audited transient or
defensive states deliberately remain silent: thinking, checking, loading an
explanation and no-renderable-claim. Shared meanings reuse recordings; the
[full inventory](../frontend/src/audio/speech/walter-full-dialogue-inventory.json)
retains trigger definitions, aliases and the original script audit. The active
manifest is the current script source; the
[wording revision](../frontend/src/audio/speech/bank/revisions/walter-language-v2.json)
records the exact old/new text and the reason for each change.
The shared `meanings.json` catalogue adds eleven Book variants and 246
objective/human-evidence combinations to the original 181 meanings. Each coach
has a complete recording for each combination. `banks/pilot-additions.json`
retains the initial eleven opening and fourteen combined scripts;
`banks/maia-combinations.json` authors the additional 232 combinations for both
voices. Existing recordings are reused, not regenerated to expand the catalogue.

Rivet's [spoken editorial revision](../frontend/src/audio/speech/banks/rivet/revisions/wording-v2.json)
reviews those 257 additions and replaces 197 passages, retaining 60 additions
and all 181 original recordings. His spoken writing follows the same character
bible as his text: lead with the concrete chess event, use compact cause/result
clauses when they clarify it, then state the relevant human-model assessment.
Keep occasional earned understatement, not a diagnostic catchphrase on every
line. Remove repeated methodology explanations and redundant closing summaries,
especially across consecutive Book moves. Tactical opportunities remain possible
replies, not events already played; difficult defenses stay estimates bounded
to the searched choices. These editorial choices do not alter recording IDs,
evidence, selection, or Walter's scripts.

The coverage inventory follows the actual claim producers and rendering rules,
not an unrestricted product of every move grade and model result. It includes
natural mistakes, unusual strong choices, hard finds, difficult defenses missed
or found, natural best moves, and natural strong alternatives. Found defenses can
take precedence over ordinary tactical praise; terminal outcomes suppress human
feedback. Allowed/missed back-rank mate uses the higher-priority mate explanation,
and hidden history or positional alternatives cannot displace a stronger visible
explanation merely because a recording exists. No grading or model thresholds
change to make a combination eligible.

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
  outcomes, repeated Book moves and combined Maia passages. Walter explains
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
- Write each eligible objective/Maia pairing as one coherent response. The bank
  contains full recordings for supported pairings, not a second speech event or
  stitched sentences. Review the whole passage for personality, explanation and
  redundancy after combining its meanings.
- Inspect an opening sequence, not just an isolated Book clip. Recognition and
  follow-on variants should feel varied without claiming a Book move is best or
  safe. Sequence wording requires the existing verified prefix; invented history
  cannot be used to make the delivery more interesting.
- Listen to beginnings, endings, pronunciation, pace and volume in context with
  the board sounds. Check the real portrait at application sizes, including quiet
  pauses, rounded vowels, interruption and return to its expression. Hashes and
  complete phone coverage prove artifact consistency, not pleasing delivery or
  perceptually correct lip sync.

The current 438 recordings are a coverage snapshot, not a per-coach quota. A new
bank should cover the current reachable non-lesson meanings intentionally; do not
invent combinations to reach a number. Missing meanings can remain safely silent
during development, but a partially registered bank is not a completed coach.
The [bank workflow](../frontend/src/audio/speech/bank/README.md#adding-or-revising-a-production-bank)
separates artifact checks, semantic coverage and human listening review.

### Meaning and selection

Game dialogue owns recording selection, preserving rendered claims' exact
identities. The selector validates their supporting facts, actor and scope. The
first rendered non-human explanation can pair with the exact human insight shown
by the current Maia badge, even when the bubble's sentence limit omits that
insight or presents it before the objective explanation. `PositionCoach` prepares
that human presentation once and supplies the same object to the badge and the
selector. A different parent, coach, policy, trace or position cannot authorize a
combination. Unrendered objective claims are never searched for a convenient pair.

A matching pair selects one complete recording. A bank missing that combination
retains the originally selected primary recording; it never joins files together.
An unavailable primary never silently promotes a lower-priority claim. The badge
does not have to be opened to authorize its visible insight, but opening it alone
does not trigger speech. Show Why and practice retain their own selection rules.
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
control; human-insight recordings play only inside the move's single bubble
playback. Practice
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
With a Maia reading it is the Maia-aware combined recording when one exists.
Otherwise, when both bubble sentences have recordings, the two existing clips are
joined into one buffer with a 250 ms gap (`audio/speech/sequence.ts`), and the
second clip's mouth timing is offset by the first clip plus the gap. Stop ends
both, and nothing overlaps. No extra recordings are needed for these pairs.
Selection and lifecycle checks happen again after asynchronous mouth/audio loads.
Navigation, retry, changing coach, mute, hidden tabs and unmounting invalidate
obsolete work. No playback backlog accumulates. Initial hydration, restored
feedback, coach changes and background refinement are not fresh narration events.
Opening the Maia insight popover neither plays nor consumes the main coach's
pending automatic opportunity. Late Maia
evidence can update visible text and the preferred recording without replaying
speech or interrupting an already playing, still-supported clip. Removing its
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
casting or change account preferences. Earlier voice auditions and the old
complete-bank selector remain isolated test fixtures.

The **Recorded coach comparison** panel compares Walter and Rivet for the same
meaning, with Opening run, With Maia and All lines collections. It uses the same
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

### Coach voice auditions

The separate audio studio's **Cast voice auditions** selector compares three
independently described custom voices for each of twenty-nine coaches (87 active
recordings): the twenty nonhumans and the nine newer humans, each human voiced
from their [chess home region](COACH.md#human-home-regions). All twenty-nine
designs are locked, so **Needs a voice** is empty. **Locked
voices** permits read-only inspection. All thirty speaking rigs can be inspected
independently. Walter keeps his separately approved voice.
The coach studio's **Mouth shapes** view embeds the same audition panel for its
selected character. These tools share `useStudioPlayer`, `StudioTransport`,
`CastVoiceAudition` and the existing audio engine. Selecting another character
or direction cancels playback; all sound and mouth timing use the same source
clock. Neither surface changes account preferences or installs a production voice.
A recording whose automatic alignment failed still plays: once the track lookup
finishes without a track, the portrait keeps the shared energy-driven mouth and the
panel says that mouth timing is unavailable. Nothing is hand-timed.

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
`cast-auditions/locked-voices.json`. Its twenty entries bind exact approved
preview bytes and source identity to saved ElevenLabs voices. These immutable
approvals survive a fresh clone without local draft files; the service rejects
changing or clearing them. Corrupt/missing lock data fails closed and mismatched
recordings show a stale warning. Locking selects a voice design; it does not
record or install a full dialogue bank. Walter, Rivet, Winston and Button now have production banks.

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
application has Walter's and Rivet's completed voice banks; the other human voices are
deliberately untouched. No installation or listening session contacts ElevenLabs.
The selected generated voice ID can later be saved when the owner chooses a
direction; auditioning does not consume a saved-voice slot per option.

The first 48 auditions used **6,372 ElevenLabs credits** (usage 3,530 to 9,902).
The final twelve used **1,593 credits** (9,902 to 11,495): **7,965 total** for all
sixty. A subsequent Biscuit/Pip replacement round increased usage by **800
credits** (11,495 to 12,295), totaling **8,765 casting credits**. It produced six
new previews; one rejected request is included in that session's usage interval.
Biscuit's third, fourth and fifth rounds each used **390 credits** (28,866 to
29,256 to 29,646 to 30,036), bringing casting to **9,935 credits**. Every earlier
round (Biscuit and Pip's first, Biscuit's second to fourth) retains its original source assets and
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
