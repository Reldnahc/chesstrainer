# Recorded coach speech and authoring history

Walter (`classic`) and Rivet (`robot`) each have a **438-recording non-lesson voice
bank**, using their owner-selected **Older teacher** and **Retro speech terminal**
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
idea. All lessons remain excluded.

Start the existing studio with `npm --prefix frontend run dev:audio` and open
http://127.0.0.1:5176/. **Walter wording** compares eight representative examples
or all 81 revised passages using Original/Revised controls. Text, local recording
and generated mouth timing switch together. Play a clip alone or following the
approved piece-move sound. Volume, mute and Stop all use the shared audio engine.
Changing the example/version or hiding the tab cancels playback. The visible
character is the real registered Walter. His voice remains locked; this is a
wording comparison, not a voice picker. The earlier voice auditions and full-bank
selector remain in isolated browser-test fixtures, outside normal studio use.

**Recorded coach comparison** lets you switch between Walter and Rivet for the
same meaning, including eleven opening variants and 246 combined objective
and human-play explanations. These are whole recordings, never runtime sentence
splicing. The objective explanation must actually render in the bubble; the
human fact must render there or in the exact insight represented by its visible
badge. Both pass current evidence checks. Later Maia data may update the bubble, but
does not start a second automatic response for the same navigation action.
An explicit Listen request from Maia's explanation consumes any pending automatic
response for that action, including audio that is still loading.

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
the shared opening/combined meanings and tightens two Walter statements about
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

The [whole-app recording inventory](#whole-app-dialogue-inventory) records the
completed non-lesson scope and the deliberately silent exclusions.

### Earlier stock-voice comparison

The historical comparison below led to the selected Older teacher voice.
These stock voices are retained for audition comparison, not used in the bank.

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

The recordings are separate media assets, not CC0 sound effects. Do not silently label
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

**All lesson narration remains deferred.** Authored passages, hints, annotated
games, reveals and fixed lesson guidance stay written. A growing course catalogue
must not require maintaining a voice library for every edit. The earlier lesson
inventory remains in Git history at `054cd80`, outside this bank.

The [full inventory](walter-full-dialogue-inventory.json) contains 185 audited
meanings, with four deliberately silent transient/defensive states excluded from
the **original 181-recording bank** (now extended to 438 shared meanings):

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
greeting once and shows it in the bubble; the first navigation replaces it, and
restored later moves stay silent.
`game-review-opened` is written for every coach but awaits recording, so the shared
catalogue holds 439 meanings while each registered bank keeps its 438 takes. The
bank tests list it as awaiting recording until those takes land.
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
