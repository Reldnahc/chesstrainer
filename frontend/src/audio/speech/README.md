# Walter voice audition

This is a development-only comparison of prerecorded voices for Walter
(`classic`), including an original Voice Design experiment. The owner selected
**Older teacher** as Walter's voice. That refinement is now saved, with eight
contrasting TTS examples available for listening. The application does not
automatically speak, call a speech provider, or require an API key.

Start the existing studio with `npm --prefix frontend run dev:audio` and open
http://127.0.0.1:5176/. The default **Walter examples** collection has eight short
examples in the selected voice. Teacher & elder compares **Older teacher**,
**Teacher** and **Elder**, with one sample per prompt. Walter refinements
similarly shows one Warmer and one Playful sample. Custom Walter keeps the
owner-preferred Custom 1 preview. Original voices retains Bill, George and
Brian with four individual teaching examples. Play a clip alone or following the
approved piece-move sound. Volume, mute and Stop all
use the shared audio engine. Changing the example/voice or hiding the tab cancels
playback. The visible character is the real registered Walter, not a substitute.

To audition from a phone on the same network, start the studio with
`npm --prefix frontend run dev:audio:lan` instead, then open
`http://<PC-LAN-IP>:5176/` on the phone. Allow the development server through the
PC's firewall on the private network if needed. The normal `dev:audio` command
remains accessible only on the PC itself.

## Recording set

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
These eight are a subset of the 92 planned game scripts, not eight additional
meanings or authorization to generate the rest. They test production TTS delivery
of the selected remix; audible character quality remains an owner listening decision.

Offline verification:

```sh
node scripts/record_coach_speech.mjs --plan frontend/src/audio/speech/walter-contrasts-plan.json --output frontend/src/audio/speech/recordings/walter-contrasts-v1
```

