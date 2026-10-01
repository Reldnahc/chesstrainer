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

Open **http://127.0.0.1:5176**. This is a separate Vite process with no account/API
connection and no production navigation route. It uses the actual audio engine
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

## Coach speech foundation

`PreparedSpeechClip` accepts an already prepared `AudioBuffer` plus the existing
`CoachUtterance`, scope and event identity. The engine has a cancellable speech
bus, respects priority/interruptibility when replacing speech, and lowers effects
while speech plays. This is an extension point, not a production voice feature.

`playRecordedSpeech` accepts a recording URL and the same utterance/scope contract.
It registers cancellable work before loading, reuses the shared decoded-asset
cache, and optionally delays playback. Mute, hidden tabs, cancellation and disposal
also invalidate pending recordings, so a late download cannot revive stale speech.
Recording playback never contacts a synthesis provider or requires credentials.

A future speech adapter owns obtaining a clip and checking whether an utterance
is still current before submitting it. The calling policy decides whether speech
is manual or permitted by `autoSpeakSuitable`. Visible/spoken text remains owned
by dialogue; audio never rewrites chess claims or generates character prose.
There is no production TTS provider, speech setting, automatic narration or
runtime synthesis request. The separate local authoring tool and developer-only
audition described below are not production speech selection.

### Prerecorded-coach pilot (development audition)

The owner approved trying one coach with complete, reusable spoken explanations.
The precise position-specific explanation stays written in the bubble. Spoken
summaries preserve the supported teaching point without narrating unique move
numbers, squares, scores or historical references. These are whole recorded
sentences, not isolated rating announcements or stitched word fragments.

Approved recordings will ship as local application assets in the container.
Installing, building and using Fieldwork must not require a voice-service account,
API key, model download or runtime synthesis. Production cost belongs to creating
the recordings, not to the people playing them. First select the coach and voice,
then audition a small set before expanding coverage or adding production controls.
The owner selected Walter (`classic`) and authorized a small paid ElevenLabs
audition, then chose the **Older teacher** remix as Walter's voice direction.
The chosen refinement is saved as **Fieldwork Walter - Older teacher**. Eight
short contrasting examples in that voice now lead the studio; production
automatic speech is not enabled.

The existing audio studio now compares Bill, George and Brian reading the same
four full teaching examples: a difficult defense, abandoning a defender, allowing
forced mate, and finding a fork. Twelve local MP3s total 1,789,388 bytes. They use
the real registered Walter and shared coach presentation. Explicit Play/In context
actions use the same speech bus, mute, volume and cancellation as prepared speech.
The examples are labelled as authored demonstrations, not real analyzed games.
Written and spoken text are identical for this voice comparison; the supported
summary policy below remains the rule for eventual production integration.

The owner then requested one original Walter Voice Design experiment. Its single
text-only prompt generated three approximately 40-second alternatives, now in the
Custom Walter collection. They share one continuous preview of the four
teaching examples; the Original voices collection preserves all previous clips.
Both collections reuse the same player, coach presentation and cancellation
behavior. Model/source credits belong to each voice rather than assuming all
clips use the original TTS model. The custom previews use `eleven_ttv_v3`, total
1,965,378 bytes and have exact request/hash provenance in `design-preview.json`.

The owner subsequently chose Custom 1 as Walter's refinement baseline and
approved saving it in ElevenLabs as **Fieldwork Walter - Custom 1**. Future
refinement auditions use the 140-character script in `walter-short-plan.json`
(about a quarter of the original), targeting roughly 10 seconds. The original
preview is retained for comparison. Two prompt-based remixes of that saved voice
produced three warmer and three more playful previews of the short script,
each about 8–9 seconds, for the Walter refinements collection. The exact
requests, selected source voice, generated IDs and asset hashes are retained in
`refinement-previews.json`; the provider does not report a model ID for remixes.
The 140-character v4 TTS plan remains available but unrecorded. A subsequent
Teacher & elder collection uses a 141-character script ending in
a complete takeaway and prompts request unhurried, fully articulated endings.
The owner requested one example per prompt, so it now compares Older teacher
(the combined direction), Teacher and Elder, one take each. Other custom
collections follow the same representative-sample policy. Exact requests and
asset provenance remain in `mentor-previews.json` and `older-teacher-preview.json`.
Earlier alternatives remain archived; no remix has been saved over the baseline.
This authoring choice does not enable production narration. The later owner
selection of Older teacher is recorded in the dialogue inventory below.

