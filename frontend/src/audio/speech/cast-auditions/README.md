# Nonhuman coach voice-design auditions

This is a development-only casting collection. `design-plan.json` has sixteen
approved coaches with three independently written voice directions each: **48
active auditions**. The four remaining nonhuman briefs—alien, living pawn, slime
and mushroom—are preserved separately in `deferredCoaches` while explicit owner
approval is pending. They are excluded from generation and completion checks.
No voice is selected for production or saved in an ElevenLabs account by these tools.

`manifest.json` contains the available retained previews. Partial coverage is
expected while recording; the final strict check requires every active direction.
The studio must not import this collection into normal application playback.

## Bounded authoring

From the repository root, a dry run needs no key and makes no writes or requests:

```powershell
node scripts/design_coach_voices.mjs --coach robot --direction retro-terminal
```

After the owner has authorized the request and the plan's phase gate is met,
`--generate` makes an explicitly paid request using only the process environment's
`ELEVENLABS_API_KEY`:

```powershell
node scripts/design_coach_voices.mjs --generate --coach robot --direction retro-terminal
```

Coach and direction filters are repeatable. Omitting them selects all 48 active
directions; existing verified previews are reused without a request. Deferred
briefs cannot be selected with these filters and require an approved plan update.
Requests are sequential, bounded to the plan, timed out and never automatically
retried. The tool calls only ElevenLabs' [Voice Design endpoint](https://elevenlabs.io/docs/api-reference/text-to-voice/design),
with `eleven_ttv_v3`, the exact prompt and script, deterministic 31-bit seed,
`auto_generate_text: false`, loudness `0.5` and guidance scale `3.5`.

Each request returns three candidate previews. One candidate is retained per
distinct prompt: the provider-reported duration closest to nine seconds, with
original response order breaking ties. This is a deterministic sampling policy,
not an automated judgment of voice quality. Unselected audio is not published.
The selected MP3 is decoded directly from the response's base64 without trimming,
padding or postprocessing. Returned script text must match the requested text.

Every retained recording has a `.provenance.json` sidecar containing the exact
request/prompt/script/seed, request fingerprint, source audio hash and length,
request ID when safe to retain, and selected preview index, generated voice ID,
language, media type and provider-reported duration. Generated voice IDs preserve
the option to save an approved design later; they do not consume saved-voice slots.

Before each paid request, an exclusive durable attempt is written under ignored
`.tools/voice-design-attempts`. Response headers update its request ID/status even
when the request fails. The selected paid audio is staged there before publication
so a local write failure does not require another purchase. An incomplete attempt
blocks subsequent POSTs: inspect it and recover the saved result or explicitly
decide what to do, rather than blindly retrying. An output-level lock also prevents
concurrent cooperating authoring runs. Neither raw provider errors nor credentials
are printed or saved. Original MP3/provenance pairs are never overwritten; the
generated manifest is atomically rebuilt from verified pairs after each success.

## Verification

```powershell
node scripts/design_coach_voices.mjs --check
node --test scripts/design_coach_voices.test.mjs scripts/record_coach_speech.test.mjs
```

`--check` is read-only, needs no provider key, and requires complete active-plan coverage
plus an exact matching manifest. It verifies source bytes and request identity;
it does not claim perceptual voice quality or prove provider pronunciation.
Usage totals belong to the separately captured provider usage record, not an
estimate derived from script characters.
