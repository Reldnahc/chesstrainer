# Coach voice-design auditions

This is a development-only casting collection. `design-plan.json` has twenty-nine
coaches with three independently written voice directions each: **87 active
auditions**. All twenty-nine owner selections are saved in ElevenLabs and
recorded in `locked-voices.json`, including Pip's second-round Warm Dublin
companion and Biscuit's fifth-round **Talking puppy, soft**. A locked voice is an
approved design, not a completed dialogue bank. The audition generator itself
never saves provider voices.

Eight of the nine newer humans are locked from their first round: Femi (Seasoned
club analyst), Jun (Senior master), Arjun (Chennai club mentor), Tamar (Tbilisi
mentor), Marisol (Havana observer), Réka (Budapest attacker), Mateo (Bright Buenos
Aires) and Tala (Bright Manila solver). The owner judged Ingrid's **Oslo easygoing**
very close; round one is archived in `archive/round-1-ingrid.json` and replaced by
three close variations on it. Those (warm, bright and grounded, in
`archive/round-2-ingrid.json`) did not sound like women, so round three states a
woman's voice explicitly: **Oslo woman, warm**, **bright** and **soft**. The owner
chose and locked **Oslo woman, soft**. Ingrid's second and third rounds used **852
credits** across six requests (33,857 → 34,709). All thirty voice slots are now used. Each direction is voiced from
the coach's chess home region in [COACH.md](../../../../../docs/COACH.md#human-home-regions).
Mateo's and Tala's briefs describe the sound of the character's own voice (high,
light, small, bright) and never name an age: the provider rejects briefs about
minors, and the owner found age words produce odd results. Walter keeps his
separately approved voice and is not part of this plan.

`manifest.json` contains the available retained previews. Partial coverage is
expected while recording; the final strict check requires every active direction.
The studio must not import this collection into normal application playback.

## Approved voices and new rounds

`locked-voices.json` binds each approved coach/direction to its saved provider
voice ID and the exact preview fingerprint, audio hash and generated voice ID.
Both studios read these immutable approvals independently of ignored local draft
choices. Their service rejects changing or clearing a locked coach. A changed or
missing approved recording remains visibly stale and locked; it is never silently
substituted. The studio opens on **Needs a voice**; **Locked voices** lets the owner
inspect accepted designs without reopening them for voting.

The owner requested younger Biscuit voices and less goofy Pip voices. New IDs
replace only those six active directions. `archive/round-1-puppy-slime.json` retains
the rejected first-round briefs; their MP3s, provenance and full alignments remain
unchanged for audit history, outside the active manifest/runtime tracks. All other
54 active recordings remain byte-identical, including all eighteen first approvals.
Biscuit's second round read as ordinary young adults and is archived in
`archive/round-2-puppy.json`. Its third round (`archive/round-3-puppy.json`) tried
an animated sidekick, a breathless rookie and a soft, wide-eyed voice; the owner
judged **Soft and wide-eyed** almost right. The fourth round's three close
variations on it (**Soft and lighter**, **Soft and cosy** and **Soft and sparkly**)
remain the reference in `archive/round-4-puppy.json`. Before choosing, the owner
asked to hear briefs describing the talking puppy's own voice instead of an adult
speaker; the active fifth round is **Talking puppy, soft**, **wiggly** and **shy**.
The owner chose **Talking puppy, soft**. It was saved from its preview as **Fieldwork
Biscuit - Talking puppy, soft** (`USjUS9C409xYJs8EVPAv`) with no character usage and
locked with the same fingerprint, audio hash and provider-ID binding. Third-round Animated sidekick failed automatic alignment; it stays
archived and the studio can still play such a take with the energy-driven mouth.
Keep new rounds distinct; never overwrite accepted media or reuse a direction ID
for a different voice. Any future unlock is an explicit owner decision.

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

Coach and direction filters are repeatable. Omitting them selects all 87 active
directions; existing verified previews are reused without a request.
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
are printed or saved. The paid provider MP3 stays with its attempt under `.tools`;
the audition itself is saved as Opus, the same encoding as the banks. Recording/provenance
pairs are never overwritten; the
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

## Automatic mouth timing

`python -B -S scripts/prepare_cast_voice_auditions.py --check` verifies the complete
approved set with the standard library alone. `--generate` reuses the existing
offline PocketSphinx pipeline; optional coach/direction filters allow preparation
while a batch is in progress. `alignment/<coach>/<direction>.json` preserves the
automatic word and phoneme evidence; `tracks.json` is the compact runtime
projection. Request, sidecar and Opus fingerprints bind each track to its clip.
See the [alignment tooling](../alignment/README.md) for native dependencies.

All 87 recorded directions have verified automatic tracks. The unchanged clips
range from about 8 to 12 seconds. No hand timing, trimming or padding was applied.
The initial batch used 6,372 provider credits, observed as account usage 3,530 → 9,902.
The final four coaches used another 1,593 credits (9,902 → 11,495), for **7,965
credits across the first 60 auditions**. The second-round session increased usage
by **800 credits** (11,495 → 12,295), covering six new retained previews and one
rejected request; the provider does not supply a split in this usage snapshot.
The first literal childlike Biscuit request returned HTTP 403 and was not retried.
The active briefs explicitly request young adults instead. Total casting-session
usage is **8,765 credits**, with 66 retained recordings (60 active, six archived).
Biscuit's third, fourth and fifth rounds each made three successful requests with
no rejections, using **390 credits** apiece (28,866 → 29,256 → 29,646 → 30,036), for
**9,935 casting credits** in total and 75 retained recordings (60 active, 15 archived).
The nine humans' first round made 29 requests, 27 retained and two rejected, using
**3,821 credits** (30,036 → 33,857). Mateo's "Small and earnest" and Tala's "Soft
and sure" returned HTTP 403; both described a soft, high, small voice. Neither was
retried; `design-plan.json` keeps their briefs under `rejectedDirections`, and
"Bouncy Rioplatense" and "Melodic Manila" replace them. Walter's separate completion batch used 1,948 credits. The provider count can lag
generation; these totals use its settled count.

These generated previews follow the existing [speech asset permissions and
attribution notice](../README.md#permissions-and-attribution). Keep that notice
and each provenance sidecar with redistributed audition files. They are separate
media assets, not CC0 effects or relicensed source code. No voice model is included.
