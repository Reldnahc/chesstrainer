# Animated coach

The coach is a shared character system for game review, SRS practice and saved
explanations. Chess semantics belong to the reaction layer; artwork and acting
belong to the coach definition. The existing grey-haired, bespectacled coach keeps
his silhouette, beard and sage jacket.

For the ordered creation workflow, start with
[Creating a coach](COACH_CREATION_GUIDE.md). This reference owns the visual rig,
motion lifecycle, catalogue and account integration. The
[cast bible](COACH_CAST_BIBLE.md) supplies character direction; it does not replace
the implementation and acceptance requirements below.

## Visual directions

The men's collection has four complete characters, each with all 20 states:

- **Walter:** open, warm facial acting, clear anticipation and recovery,
  expressive shoulders and hands. Strong contrast between delight and concern.
- **Desmond:** a Black man with close curls, a neat beard and a terracotta
  overshirt. Open, welcoming gestures and an expressive double take.
- **Kenji:** an older East Asian man with silver temples, a clean-shaven
  face and a slate cardigan. Measured head movements and attentive eyes.
- **Arjun:** a South Asian man with dark waves, a shaped beard and a
  forest-green waistcoat. Curious looks and generous encouragement.

The [cast bible](COACH_CAST_BIBLE.md) defines the thirty selectable personalities.
**Settings → Coach & animations → Your coach** displays all thirty coaches in a compact, unbroken
six-column/five-row desktop grid, in the stable order below. There are no category
headings, gaps, tabs or filters. Small portraits and names keep selection compact;
descriptions remain available on hover and to assistive technology. Only the
selected portrait animates. Tablet layouts use four columns, phones use three,
and the narrowest phones use two. The same saved selection appears in game review, SRS
practice and saved explanations, including after reload or on another device.

| Group | Selectable coaches |
|---|---|
| Humans | Walter, Desmond, Kenji, Arjun, Mara, Iris, Zoe, Poppy, Milo, Cleo |
| Dogs | Alfie, Waffles, Scout, Biscuit |
| Cats | Felix, Juniper, Pickle |
| Other animals | Monty, Bandit, Fergus, Winston |
| Fantasy | Celeste, Orin, Ember, Wisp |
| Sci-Fi | Ziggy, Rivet |
| Silly & conceptual | Pip, Button, Percy |

Display names belong to the catalogue and flow into Settings, review labels and
the studio. Every coach has a personal name, replacing generic labels and
character titles while preserving the existing archetype. Saved preferences and
bookmarks continue to use the same stable IDs, so renaming a coach never resets a
selection or changes its voice.

Pickle has a kitten-specific silhouette: a large round head, low-set round eyes,
tiny muzzle, short seated body and soft paws. Cheek/chin hand positions fit that
face without obscuring the eyes. The shared paw rig accepts optional positions;
other cats and dogs keep their original proportions and gesture targets.
Fergus keeps his restrained poses with broader, taller eyes across all expressions.
Celeste uses small equine mouth shapes below the nostrils, including a closed smile
for delighted states, instead of the shared fantasy face's teeth and tongue.
All three retain the existing expression, blink and idle channels.

Paired hands use opposite local handedness. Rig `left`/`right` names refer to
screen sides, not the character's anatomical left/right. Reflect the hand and its
finger details inside its wrist placement, leaving sleeve paths, pose angles and
reaction/idle wrappers intact. Human, sci-fi and wizard drawings have different
authored thumb directions; do not apply one global side rule to every rig.
Symmetric cat/dog paws and hooves need no handedness correction.

Each selectable character also has a curated writing voice and character bible.
The shared dialogue layer selects supported facts before the chosen personality
phrases them; switching coaches never changes grades, evidence or engine work.
See [character writing](COACH_PERSONALITIES.md) and the separate
[intelligence laboratory](INTELLIGENCE_LAB.md) for blind comparisons, all-purpose
writing exercises and exact sentence traces. Review scheduling feedback remains
consistent outside the character dialogue, including relearning after a miss.

The expression viewer runs only as a separate development process:

```sh
cd frontend
npm run dev:coach
```

Open http://127.0.0.1:5174. No backend, database, login or Docker configuration is
needed. This command binds to loopback on a dedicated port and fails if the port
is occupied. It has its own HTML/React entry point and no API proxy. The normal
application has no studio link or route, and its production bundle does not
include the studio interface. Compare performances side by side, browse each complete expression
collection, replay entrances and idle gestures, run a transition sequence, and
preview device-default, animated or still motion. The two context samples use the real coach
bubble at 92.8px and 52.5px portrait widths. Expression/family URLs are bookmarkable.