The default **Walter examples** collection contains eight one-take examples from
the audited game scripts, totaling 830 input characters and 853,821 MP3 bytes.
They cover positive, negative, recovery, positional and human-model explanations.
The exact saved identity, v4 request settings and hashes are retained in
`walter-selected-voice.json`, `walter-contrasts-plan.json` and recording sidecars.
This is an audition of the selected voice's TTS delivery, not automatic game
narration or an authorization to record the complete inventory.

### Walter dialogue inventory (planning, not implementation)

The audit at `839da3e` traced all **64** dialogue template codes, production intent
builders, current game-review motif producers and the actual Walter renderer
(`classic` → `storyteller-4`). **55** codes can be emitted in game/variation mode;
excluding transient/legacy text leaves **52** structured game claim codes.

The [complete draft inventory](../frontend/src/audio/speech/walter-dialogue-inventory.json)
has **71 primary-capable recordings** and **21 additional secondary-only recordings**:
**92** distinct summary scripts in total, with one performance per script. This
is an exact count of the documented summary design, not a claim that every
possible dynamic bubble has a finite verbatim recording or that this many files
guarantee pleasant repetition. Alternate wording/takes are separate editorial
choices and are not silently added to the count. The
[human-readable breakdown](../frontend/src/audio/speech/README.md#walter-dialogue-inventory)
lists each family and explains the exclusions.

The proposed selection policy would speak only the first successfully rendered
primary claim, not both bubble claims or an unopened human-insight popover. All
12 hypothetical positional recordings, two mate-shadowed back-rank recordings,
and seven other subordinate meanings are therefore deferred. The proposed next
production scope is the 71-recording main-bubble pack; broad app-wide narration
has not been approved. Lessons, SRS, puzzle instructions and Show why are audited
separately in the inventory and are not disguised as covered by these totals.

No speech selector has been implemented. It must retain the selected claim's
identity/scope, validate supporting facts, and inspect actual current-position
readiness. `autoSpeakSuitable` is insufficient by itself; `PositionCoach`'s
current `pending` input includes `!!actor`, so using it directly would silence
ordinary reviewed moves. Human popovers need an explicit surface policy, and
mate clips must use the board's checkmate/result facts, not portrait expression.
The inventory records these implementation prerequisites without changing the
existing dialogue, analysis or audio behavior.

The owner deferred **all lesson narration** to keep course additions and edits
independent of the voice library. The [current inventory](../frontend/src/audio/speech/README.md#whole-app-dialogue-inventory)
therefore counts **185** distinct proposed Walter recordings across game review,
SRS/explanations, opening recall/preview, puzzle guidance and finite operational
states. It includes the original 92 and the eight recorded examples, with shared
lines counted once. Four transient/defensive entries are recommended silent,
leaving **181 recordings**, of which **173 remain unrecorded**. This is the listed
finite summary design, not verbatim coverage of unbounded user text or automatic
narration of every visible paragraph. The earlier lesson inventory is retained
in Git history at `054cd80`; it must not expand the active recording plan. The
[machine-readable plan](../frontend/src/audio/speech/walter-full-dialogue-inventory.json)
retains scripts, source identities, reuse mappings, exact counts and text-only
boundaries. Written lesson content is unchanged. No further recordings or
production integration are implied.

The [recording plan and provenance](../frontend/src/audio/speech/README.md) document
the selected model, settings, exact scripts, media terms and reproducible authoring
workflow. `scripts/record_coach_speech.mjs` is a development CLI with dry run as
the default, an explicit paid-generation flag, hash-verified reuse and no automatic
paid retries. It reads only the process environment's `ELEVENLABS_API_KEY` and
is not invoked by app builds or playback. No credentials enter frontend code.

The following is a factual audition brief; adapt its delivery and wording to the
selected character before recording. Each row should be a complete take with
room for natural pauses. Test a second take for the strongest positive and
negative moments, rather than generating a full cast immediately.

| Situation | Starting script | Required claim |
| --- | --- | --- |
| Fork found | The point is a fork in the continuation. One piece attacks two or more targets at once. | `tactic_played`, `motif=fork` |
| Fork allowed | This lets the other side set up a fork in the continuation. One piece can attack two or more targets at once. | `tactic_allowed`, `motif=fork` |
| Fork missed | There was a fork in the stronger continuation. This move misses that chance to attack two or more targets at once. | `tactic_missed`, `motif=fork` |
| Pin found | The continuation uses a pin. Moving the pinned piece off that line can expose the king or a more valuable piece behind it. | `tactic_played`, `motif=pin` |
| Defender abandoned | That piece had a defender, but this move takes it away. The other side can now capture the piece it was protecting. | `cause_abandoned_defender` |
| Threat unanswered | The previous move threatened a piece. This move leaves that threat unanswered, so the other side can take it. | `cause_opponent_threat_recognition` |
| Unfavorable exchange | The first capture isn't the whole exchange. The other side can recapture, so count what both sides give up. | `cause_avoiding_bad_trades` |
| Forced mate allowed | This move allows a forced checkmate. Follow the continuation to see why even the best defense cannot stop it. | `allowed_mate` |
| Forced mate missed | There was a forced checkmate in the stronger continuation. This move lets that finish go. | `missed_mate` |
| Only playable defense | This was the only move we found that kept the position playable. The other moves we checked were losing. | `only_move` |
| Sound sacrifice | The sacrifice holds up even if it is accepted. Taking the offered material doesn't refute the idea in this line. | `sacrifice` |
| Undefended piece | This move leaves a piece undefended. That alone doesn't mean it can be won. | `unsupported`, actual positional claim only |

Speech selection belongs to dialogue, using the same structured claims as the
bubble. Do not insert fixed recordings as slotless replacements for existing
personality templates: their factual-slot validation must remain intact.

- Match the displayed primary claim through the utterance's variant trace and
  source IDs, with matching intent identity and nonempty evidence. If it has no
  recording, remain silent rather than speaking a less important claim.
- Validate required slots through the existing claim contract. Do not infer a
  tactic or consequence from a grade, facial expression or freeform text.
- Tactical `played`, `allowed` and `missed` codes retain their distinct scope.
  Tactics can occur later in a continuation. Only positional claims currently
  carry `position`; its absence never establishes an actual-board consequence.
- The neutral scripts above address neither player personally. Any later
  character wording using "you" requires the matching learner perspective;
  opponent praise or blame must not be directed at the learner.
- Keep the pilot to known-subject game/variation feedback. Cold and revealed
  practice, restored practice feedback, pending/error states and freeform
  Show-why explanations are outside this first pilot. A retained report does not
  authorize speech when the current position has an error.
- Reuse the existing speech bus, mute, volume, visibility and cancellation.
  Recheck position, coach and utterance after loading a recording. Navigation,
  switching coaches, hiding the tab and unmounting cancel obsolete playback.

Audition in the existing development audio studio with the actual character and
sound mix before release. Acceptance requires clear wording, believable and
consistent character delivery, comfortable levels, no clipped starts/ends,
predictable interruption and desktop/mobile playback without provider requests.
Do not claim compilation or successful decoding establishes voice quality.

For ElevenLabs production, its published [TTS FAQ](https://elevenlabs.io/text-to-speech)
permits paid-plan output in games/apps without extra royalties, and its
[subscription policy](https://help.elevenlabs.io/hc/en-us/articles/15993008593297-What-happens-to-my-content-after-my-subscription-ends)
retains commercial rights for audio generated during a paid subscription after
cancellation. Use an authorized voice and generally available service; verify
the applicable terms at generation time. Free-tier/demo clips are not substitutes
for production assets. Record provider, voice/model identity, script, generation
date, applicable terms, edits and file hashes alongside retained clips. Keep
audio permissions distinct from the repository's code license; these provider
statements do not themselves establish unrestricted relicensing of voice assets.

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
changing account preferences. Existing prerecorded examples are unchanged;
automatic application speech remains disabled and lessons remain out of scope.

### Coverage

Engine tests cover cue precedence, mute/categories, activation failure, duplicates,
delayed and stale decoding, cancellation, hidden tabs, bounded voices, prepared
speech and disposal. Browser tests observe actual Web Audio source starts and
cover the production preference/session/navigation paths without production test
globals. Studio tests exercise all approved assets, source coverage, context timing and cancellation.
Run the affected application/account suites alongside the dedicated audio suite
when changing integration. See [Testing](TESTING.md) and the dated
[verification record](VERIFICATION.md) for commands and actual results.
