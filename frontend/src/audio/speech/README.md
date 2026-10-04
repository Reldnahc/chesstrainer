# Recorded coach speech and authoring history

Walter (`classic`) and Rivet (`robot`) each have a **195-recording voice bank**
(185 non-lesson meanings, the game-review opener and nine generic lesson prompts), using their owner-selected **Older teacher** and **Retro speech terminal**
voices. They share a catalogue of meanings, with separately authored character
scripts and complete recordings. Every clip has automatically generated mouth
timing. See the [Walter manifest](bank/manifest.json), [Rivet manifest](banks/rivet/manifest.json),
[offline verification instructions](bank/README.md) and
[production playback policy](../../../../docs/AUDIO.md#recorded-coach-voices).

Every recording below, including archived takes and design previews, was later
re-encoded from the provider's MP3 to 24 kbps-class Ogg Opus with
`scripts/encode_coach_speech.py`. The history that follows describes the
provider files as they were recorded; each sidecar keeps that MP3's fingerprint
as `providerAudio`, and its mouth timing was regenerated from the Opus file.

Settings offers Automatic, On request and Off under Sound. The other coaches
remain text-only. Playback uses bundled local
recordings without provider access, API keys or runtime synthesis. Exact chess
moves, squares and scores stay in writing while the voice explains the supported
idea. Lessons speak only nine generic prompts (see below); course text stays written.

**The bubble shows what the coach says (owner decision, 2026-10-03).**
[`spokenText.ts`](spokenText.ts) resolves a coach's line for a selected meaning:
the bank recording's text, otherwise the coach's `scripts.json` line, so text-only
coaches show their own scripts too. Only the script coach IDs are bundled; each
coach's records load lazily on first use. Game review shows that line in the move
bubble with a moves line for the exact reply and opening; practice replaces only
one-sentence coach feedback. See
[Bubble text is the spoken line](../../../../docs/COACH_DIALOGUE.md#bubble-text-is-the-spoken-line).

Start the existing studio with `npm --prefix frontend run dev:audio` and open
http://127.0.0.1:5176/. **Walter wording** compares eight representative examples
or all 81 revised passages using Original/Revised controls. Text, local recording
and generated mouth timing switch together. Play a clip alone or following the
approved piece-move sound. Volume, mute and Stop all use the shared audio engine.
Changing the example/version or hiding the tab cancels playback. The visible
character is the real registered Walter. His voice remains locked; this is a
wording comparison, not a voice picker. The earlier voice auditions and full-bank
selector were removed from the tree on 2026-10-03; Git history retains them.

**Recorded coach comparison** lets you switch between Walter and Rivet for the
same meaning, including the eleven opening variants. These are whole recordings,
never runtime sentence splicing.

**A coach never speaks or shows a Maia reading (owner decisions, 2026-10-02 and
2026-10-04).** Maia lives only in the badge and its popup, which holds the written
Maia sentence. On 2026-10-02 all 253 Maia meanings (7 standalone readings and 246
combinations) were removed from speech. On 2026-10-03 five standalone readings
briefly returned for plies where Maia was the only content, and the clock
observations were retired. On 2026-10-04 those five readings were retired again and
Maia left the coach's dialogue entirely: a sound move with nothing else to say
gets the plain best or good line, and the bubble never carries a Maia sentence.
Later Maia data may update the bubble, but does not start a second automatic
response for the same navigation action. Opening Maia's popup is silent.

Book variety follows a verified contiguous sequence. Missing earlier evidence or
exploring a variation uses generic recognition instead of inventing a sequence;
revisiting a position retains its variant. Recognition never asserts move quality.

The [revision record](bank/revisions/walter-language-v2.json) preserves all old/new
scripts and reasons. It removes repeated “continuation” wording, replaces internal
policy language and clarifies hypothetical alternatives. Spoken passages remain
reusable idea-level explanations; exact position details remain written. Original
media and tracks are retained for comparison outside production imports.
The 81 replacement recordings used **7,524 input characters / 907 credits**
(settled provider counter 12,295 to 13,202). Same voice and settings, no retakes,
splicing, padding or manual mouth timing. The subsequent Walter/Rivet pilot adds
the shared opening/combined meanings (the combined ones were later removed with
all Maia speech) and tightens two Walter statements about
engine comparisons and a demonstrated capture; see
[that revision](bank/revisions/walter-pilot-v1.json). Other cast banks remain deferred.

The subsequent pronunciation correction replaces “separate”/“separately” in four
Walter and eighteen Rivet recordings with unambiguous wording. The 22 complete
replacement clips use the same voices, model and settings, with automatically
regenerated mouth timing. Meanings, selection rules and the remaining 854
recordings are unchanged. Superseded takes remain in Git history rather than
shipping duplicate assets; current provenance records the exact replacement text.

Rivet's [wording revision](banks/rivet/revisions/wording-v2.json) reviews all 257
newer additions and replaces 197 complete recordings. The remaining 241 Rivet
recordings and Walter's entire bank stay unchanged. The revision restores concise
chess-event-first wording, removes repeated analysis-method commentary, and keeps
the same supported objective/human meanings. Every changed passage records its
previous text, revised text and editorial reason. The existing **Recorded coach
comparison** panel auditions the current versions with their automatic mouth
timing; no new selection or comparison tool is required.
This revision used **29,270 input characters / 3,540 provider credits**. All 197
saved request IDs matched the provider's history, with no retakes or duplicate
requests. The locked voice, model and delivery settings remain unchanged.

Rivet's [distinct-voice revision](banks/rivet/revisions/wording-v3.json) re-records 294 complete
passages whose wording matched Walter's (or, for ten, Jun, Scout, Wisp or Ziggy)
as Rivet's own labeled readouts, and says "the other side" on plain alert clips
that can play on either side's move. The ledger records each previous text,
revised text and reason. The other 144 Rivet recordings, Walter's bank, meanings
and selection are unchanged; superseded takes remain in Git history.
This revision used **35,305 input characters / 4,270 provider credits**. All 294
saved request IDs matched the provider's history, with no retakes or duplicate
requests. The locked voice, model and delivery settings remain unchanged.

To audition from a phone on the same network, start the studio with
`npm --prefix frontend run dev:audio:lan` instead, then open
`http://<PC-LAN-IP>:5176/` on the phone. Allow the development server through the
PC's firewall on the private network if needed. The normal `dev:audio` command
remains accessible only on the PC itself.

## Audition history

### Selected Walter: contrasting examples

[walter-selected-voice.json](walter-selected-voice.json) records the saved
**Fieldwork Walter - Older teacher** voice, `Q5CWGTzNfIve6iWvrlM7`, derived from
the chosen `older-teacher-1` preview. Saving it preserved Custom 1 unchanged.
[walter-contrasts-plan.json](walter-contrasts-plan.json) contains eight complete
sentences/passages taken directly from the audited game dialogue inventory:
only playable move, sound sacrifice, abandoned defender, forced mate allowed,
recovery, undefended piece, missed fork and unusual strong move.

The eight one-take examples total **830 input characters / 853,821 audio bytes**.
They use Eleven v4, stability 0.5, similarity 0.75 and speed 0.95. No audio tags,
padding, splicing or post-processing were added. Each unchanged MP3 has exact
request and hash provenance in `recordings/walter-contrasts-v1/walter`.
These eight were reused unchanged by the first complete bank. The wording revision
subsequently replaced abandoned defender, allowed mate and missed fork; the five
others remain active. The eight meanings are a subset
of its 92 game-review meanings, not eight additional recordings. The owner
approved their delivery and subsequently authorized completing Walter.

Offline verification:

```sh
node scripts/record_coach_speech.mjs --plan frontend/src/audio/speech/walter-contrasts-plan.json --output frontend/src/audio/speech/recordings/walter-contrasts-v1
```

This historical plan includes the retired Maia contrast `human-unusual-strong`, so the
recorder now refuses it as a whole (coaches no longer speak Maia lines). Its recorded
contrasts stay verified by the bank checks; new plans must contain no Maia readings.

The [whole-app recording inventory](#whole-app-dialogue-inventory) records the
completed non-lesson scope and the deliberately silent exclusions.

### Removed design and refinement auditions

The stock-voice comparison (Bill, George and Brian), the original Voice Design
previews, the short refinement script and the Custom 1 remix, teacher, elder and
combined older-teacher rounds led to the selected voice above. Their recordings,
provenance manifests and plans were removed from the tree on 2026-10-03; Git
history retains them. The saved **Fieldwork Walter - Custom 1** voice
(`ap9rSM4hVTU6JjQ17FrC`) was created from the preferred design preview, and the
selected Older teacher voice was derived from its combined remix. Those rounds
used about 700 provider credits together; the stock-voice comparison used none.

## Permissions and attribution

Generated using ElevenLabs on the owner's active paid Creator subscription, with
Eleven v4 for the premade voices and selected Walter examples, Voice Design v3 for the original previews and
Voice Remix for the refinements.
This is generated audio, not recordings of an
actor hired by Fieldwork or a voice cloned by this project. Provider descriptions
are credited as descriptions, not presented as an independent listening review.

The recordings are separate media assets, not CC0 sound effects. Do not silently label
them with the application's source-code license. They are included for playback
and redistribution with Fieldwork; installers need no
ElevenLabs account or ongoing subscription to play these local files.

The following provider sources were checked on September 30, 2026:

- [Terms of Service, sections 2(c) and 4](https://elevenlabs.io/terms-of-use):
  paid commercial use and downloaded output use outside the service, subject to
  its terms and prohibited-use policy; output rights are retained as between
  the user and ElevenLabs.
- [Text-to-speech FAQ](https://elevenlabs.io/text-to-speech): paid-plan output can
  be used in games and applications without additional royalties.
- [Subscription expiry policy](https://help.elevenlabs.io/hc/en-us/articles/15993008593297-What-happens-to-my-content-after-my-subscription-ends):
  commercial rights for paid-period generations remain after cancellation.

Keep this notice and the provenance alongside redistributed audition recordings.
These statements do not grant rights to ElevenLabs models, another person's
identity, or unrestricted use of its service. Recheck applicable terms when
creating new recordings, especially when changing voice source or service tier.

## Record selected examples

The local authoring CLI reads `ELEVENLABS_API_KEY` only from its process
environment. Never use a frontend-prefixed environment variable or put the key
in the plan, source, browser storage, container or command arguments.

An already-running Windows terminal can load a saved user-level variable without
printing it:

```powershell
$env:ELEVENLABS_API_KEY = [Environment]::GetEnvironmentVariable("ELEVENLABS_API_KEY", "User")
```

```sh
# Safe by default: inspect the plan and verified existing files without requests.
node scripts/record_coach_speech.mjs --plan PLAN.json --output DIR
```

An identical valid recording is reused. A changed request or mismatched file is
an error, not permission to overwrite or spend again. Use a new output directory
or explicit new take for an intentional comparison. Generation is sequential
and paid requests are not automatically retried after a failure. Normal app
builds, tests and studio playback never run the authoring command.

Verify the CLI offline with `node --test scripts/record_coach_speech.test.mjs`.
Auditory quality remains an owner listening decision: decoding, tests and
measurements cannot choose Walter's personality or establish natural delivery.

## Walter dialogue inventory

The original source audit traced all 64 dialogue template codes, current intent
builders, tactic producers and Walter's actual renderer (`classic` →
`storyteller-4`). Of 55 game/variation-emittable codes, 52 structured codes are
covered after excluding transient and legacy prose. The
[game inventory](walter-dialogue-inventory.json) retains each script, source,
eligibility condition and primary/secondary designation.

| Game family | Primary-capable | Secondary only | Bank recordings |
| --- | ---: | ---: | ---: |
| Tactical mechanisms and mover-caused errors | 31 | 2 | 33 |
| Positional explanations | 12 | 12 | 24 |
| Objective consequences, resources and game endings | 12 | 2 | 14 |
| Human-model insights | 4 | 3 | 7 |
| Opening and clock context | 5 | 0 | 5 |
| Relationships within/between games | 7 | 2 | 9 |
| **Total** | **71** | **21** | **92** |

This table is the original audit. The seven human-model insight recordings were
removed on 2026-10-02 when Maia speech was retired, leaving 85 game meanings.

The initial 71-primary pilot was a staging proposal, not the completed product
scope. The owner later approved the full non-lesson bank. All 92 game meanings
are recorded, but a secondary recording does not become an automatic replacement
for a missing primary. Game selection follows the first successfully rendered
claim and preserves its source identity, required slots, actor and line scope.
Explicit secondary listening is limited to the currently visible supported claim.

The catalogue uses complete reusable teaching passages. It never reads dynamic
moves, squares, scores, names or historical counts aloud, stitches word fragments,
or infers chess explanations from grades or facial expressions. Actual and
hypothetical positional effects remain separate recordings; mover-caused mistakes
remain distinct from an opponent executing a tactic. A forced-mate continuation
is not the same as an actual board checkmate. Model evidence stays an estimate.

## Whole-app dialogue inventory

**Lesson narration stays written; generic lesson prompts are voiced.** Authored
passages, step titles, hints, game notes and choice feedback stay written, because a
growing course catalogue must not require maintaining a voice library for every
edit. On 2026-10-02 the owner approved nine reusable prompts that never change with
a course, in the `lessons` group of [meanings.json](meanings.json): wrong move,
correct move, move revealed, follow the line, play your studied move, exploring an
alternative, chapter complete, full game opened and lesson error. Each lesson
command response is one event that plays at most one of them
(`lessonRecording` in [practiceSelection.ts](practiceSelection.ts)); hints and game
navigation stay silent. A coach's lesson prompts may be authored before they are
recorded and stay silent until then. The earlier lesson inventory remains in Git
history at `054cd80`, outside this bank.

The [full inventory](walter-full-dialogue-inventory.json) contains 185 audited
meanings, with four deliberately silent transient/defensive states excluded from
the **original 181-recording bank** (later extended to 438 shared meanings, and
cut to 185 non-lesson meanings when the seven human-model insights and 246 Maia
combinations were retired on 2026-10-02):

| Coverage | Recordings |
| --- | ---: |
| Game review, variations and human insights | 92 |
| Additional SRS feedback, explanations, findings, cues and notes | 68 |
| Opening recall and preview | 10 |
| Puzzle guidance | 8 |
| Finite review statuses | 3 |
| **Completed bank, excluding lessons** | **181** |

The original scripts totaled **16,936 input characters / 2,888 words**. Eight earlier
recordings contain 830 characters; completing the bank required **173 new
recordings / 16,106 input characters**. These are script counts, not provider
billing units or guaranteed durations. Retakes, other voices and auditions belong
to their own usage records. All active entries now have media and generated mouth
tracks; there is no remaining unrecorded subset hidden in this count.

The October 1 completion batch used **1,948 ElevenLabs credits** for the 173 new
clips. This is the sum of usage deltas on all 173 matching provider request IDs,
not an estimate from character counts. Earlier auditions and the eight reused
recordings are excluded. No retakes were needed in this batch.

The 197 non-lesson source rows deduplicate to 185 meanings through 12 cross-surface
reuses. Eleven game clips are reused by SRS explanations, and one practice error
clip also serves opening recall. The four excluded entries are game thinking,
practice checking, explanation loading and the no-renderable-claim fallback.
Nine bounded plans in `bank/plans/` retain the recorder's 20-request maximum.
Existing examples are referenced from their original paths, without duplicate
binaries or another paid generation.

The bank's completeness describes the supported finite summary design. It does
not claim to narrate arbitrary manual-exercise prose, legacy text, imported game
commentary, raw errors or every visible paragraph. It does not narrate buttons,
headings, badges, scheduling receipts, settings or provenance help.

### Playback boundaries

Production selection consumes structured facts at their existing authority
boundary. Cold SRS may speak neutral task instructions, never themes, evaluations,
best moves or future continuation facts. Opening an untouched puzzle in-app speaks
its neutral ready line once; reloads and puzzles with moves stay silent until Listen.
In due review and opening recall, the first cold card of a session speaks its
ready line and any card returning after a failure speaks its retry line; later
cold cards and restored attempts stay silent until Listen, so a long queue does
not repeat the same sentence.
Opening an untouched game review in-app at its start speaks the coach's fact-free
greeting once and shows it in the bubble; the first navigation replaces it,
returning to the start shows and speaks it again, and restored later moves stay
silent.
A game-review move whose whole line is its grade's generic reading (the
evaluation loss and stronger alternative for an inaccuracy, mistake, miss or
blunder; the best or good choice for a brilliant, great, best or good move)
speaks one of four `grade-<grade>-<n>` takes instead (`gradeTake` in
[gameSelection.ts](gameSelection.ts)). A capture, check, tactic, mate, opening or
relationship keeps its own clip. Each mainline move counts the earlier moves with
the same grade, so neighbouring same-grade moves never share a take and replaying
a move repeats its take; the game seeds where the cycle starts. A coach without a
take recorded keeps the generic reading.

A line about one particular piece also has **piece variants** that name it ("the
pinned knight" instead of "a pinned piece"). Each is a catalogue meaning
`<base>-<piece>` with `variantOf` and `pieces` in [meanings.json](meanings.json),
listing only the pieces that can occur there: a pin never holds a king, a
back-rank mate is a rook or queen, an undefended capture is never a pawn, and the
explanation double check names both checkers (`knight-rook`). There are 271
variants over 60 base meanings. [pieceVariants.ts](pieceVariants.ts) reads the
piece from the evidence that selected the clip: a tactic's witness roles and
their `pieces`, a positional fact's `piece`, an explanation finding's roles on its
frame board, a capture frame's `capture`, and for a brilliant take the piece the
sacrifice's accepting capture takes. A role square holding the wrong side's piece,
or roles holding different pieces, names nothing. Selection then offers
`<variant>|<base>`: playback, mouth timing and the bubble use the first
alternative the coach has recorded (or, without a bank, scripted), so the
generic clip stays the fallback and a coach with no variant recorded is
unchanged. All 30 coaches have every variant written (Walter's and Rivet's in
`banks/pilot-additions.json`, the others in their `scripts.json`) and reviewed;
none is recorded yet. The written lines keep to piece facts the generic lines
could blur: a pawn forks two pieces, a pawn never steps aside, only a knight
hops, a pinned knight has no legal move while a pinned pawn, bishop, rook or
queen can still move along the pin line, and a back-rank allowed or missed line
names an idea, not a mate.
`game-review-opened` and the nine lesson prompts are recorded for Walter, Rivet,
Winston and Button, so each registered bank holds all 195 catalogue meanings.
These 40 takes used **2,262 input characters / 273 provider credits**, with every
request ID matched in the provider history and no retakes.
Authorized attempt/reveal feedback may
select supported explanations; a reveal is never praised as an unassisted success.
Restoring saved feedback does not create a new narration event. Opening acceptance
means selected repertoire membership; puzzle acceptance means the authored answer.

Current position, session, attempt, selected finding, coach and utterance identity
must remain valid after asynchronous loading. Navigation, retries, hiding, mute,
coach changes and unmounting cancel stale work. Human popovers and explanation
notes have explicit listening controls rather than background narration. The
complete [Audio documentation](../../../../docs/AUDIO.md) describes production
controls and lifecycle; source-specific conditions remain in the two inventories.