The studio offers the whole production cast, all 20 expressions and a variable-size
idle gallery for the selected expression. Each idle can replay independently
without starting the entrance reaction. A comparison panel places three selected
coaches in the same semantic state. The older human/pet collections still provide
family comparisons for authoring; production selection is always an individual
coach. New species keep their own silhouettes and facial geometry while sharing
the same bounded motion lifecycle.

Use the character picker above the expression controls. `coach`, `family` and
`expression` query parameters restore a comparison on the studio's own server.
Switching characters stops a running sequence, clears the pending idle preview
and selects a valid family/idle gesture. Preview controls offer only the
gestures valid for the current coach and expression.

**Natural idle playback** opts the selected character and board-size samples into
sustained idles. Comparisons have a separate playback toggle. Other portraits
remain static after their one-shot entrance or explicit gesture replay. Signature
cards include acting notes, making each coordinated performance easy to inspect.
**Show motion diagnostics** observes the real selected portrait: active parts,
next event, shared eye deadline, recent history, cooldowns and rejected candidates.
Times describe the last scheduler event rather than a constantly ticking display.
The numeric seed and **Restart idle sequence** reproduce a sequence through the
production coordinator without replaying the entrance. These controls never
change account preferences and are excluded from the production app entry point.

The studio never connects to accounts or submits engine work. It imports the
same character catalogue and review bubble as the application; shared SVGs and motion
styles are bundled with the application so a selected coach is immediately
available in reviews without an image request. Existing `coach=retriever`
links resolve to the dog collection; unsupported families fall back to its retained
Alfie. Retired production/preview IDs have the compatibility mappings
listed below. The illustration assets are
original SVG artwork maintained as React components; no external images or assets
are required.

The quieter studies use a delayed look and a small response; the playful studies
hold their anticipation before a quick reaction with overlapping hair/ear motion.
Each character keeps its expression after the entrance settles. Blunder idles use
breathing, ears or hair rather than a happy tail wag. Still (and System when the
browser requests reduced motion) keeps the expressive resting face without
animation. Explicit Animated overrides the browser preference.

Walter remains the default, retaining its artwork and entrance identity.
The former Quiet mentor and Graphic spark variants of
that same man have been retired in favor of three distinct people. Old family
links fall back to Walter. The production registry and studio use the same
catalogue, including individual animation overrides such as Walter's glasses
gestures. Switching a studio collection clears unsupported idle previews.
Teaching, best-move and check poses use an outward-facing open palm. Avoid a
single raised finger: its silhouette reads as an insulting gesture at review size.

## Reaction lifecycle

### Speaking articulation

`CoachCharacter`, `CoachAvatar` and `ReviewCoach` accept an optional
`SpeechPlayback` from the shared audio engine. Speech supplements the semantic
expression; it does not choose a grade, change dialogue, restart entrances or
replace the independent eye/body idle scheduler. Walter and the twenty nonhuman
rigs support speaking articulation. A coach/family explicitly opts in through
`speech` capability metadata;
unimplemented rigs keep their authored face, and a handle for a different coach
cannot animate the selected portrait.

`useSpeechPerformance.ts` samples the recording's actual audio clock and updates
bounded CSS variables on the portrait, without per-frame React renders. It runs
only for a visible, animated portrait with an active handle, and cleans up on
replacement, unmount or changed identity. Still and device-default reduced motion
keep static expressions while audio plays. Explicit Animated overrides the device
preference, as elsewhere. Offscreen portraits stop sampling and resume at the
current recording time; hidden tabs cancel audio under the existing sound policy.

Walter's `WalterSpeechMouth` uses closed lips, rounded/wider openings, clipped
teeth/tongue and a small beard/jaw movement. Quiet audio closes the lips; ending
or cancelling playback restores the exact authored expression. The mouth is
separate from Brilliant's entrance mouth scale so the two cannot compound.
`HumanFeatures` offers a mouth slot, preserving the existing shared fallback for
other humans. `SpeechMouthLayer` switches between intact authored artwork and a
speaking mouth. `OrganicSpeechMouth` supplies an upper-lip-anchored aperture with
species-owned dimensions, palette and optional teeth, tongue, fangs or interior.
Its rounded shapes compensate for mouth aspect ratio, so a wide frog mouth can
still form an O. Rivet has a separate segmented mechanical display driven by the
same controls. Neither helper owns a clock or changes a coach's reaction timing.

