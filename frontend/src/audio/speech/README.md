# Walter voice audition

This is a development-only comparison of prerecorded voices for Walter
(`classic`), including an original Voice Design experiment. No voice has been
selected for production. The application does not
automatically speak, call a speech provider, or require an API key.

Start the existing studio with `npm --prefix frontend run dev:audio` and open
http://127.0.0.1:5176/. The default Custom Walter collection contains three previews
returned by one Voice Design request. Original voices retains Bill, George and
Brian with four individual teaching examples. Play a clip alone or following the
approved piece-move sound. Volume, mute and Stop all
use the shared audio engine. Changing the example/voice or hiding the tab cancels
playback. The visible character is the real registered Walter, not a substitute.

## Recording set

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
production voice selection. No preview has yet been saved as a permanent voice
in the account. Preserve the generated preview IDs for selecting a voice through
ElevenLabs' Create voice endpoint; future TTS should be auditioned separately
because the original stock-voice clips use `eleven_v4`. A custom design does not
establish legal exclusivity or guarantee that no other voice sounds similar.

Authoring uses `POST /v1/text-to-voice/design?output_format=mp3_44100_128` with the
manifest's `request` object and the process-only API key. The generation was
explicitly requested; builds and playback never call this endpoint. API rejection
confirmed that Bill cannot be directly remixed with this account. The design's
v3 model also rejects the `quality` parameter, despite that parameter appearing
in the shared endpoint documentation; the retained successful request omits it.

Sources: [Voice Design guide](https://elevenlabs.io/docs/eleven-creative/voices/voice-design),
[Design API](https://elevenlabs.io/docs/api-reference/text-to-voice/design).

## Permissions and attribution

Generated using ElevenLabs on the owner's active paid Creator subscription, with
Eleven v4 for the premade voices and Voice Design v3 for the original previews.
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