The [whole-app recording inventory](#whole-app-dialogue-inventory) expands the
earlier game-only count. It is planning, not a bulk recording request.

### Earlier stock-voice comparison

The source-audited [Walter dialogue inventory](#walter-dialogue-inventory)
below plans the next pack. Its draft scripts are not generation authorization.

| Candidate | ElevenLabs voice | Provider voice ID |
| --- | --- | --- |
| A | Bill — Wise, Mature, Balanced | `pqHfZKP75CvOlQylNhV4` |
| B | George — Warm, Captivating Storyteller | `JBFqnCBsd6RMkjVDRZzb` |
| C | Brian — Deep, Resonant and Comforting | `nPczCjzI2devNBz1zQrb` |

The same four scripts cover an only playable defense, an abandoned defender,
forced mate allowed, and a fork found. These are labelled teaching examples, not
analysis of an actual game. Written and spoken text are identical for this voice
comparison. Production selection must still follow the supported-claim rules in
[Audio](../../../../docs/AUDIO.md), including actual/alternative scope,
learner perspective and silence where a matching recording is unavailable.

[recording-plan.json](recording-plan.json) is the source of the scripts, voice IDs,
model and settings. Each MP3 in `recordings/pilot-v1` has a provenance sidecar with
its exact request, generation time, output size and SHA-256. Recordings are whole
sentences; no words are stitched together, and no pitch or timing edits are used.

## Original Walter design

The owner preferred an original character voice to variations of a stock voice.
One text-only design request describes a mature American mentor with a warm,
rounded register, light natural grain, clear articulation and restrained wit.
It includes no reference audio, Bill recording or cloned person's voice.

[design-preview.json](design-preview.json) records the exact request, model
(`eleven_ttv_v3`), generated preview IDs, time, durations, byte counts and hashes.
The 571-character preview joins the four original teaching examples. ElevenLabs
returned three alternatives from that single request, lasting approximately
38, 45 and 40 seconds. The unchanged MP3s in `recordings/custom-v1` total
1,965,378 bytes. Labels describe the design intent, not a listening verdict.

These are Voice Design previews, not four separately synthesized clips or a
production voice selection. The owner preferred **Custom 1** to Bill and approved
saving it as **Fieldwork Walter - Custom 1**. It was saved through ElevenLabs'
Create voice endpoint on October 1, 2026 UTC with voice ID
`ap9rSM4hVTU6JjQ17FrC`, preserving the selected preview as the refinement baseline.
No additional audio was generated by this save. Keep the original preview intact.
Future TTS should be auditioned separately because the original stock-voice clips
use `eleven_v4`. A custom design does not establish legal exclusivity or guarantee
that no other voice sounds similar.

### Short refinement auditions

Use [walter-short-plan.json](walter-short-plan.json) for the next baseline TTS
audition and its same script for any voice remixes. It contains **140 characters**,
24.5% of the original 571-character preview, targeting roughly 10 seconds rather
than 40. Actual duration and provider charges depend on the generation. The
script preserves one complete teaching idea and tests warm praise followed by
calm explanation. Avoid returning to the four-example script for routine tweaks.

This TTS plan's v4 delivery has not yet been auditioned; its short script is used
by the remix previews below. The saved voice identity comes from the preferred
v3 design preview. Keep the baseline unchanged when comparing refinements, and
use a new output directory for each take. The existing dry-run-first recorder
supports this plan:

```sh
node scripts/record_coach_speech.mjs --plan frontend/src/audio/speech/walter-short-plan.json --output frontend/src/audio/speech/recordings/walter-short-v1
```

Without `--generate`, this validates the plan and reports one prospective request,
140 characters, without using credentials, spending credits or writing audio.

### Custom 1 refinements

[refinement-previews.json](refinement-previews.json) preserves two requests to
`POST /v1/text-to-voice/ap9rSM4hVTU6JjQ17FrC/remix`, using the saved Custom 1 voice.
Both use the same 140-character script. **Warmer** asks for a more personable,
reassuring delivery; **Playful** adds restrained wit and varied emphasis. Both
ask to preserve the original age, accent, pitch and natural grain. Prompt strength
is 0.22, with guidance 2, to keep the changes small. These are design directions,
not independent listening assessments.

Each request returned three previews, lasting **8.36–8.68 seconds**. The six
unchanged MP3s total **817,794 bytes**. The settled usage counter increased by
**280 credits** for both requests together. There were no retries or additional
TTS requests. No remix has been saved as another permanent voice or replaced the
selected baseline. Generated preview IDs remain in the manifest for a later
owner selection.

The remix endpoint does not accept an explicit model ID or report one in its
response. Its manifest therefore records `modelId: null`, and the studio credits
the model as provider-selected rather than asserting that these are v4 TTS clips.
Recording times, exact prompts, settings, IDs, durations and hashes are retained.
The same shared player loads these files locally; replay costs no credits.

API reference: [Remix a voice](https://elevenlabs.io/docs/api-reference/text-to-voice/remix).

### Teacher and elder directions

The owner requested a more educational or older delivery. Both directions in
[mentor-previews.json](mentor-previews.json) start from the saved Custom 1 voice;
the earlier warm/playful previews have not been replaced. **Teacher** asks for
patient explanatory phrasing, clear articulation and thoughtful emphasis.
**Elder** asks for a subtly older, reflective voice with gentle authority, while
avoiding frailty or an exaggerated rasp. Each direction returns three alternatives.
These labels describe the requested performances, not measured qualities.

The shared **141-character** script ends with a complete takeaway: “That's the
value of a careful defense.” The earlier sample instead finished by promising
an explanation it did not go on to give. Both new prompts ask for a settled
cadence, a fully pronounced final word and a comfortable pause. Two requests
used **282 credits** in total. No new permanent voice was saved.

Inspection of the previous six untouched MP3s found very short quiet endings
in four recordings (about 8–15 ms below -40 dBFS). A runtime check confirmed all
six played their complete decoded duration with no source stop calls or speech
cancellations. The new provider recordings also left only about 1–59 ms below
-40 dBFS at the end despite the prompts.

The owner explicitly chose to keep these examples unpadded. The studio plays
the unchanged provider MP3s, with no trimming, fades, re-encoding or playback
timing changes. The ending experiment is in the conclusive wording and requested
delivery. The owner should judge that performance by listening.

### Combined older teacher and one sample per prompt

The owner found the three variations of each refinement too similar to warrant
separate audition choices. The studio now exposes the first returned preview
for each prompt, and only the preferred Custom 1 from the initial design.
Earlier alternative files and their original provenance remain archived in
source; hiding a choice does not rewrite its generation history. Stock voices
remain separate because Bill, George and Brian are different voices.

[older-teacher-preview.json](older-teacher-preview.json) records one combined
prompt: Elder's older, reflective warmth with Teacher's patient, clear explanatory
delivery. It remixes the saved Custom 1 voice using the same 141-character
concluding script. This is one combined performance direction, not audio splicing
or a literal mixture of two recordings. The unchanged **9.09-second** sample is
shown as **Older teacher** alongside Teacher and Elder for comparison.

The provider returned three candidates in that request; only the first is retained
in this new checked-in set, with the returned count recorded. No extra request
was made for each candidate. Future auditions should likewise show one sample
per prompt unless the owner specifically asks to compare takes. No padding or
permanent voice replacement was performed. The settled provider usage increased
by **141 credits** for this request.

The original design used `POST /v1/text-to-voice/design?output_format=mp3_44100_128`
with its manifest's `request` object and the process-only API key. Generation was
explicitly requested; builds and playback never call this endpoint. API rejection
confirmed that Bill cannot be directly remixed with this account. The design's
v3 model also rejects the `quality` parameter, despite that parameter appearing
in the shared endpoint documentation; the retained successful request omits it.

Sources: [Voice Design guide](https://elevenlabs.io/docs/eleven-creative/voices/voice-design),
[Design API](https://elevenlabs.io/docs/api-reference/text-to-voice/design).

## Permissions and attribution

Generated using ElevenLabs on the owner's active paid Creator subscription, with
Eleven v4 for the premade voices and selected Walter examples, Voice Design v3 for the original previews and
Voice Remix for the refinements.
This is generated audio, not recordings of an
actor hired by Fieldwork or a voice cloned by this project. Provider descriptions
are credited as descriptions, not presented as an independent listening review.

The MP3s are separate media assets, not CC0 sound effects. Do not silently label
them with the application's source-code license. They are included for playback
and redistribution with Fieldwork and its audition tool; installers need no
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
node scripts/record_coach_speech.mjs --plan frontend/src/audio/speech/recording-plan.json --output frontend/src/audio/speech/recordings/pilot-v1

# Explicit generation, limited to a selected voice/example.
node scripts/record_coach_speech.mjs --plan frontend/src/audio/speech/recording-plan.json --output frontend/src/audio/speech/recordings/pilot-v1 --voice a --script only-defense --generate
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

This planning audit replaces the earlier unsupported 80–120 estimate. It is
based on the repository at `839da3e`, including the actual selectable Walter
(`classic`, `storyteller-4`), rather than the separate Professor character.
The owner selected **Older teacher**. No further audio or saved-voice request
was made for this audit.

[walter-dialogue-inventory.json](walter-dialogue-inventory.json) contains every
draft spoken sentence, stable recording ID, claim code, source reference,
eligibility condition and primary/secondary status. It is deliberately a
planning inventory, **not** an executable ElevenLabs recording plan.

### Exact scope and counts

The design uses one whole recording per supported teaching meaning. It retains
the existing agreement that exact moves, squares, opening names, evaluations
and historical counts stay in writing. It does not read every bubble verbatim,
stitch individual words, invent reasons from ratings or multiply recordings for
White/Black when a complete side-neutral sentence is sufficient.

| Family | Can lead the main bubble | Secondary only | Complete bank |
| --- | ---: | ---: | ---: |
| Tactical mechanisms and mover-caused errors | 31 | 2 | 33 |
| Positional explanations | 12 | 12 | 24 |
| Objective consequences, resources and game endings | 12 | 2 | 14 |
| Human-model insights | 4 | 3 | 7 |
| Opening and clock context | 5 | 0 | 5 |
| Relationships within/between games | 7 | 2 | 9 |
| **Total recordings** | **71** | **21** | **92** |

The **71** primary scripts contain **1,227 words / 7,182 characters**. The full
**92** contain **1,619 words / 9,522 characters**. These totals count spoken
strings only, not labels, metadata or alternative takes. They are not a provider
price quote or a duration measurement. One performance per script is planned;
additional wordings for repetition control are optional, not coverage necessities.

These are counts of this explicit summary catalogue, not a universal minimum
across every conceivable writing approach. Primary eligibility is established
by source analysis and checked with focused synthetic rendering probes; it is
not a measured percentage of real games or an end-to-end speech test.

### Tactical coverage: 31 primary recordings

| Verified mechanism | Played | Allowed | Missed |
| --- | --- | --- | --- |
| Fork | Required | Required | Required |
| Pin | Required | Required | Required |
| Skewer | Required | Required | Required |
| Removing a defender by capture | Required | Required | Required |
| Back-rank mate | Required | Deferred | Deferred |
| Promotion | Required | Required | Required |
| Discovered attack | Required | Required | Required |
| Double attack | Required | Required | Required |
| Deflection | Required | Required | Required |
| Undefended capture | Required | Not emitted under this name | Required |
| Hanging piece | Not emitted under this name | Required | Not emitted under this name |

That is **28** primary tactical recordings, plus **three** distinct mover-caused
explanations: abandoned defender, unanswered preceding threat and unfavorable
capture/recapture. The mover causes are never narrated as opponent-executed
tactics. All tactical scripts refer to a continuation; the witness can be later
than the currently displayed board. They do not promise a material win merely
because a motif was recognized.

Allowed/missed back-rank mate recordings are deferred because the forced-mate
claim outranks them for coherent engine scores and continuations. This particular
exclusion relies on that score/line consistency; an inconsistent synthetic report
can bypass it. Broader taxonomy labels do not justify more scripts: trapped-piece
and relative-pin defense probes exist in classification, but the present game
review line producer does not call those probes.

### Positional coverage: 12 primary recordings

Development; open rook file; semi-open rook file; passed pawn; advancing an
already-passed pawn; isolated pawn; added piece support; lost support; new king
flight square; castling; bishop-pair loss; doubled pawns.

There are 11 claim codes, but open and semi-open files need different explanations.
Every meaning has a separate hypothetical script, making **24** in the complete
bank. All **12 hypothetical versions are deferred**: gameIntent includes them
only for poor moves, whose evaluation loss, mate or stronger consequence necessarily
leads the bubble. They can still appear as its second written claim.

These recordings make no ownership or strategic-value claim. The written bubble
identifies the affected side/piece and the selector must validate them against
the source event. “Undefended” does not mean lost; a passer advance proves the
pawn was passed before the move; a doubled-pawn event can remove one doubled file
while leaving another. The scripts preserve those distinctions.

### Remaining primary coverage: 28 recordings

- **Nine objective explanations:** forced mate allowed, forced mate missed,
  sound sacrifice, only playable move found, only advantage-preserving move
  found, immediate capture in reply, evaluation loss, the supported Best
  fallback, and Good. Grade names alone do not trigger recordings.
- **Three endings:** finishing checkmate, being checkmated and automatic draw.
  Checkmate requires the actual board outcome, not merely a recorded result or
  a winning/losing portrait. Finishing and losing retain different teaching
  responses rather than duplicate delivery takes.
- **Four human insights:** unusual but strong, hard find, natural best move,
  natural strong move. Scripts describe model evidence; no calibrated success
  percentages or claims to know what the learner was thinking.
- **Two opening observations:** recognized book move and first departure from
  the recognized book. `book` and `book_sound` share one recognition recording;
  recognition never becomes a blanket claim that the move is objectively good.
- **Three clock observations:** little recorded time remaining, quick move with
  time available, and a long recorded think. No claim that time caused an error.
- **Seven game relationships:** recovery, recovery helped by opponent errors,
  opportunity used, opportunity missed, support restored, gradual deterioration
  and advantage converted. They require the saved learner's supported mainline
  context; variations cannot inherit them.

The seven other deferred files cover a checking reply, stronger alternative,
natural mistake, difficult defense missed, difficult defense found, repeated
issue in this game and recurrence in saved history. Each has a stronger primary
claim whenever its production conditions hold. The three deferred human lines
could be primary in the existing human-insight popover, but opening/narrating
that surface needs an explicit policy; rendering a hidden popover must not speak.

### What these totals do not cover

The complete template partition reconciles without omissions:

- **64** named template codes exist; **55** can be emitted in game/variation mode.
- **52** structured game codes map to the inventory. `thinking`, `unavailable`
  and unrestricted `compatibility` account for the other three game-mode codes.
- The remaining **nine** are five practice-only codes, two freeform explanation
  codes and two template-only codes with no current production emitter
  (`uncertain_reason` and `variation`). A branch uses ordinary game claims.

SRS feedback, Show why, opening recall, lessons, full-game lesson exploration,
puzzle instructions and opening-preview guidance have all been inspected. They
are explicitly separate surfaces, not hidden additions to the count. Several
bypass the semantic renderer or contain arbitrary authored/server text. Full
lesson narration would require its own course-version inventory; exact narration
of arbitrary PGN commentary cannot be covered by a fixed finite library. Cold
practice must retain its existing answer-hiding boundary.

### Proposed next step

Review the **71-script primary pack** before generation. It covers every identified
primary-capable meaning under the existing pilot scope, without paying for 21
clips that policy cannot select. The extra 21 are already drafted if the owner
chooses to narrate subordinate claims or explicit human-insight playback later.
No broader narration policy is approved by this inventory.

The selected Older teacher refinement has now been saved and eight contrasting
lines generated above. Before a larger paid batch, the owner should evaluate
whether that production TTS delivery matches the chosen preview.
The existing recorder caps plans at 20 requests, so a 71-file pack needs at least
four bounded batches. Do not relax that safety limit or issue the requests from
this document. Scripts, delivery, repetition policy and production integration
still require their own quality review.

## Whole-app dialogue inventory

**Owner decision: defer all lesson narration.** A growing course catalogue must
not require recording and maintaining a new voice library for every lesson edit.
This includes authored passages, hints, annotated games, reveals and fixed lesson
guidance. Written lessons continue unchanged. The earlier 334-recording lesson
inventory remains in Git history at `054cd80`, outside the active plan.

[walter-full-dialogue-inventory.json](walter-full-dialogue-inventory.json) now
contains **185 distinct proposed recordings for Walter**. It retains the exact
draft scripts, source/trigger references, shared-recording mappings and exclusions.
Unrecorded rows are not approved for generation just because they are listed.

| Coverage | Distinct recordings |
| --- | ---: |
| Game review, variations and human insights; full primary + secondary bank | 92 |
| SRS feedback, Show why, selected tactical findings, teaching cues and explanation notes | 68 |
| Opening recall and opening preview | 10 |
| Puzzle-player guidance | 8 |
| Operational states and defensive fallback | 7 |
| **Total, excluding lessons** | **185** |

Recommend leaving four operational entries silent: game analysis in progress,
checking a practice move, loading an explanation, and the defensive no-renderable-
claim fallback. That leaves **181 recordings** in the practical pack. **Eight are
already recorded as auditions, leaving 173**. Keeping all four optional statuses
would instead leave 177 unrecorded. No new audio was generated by this scope change.

The full non-lesson draft is **17,096 characters / 2,913 words**; omitting those
four entries gives **16,936 characters / 2,888 words**. These are exact counts of
the listed text, not a provider price quote. Retakes and wording edits can change
actual input. Other coaches, alternate phrasings and translations are not
multiplied into the total.

### Meaning and counting method

This is an explicit finite recording design, not a count of every possible
sentence in the application. Complete, reusable sentences explain supported
ideas; exact moves, squares, scores, historical counts and player names remain
written. No chopped-word assembly is proposed. Optional personality introductions
do not multiply every factual recording.

The source audit at `855fbc5` traced the production intent builders, renderer and
feedback producers. After excluding lessons, **197 source rows − 12 cross-surface
reuses = 185 scripts**. Eleven game recordings are reused by SRS explanations;
one SRS error recording is also used by opening recall. The eight new Walter
examples are already part of the game bank, not eight extra meanings.

SRS/explanations contain **79 meanings**, yielding **68 additions** after those
11 game reuses. These include 20 whole move-frame combinations (capture,
promotion, check, mate, escape from check, legal castling combinations and the
original position), 25 tactical witness meanings, 13 supported teaching cues,
practice feedback and explanation notes. The 19 non-start combinations were
checked against legal chess positions. A collected fork, a pin preventing
recapture and a pin restricting escape retain distinct explanations.

### Playback boundaries

The full count includes optional explicit playback of secondary claims, selected
findings/cues and explanation notes. It does not replace the original main-bubble
policy with automatic reading of everything. The human popover's seven claim
meanings are in the game bank; its help/provenance paragraphs remain interface
copy. The puzzle framework has eight fixed dialogue states; no installed authored
puzzle collection is being claimed as narrated.

All lessons are deferred. Arbitrary manual-exercise prose, legacy coach text,
raw runtime errors and imported commentary remain written unless separate authored
audio exists. A generic acknowledgment does not cover an arbitrary teaching
explanation. Buttons, headings, badges, toasts, scheduling receipts and settings
or provenance help are not coach dialogue.

Some current practice summaries and frames need explicit structured speech facts
before a selector can use this plan. Do not parse English or infer reasons from
a grade or portrait. Preserve cold-SRS gates, actual versus alternative scope,
attempt identity and cancellation of stale requests. Revealing an answer must
never sound like unassisted success; restored feedback must not trigger a new
reward. Changing coaches changes presentation without rewriting chess evidence.

Only the eight contrasting examples have been generated. Review scripts and
performances before further generation; preserve the existing 20-request batch
limit. The remaining 173 recommended recordings require at least nine bounded
batches. Lesson additions and edits must not automatically expand this voice pack.