Without an aligned track, the fallback is audio-reactive articulation, **not
phoneme-aligned lip sync**: energy and a rough brightness hint provide timing
and shape variation, not recognized words
or vowels. It needs no generated timing asset or independent looping talk animation.

`CoachCharacter` also accepts an optional `SpeechMouthTrack`: timed semantic mouth
shapes sampled against the same audio clock. Nine shapes resolve to eight normalized
rig controls, with short easing and faster lip closures. Tool-specific shape IDs
stay in the authoring adapter; future rigs can draw their own geometry. Missing
tracks retain the energy-driven path. Motion, identity and cleanup rules are shared.

The [isolated audio test fixture](AUDIO.md#automatic-lip-sync-comparison-development-only)
retains two existing Walter recordings at normal portrait sizes. Voice audition retains
the energy-driven mouth; Compare lip sync isolates the original Rhubarb generator
against revised script/phoneme alignment using identical artwork and playback.
Both comparison sets are automatic and development-only. Walter's and Rivet's
production banks use the revised generator. The preview is for judging quality,
not a claim of perfect phonetic alignment. Playback uses no voice API or
recognition model. Lesson narration remains deferred.

Speaking artwork and recorded speech are separate capabilities. A rig's `speech`
flag enables mouth articulation; it does not make recordings available. The
production voice registry currently supplies Walter (`classic`) and Rivet
(`robot`), with 438 approved recordings each. The other speaking rigs can preview
their auditions in development but remain text-only in normal reviews until a
complete bank is registered. See [recorded coach voices](AUDIO.md#recorded-coach-voices)
for bank registration, writing, provenance, generation and alignment checks.

The coach studio's **Mouth shapes** view holds each of the nine shared sound
shapes, with phoneme examples, at board size or enlarged. `previewSpeechShape`
applies the exact rig controls without audio or an animation loop. This explicit
static inspection also works with Still; actual playback continues to honor the
normal motion/visibility policy. Clearing the preview restores the authored
expression. Unimplemented human rigs remain unsupported. The same view embeds
the selected creature's local voice auditions so timing can be inspected with
real recordings. Their shared casting controls save an explicit final direction
or Keep looking decision on the studio host. These authoring choices do not
install a production voice or change an account preference. Walter is locked and
his audition controls are absent from the normal Audio Studio.

### Expressions and idle behavior

`reactions.ts` maps existing typed game reports and SRS feedback into semantic
events. The rest of the app does not choose SVG paths or animation classes.
Brilliant, great, best, good, book, inaccuracy, mistake, blunder and missed
opportunity remain distinct. A checking move gets focused acting unless a stronger
move-quality reaction applies. Actual terminal boards show winning/losing from
the learner's perspective or a draw; the PGN's eventual result never leaks into an
earlier move or a branch. Checkmate coaching text matches the outcome.

SRS starts neutral without revealing tactical hints. A failed attempt gets a
sympathetic reaction; Try again becomes encouraging; a later successful attempt
celebrates recovery. Reveals and saved explanations use teaching expressions.
Unavailable analysis produces uncertainty, never invented chess confidence.

Known faces update with their feedback immediately. Entrances wait for a 110ms
dwell to avoid repeated performances while scrubbing. Thinking waits 420ms so fast
answers do not flash a loading face. Position/session keys and state changes cancel
pending work; existing review generation guards still discard stale engine replies.
An entrance lasts roughly 1.3–1.8 seconds, then retains a quieter static expression
consistent with the bubble instead of returning to an unrelated neutral face.

Eye squeezes belong to the entrance, not the indefinite resting face. Shared
face context reopens eyes after the entrance while preserving the brows, mouth,
pose and semantic reaction. Known feedback keeps its entrance face during dwell;
there is no open/closed flash at commitment. Still, hidden or offscreen portraits
settle immediately; resuming an interrupted entrance does not replay it. Eye
context updates pass through the memoized artwork without remounting the SVG.

Idle gestures occur after variable 0.5–1 second quiet pauses for every animated
coach. `idleModel.ts` owns the shared cadence; character definitions choose
gestures, not cadence. `idleGestures.ts` owns actual durations, delayed child
tracks and CSS animation names. A normal blink lasts 260ms rather than occupying
an artificial 1.2-second slot. `idleRig.ts` declares the SVG resources actually
present in each character and expression, so optional tracks never reserve
nonexistent parts. The pools choose
only gestures supported by the settled rig and appropriate to the state. For
example, worried faces do not borrow delighted glints or approving double nods.
`motionVocabulary.ts` provides complete expression
pools and per-coach acting profiles. Character-specific eyes, ears, hair, tail or
lens gestures combine with common head-angle, breathing and stance movements.
Profiles control idle amplitude, gaze and settling independently of reaction timing.

Every registered coach has two authored signature performances in
`idleSignatures/`, with labels, acting notes and explicit eligible expressions.
These are coordinated timelines, not random combinations: Scout's gaze leads
two listening ears; Walter's supporting palm accompanies his glasses;
Rivet's lens adjustment precedes an antenna correction. Signatures require all
their channels or are omitted entirely. Shared additions include a double blink,
rightward glance/tilt, upward consideration, two unequal nods and a lateral
weight transfer. Every expression supplies at least eight compatible choices
across eyes, attention and body/detail groups. The live registry is the coverage
source, so adding a coach also requires its repertoire and signatures.

Arm and paw wrappers include the complete connected limb and pivot at the
existing shoulder. Hand-to-face and held-book poses exclude incompatible limb
performances. Wings, antenna, cap and trailing silhouette details use nested
wrappers inside their held pose; idle transforms never overwrite that pose.
Gesture metadata owns every duration and delay; CSS owns only the movement path.

`idleCoordinator.ts` is a deterministic event-driven scheduler. It permits one
noticeable and one quiet compatible performance, staggered by at least 180ms.
Compound gestures atomically reserve every animated SVG channel; nested head and
gaze can compose, while two body transforms cannot compete. Independent baseline
eye activity is due every 3–5 seconds of active rest; a complete blink inside a
compound performance satisfies the same clock. Busy channels can defer it, but
optional gestures cannot starve it. Gesture and channel cooldowns, recent-history
weighting and an age backstop prevent immediate repeats, alternating loops and
starvation. Every repertoire supplies quiet breathing during other cooldowns.
Infeasible configurations remain safe and expose diagnostics instead of bypassing
resource ownership or cooldowns.

One next-deadline timer drives idles per portrait; CSS performs the frames without
a JavaScript animation loop. Offscreen, hidden and Still characters abort active
tracks. Resume preserves recent history and remaining cooldowns with fresh
deadlines, never accumulated blink debt. New reaction keys cancel stale gestures
even when the expression stays the same. Neutral, brilliant and blunder retain
different eligible motion.
The latest unseen reaction can play when it becomes visible; an interrupted or
already seen entrance is not replayed. Unmounting removes observers/listeners and
clears timers. Deliberately replaying an entrance restarts the SVG rig, not its
layout; restarting the seeded idle sequence does not remount it.

**Settings → Coach & animations → Animations** groups **Coach motion** and
**Piece & interface motion**, each with its own save/error feedback. **Your coach**
on the same tab contains character selection. **Sound** is a separate Settings tab;
voice playback and visual motion are independent preferences.
The default **Use device setting** follows system reduced motion. Choosing
**Animated** or **Still** overrides the browser preference; Still disables both
entrances and idle motion. The same resolved setting controls timers and CSS.
`useReducedMotion.ts` shares an event-driven snapshot between portraits, boards,
Settings and studio controls. `motion.ts` resolves both account motion choices
with the same override rules. The device hook uses one native media listener while consumers
are mounted, detaches it after the last unmount, and resynchronizes when a consumer
returns. Animation renders never reread the live query: in Chromium that could
consume a pending change notification and leave controls behind the portraits.
The studio follows the same choices. Its separate reduced-motion preview remains
selected when the device preference switches off again; choosing a motion option
clears the manual preview.
Static facial poses, ratings, evaluation and explanatory text remain. Reactions
are decorative: the existing accessible coaching text carries the analysis. The
animation changes transforms/opacity inside a reserved box and does not move the
board, bubble or controls. There are no flashing effects or indefinitely looping
entrance animations. Portraits consume an optional audio playback handle; the
shared audio engine owns playback and cancellation, not the animation scheduler.
Eye masks belong to each SVG instance so idle glances stay within the eye shape
even when many differently posed characters appear together in the studio.

**Settings → Coach & animations → Animations → Piece & interface motion** controls piece movement,
rating entrances, evaluation-bar transitions and other interface animations.
It has the same device-default/Animated/Still choices, saved independently from
coach motion in the account's existing preference row. Both default to the
device for existing/new users; adding this preference preserves saved coach
choices. Interface Still does not stop an explicitly animated coach, and coach
Still does not stop explicitly animated pieces. Boards in game review, SRS,
explanations and evidence all use this shared preference. CSS uses the same
resolved state as the board library; there is no second browser-only override.

## Adding a coach

Paths in this section are relative to `frontend/src/coach/` unless otherwise
qualified. Use the [creation guide](COACH_CREATION_GUIDE.md) to sequence this work;
these are the contracts each new character must satisfy.

`model.ts` defines the character contract. `studies/catalog.ts` and `cast/catalog.ts` supply the
collections, stable character IDs, names, descriptions, supported states, fallback
maps, families, capabilities, timing/idle configuration and artwork components.
`registry.ts` derives individual selectable definitions from that single source.
Each has one default family, explicit presentation group and a typed account ID;
collection IDs remain useful for authoring and studio URLs. They are never saved
in place of a character ID.
Walter's SVG rig and entrance keyframes live in `classic/`. Shared idle tracks
live in `idle-motion.css`, `idle-shared.css` and `idleSignatures/`; lifecycle and
preference code contain no references to Walter's facial geometry.
Reusable human expressions, facial layers and open-palm hand artwork live in
`human/`. Individual human coaches provide their own silhouette, palette and acting.
The men and women use shared human primitives; cat and dog artwork share animal expressions, eyes,
muzzles and paws. Silhouettes, fur markings, hair, outfits and accessories remain
with each artwork component. Dog head geometry is separated from the common body
rig and palettes, so a new breed does not duplicate facial animation. Dark-coated
animals can supply a lighter eyelid stroke to keep closed expressions legible.
The study CSS uses its own namespaced motion tracks; classic CSS is scoped to
Walter so it cannot also animate the shared human rig of another man.
New artwork is organized under `cast/humansPets`, `cast/animals`, `cast/fantasy`
and `cast/scifi`, with small local rig/face helpers. These source folders do not
determine the Settings groups or persisted IDs.
Add an allowed coach ID to `backend/trainer/contracts/preferences.py`, export
the contract with `python scripts/export_api_contract.py` from the repository
root, regenerate types with `npm --prefix frontend run api:generate`, and add the matching
family and `coachId` to the catalogue. Do not edit generated types manually. Browser tests
compare all selectable IDs with the API allowlist and exercise each in a real
review. Settings renders available definitions automatically. Supply an
explicit supported default state and an accessible static pose for every provided
expression; omitted states follow the fallback chain, with cycle protection.
Artwork may omit reactions or idle capabilities independently. Preserve the
reserved aspect ratio and honor the `data-motion`, `data-phase`, `data-face` and
idle channel CSS variables supplied by `CoachCharacter`. `data-idles` describes
the active gestures; `data-micro` is only the first active gesture, not the full
coordinator state. Keep namespaced CSS with the artwork. No new router,
settings storage or chess-analysis code is needed for another character.

### Motion integration and acceptance

Add the character's acting profile to `motionVocabulary.ts` and its actual SVG
channels to `idleRig.ts`. Every declared resource must have a rendered wrapper in
the eligible expression. Use separate reaction, idle and authored-pose wrappers,
as in `ArtworkRig.tsx`; do not animate the same transform from two systems. The
shared scheduler in `usePerformance.ts` and `idleCoordinator.ts` remains unchanged
for an ordinary new character. Cadence belongs to `idleModel.ts`, not its profile.

Add two characterful, expression-gated signatures to the appropriate
`idleSignatures/` collection, with labels, acting notes and namespaced CSS. The
current cast's quality gate is at least eight compatible choices across at least
three gesture groups for every expression, plus both signatures for every coach.
Shared gestures can supply breadth; signatures, amplitude and appropriate detail
motion supply identity. Exclude held-book/hand-to-face conflicts and cheerful
gestures from worried states. Do not satisfy coverage by listing tracks that the
rig cannot perform.

If the coach will speak, implement all nine shapes in `speechMouth.ts` through
the existing articulation layer before opting in to `speech`. Walter's
`classic/WalterAlignedMouth.tsx`, the shared `SpeechMouthLayer.tsx` and Rivet's
`cast/scifi/RobotSpeechMouth.tsx` demonstrate different geometry using the same
normalized controls. Do not copy Walter's human mouth onto an incompatible
silhouette or add a second audio clock. Keep the original expressive mouth intact
for silence, cancellation, Still and unsupported speech. Check both rounded O
shapes as well as closures, teeth and tongue in **Coach Studio → Mouth shapes**.

Walter and Rivet are reference implementations for completeness, not templates
for another coach's personality or anatomy. Review a candidate beside them at
actual portrait sizes. Distinct brilliant/blunder acting, readable quiet faces,
settled open eyes, connected and correctly handed limbs, several natural idle
cycles and convincing automatic speech transitions all matter. Test reaction
changes and interruption as well as an uninterrupted clip. A static expression
sheet, a short audition or passing type checks alone is not a finished coach.
The [personality requirements](COACH_PERSONALITIES.md) and
[audio acceptance workflow](AUDIO.md) complete this visual quality gate.

## Validation

Backend tests cover defaults for existing users, additive migration preservation,
validation, concurrent first writes, account isolation, CSRF and second-device
sessions. Browser/logic tests cover semantic mapping, fallback chains, special
outcomes, recovery, actual native game reviews, replay/settling, offscreen behavior,
complete concept collections, control geometry, selection of all 30 coaches,
cross-device/account restoration, failed-save recovery and reduced
motion. Existing shared-board geometry and stale-request regressions remain.
Failed preference loads keep controls disabled and the character still until retry;
failed saves preserve the last accepted choice. Both recovery paths are exercised
through the actual Settings screen. Connecting with the optional LAN token retries
preference loading automatically; a manual page reload is not required.
Final validation results are recorded in [VERIFICATION.md](VERIFICATION.md).

Use the runnable commands and environment setup in
[TESTING.md](TESTING.md#coach-cast-and-behavior). For a new selectable character,
the relevant checks include backend `test_coach_preferences.py`, the frontend
production build, application `coach-logic.spec.ts`, `coach-selection.spec.ts`
and `coach.spec.ts`, and `npx playwright test --config playwright.coach.config.ts`
from `frontend`. Account coverage verifies saved selection on another device;
the intelligence and audio suites apply when adding dialogue or a speaking rig.
Update registry-derived expectations instead of silently skipping the new ID.
The studio config owns port 5174 and will not reuse an already running server;
do not terminate an owner's preview just to free that port without coordinating.

Manually inspect the real game-review and SRS components on desktop and mobile,
plus Settings selection. Confirm cold SRS stays neutral before allowed feedback;
scrubbing does not replay stale entrances; offscreen/hidden/Still pauses work;
Animated overrides device reduced motion; speech restores the authored face on
ending/cancellation; and no gesture shifts the board, bubble or action controls.
The studio is an authoring aid, not a substitute for these application checks.

## Account preferences

`GET` / `PUT /api/preferences/coach` use the existing scoped workspace and database.
`user_preferences` holds at most one row per account, including the reserved local
user. Missing rows read as `classic` with `system` motion; reading defaults never
creates rows. Supported motion choices are `system` (Use device setting),
`natural` (Animated) and `still`. Existing saved Animated/Still choices persist.
The removed `subtle` choice reads as Animated without rewriting the stored value.
The motion-default migration updates the database default to `system` while
preserving saved choices.

The preference contract accepts 30 stable character IDs. Walter keeps
`classic`; existing retained characters keep their original IDs. New coaches
have explicit IDs registered in the same contract. IDs identify individuals,
independent of their display name, artwork folder or presentation group.
Expanding this allowlist uses the existing string column and needs no new
database migration. Tests round-trip every allowed ID through an application
restart and verify that another account starts with its own default.

This cast expansion requires no schema migration and does not change games,
sessions or authentication. Invalid new choices are rejected. Retired saved
choices resolve through explicit read-only replacements:

| Retired selection | Replacement | Reason |
|---|---|---|
| Sunny companion (`dog-sunny`) | Biscuit (`dog-puppy`) | Retains the eager, affectionate teammate role |
| Library tabby (`cat-tabby`) | Pickle (`cat-kitten`) | Keeps a curious feline companion in the consolidated cast |
| Curious calico (`cat-calico`) | Pickle (`cat-kitten`) | Retains playful investigative curiosity |

These mappings are applied on API reads and stale frontend lookups/bookmarks;
they do not rewrite preference rows. Choosing a coach explicitly saves its new
ID. Retired IDs are rejected on new writes, so they cannot reenter the selectable
roster. Unrecognized saved choices fall back to Walter for this release
without overwriting the stored value, allowing removed coaches or older releases
to open the same database safely. Concurrent first saves serialize through the
same SQLite write transaction. No Docker configuration is required.
