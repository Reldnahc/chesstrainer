# Animated coach

The coach is a shared character system for game review, SRS practice and saved
explanations. Chess semantics belong to the reaction layer; artwork and acting
belong to the coach definition. The existing grey-haired, bespectacled coach keeps
his silhouette, beard and sage jacket.

## Visual directions

The men's collection has four complete characters, each with all 20 states:

- **Storyteller:** open, warm facial acting, clear anticipation and recovery,
  expressive shoulders and hands. Strong contrast between delight and concern.
- **Club host:** a Black man with close curls, a neat beard and a terracotta
  overshirt. Open, welcoming gestures and an expressive double take.
- **Endgame expert:** an older East Asian man with silver temples, a clean-shaven
  face and a slate cardigan. Measured head movements and attentive eyes.
- **Creative partner:** a South Asian man with dark waves, a shaped beard and a
  forest-green waistcoat. Curious looks and generous encouragement.

The [cast bible](COACH_CAST_BIBLE.md) defines the thirty selectable personalities.
**Settings → Your coach** displays all thirty coaches in a compact, unbroken
six-column/five-row desktop grid, in the stable order below. There are no category
headings, gaps, tabs or filters. Small portraits and names keep selection compact;
descriptions remain available on hover and to assistive technology. Only the
selected portrait animates. Tablet layouts use four columns, phones use three,
and the narrowest phones use two. The same saved selection appears in game review, SRS
practice and saved explanations, including after reload or on another device.

| Group | Selectable coaches |
|---|---|
| Humans | Storyteller, Club host, Endgame expert, Creative partner, Club captain, Quiet analyst, Bright spark, Golden braid, Milo, Cleo |
| Dogs | Gentle professor, Pocket captain, Scout, Biscuit |
| Cats | Midnight tactician, Velvet night, Pickle |
| Other animals | Monty, Bandit, Fergus, Winston |
| Fantasy | Celeste, Orin, Ember, Wisp |
| Sci-Fi | Ziggy, Rivet |
| Silly & conceptual | Pip, Button, Percy |

Display names belong to the catalogue and flow into Settings, review labels and
the studio. Personal names replace generic species/age labels while preserving
the established character titles. Saved preferences and bookmarks continue to use
the same stable IDs, so renaming a coach never resets a selection or changes its voice.

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

The studio never connects to accounts or submits engine work. It imports the
same character catalogue and review bubble as the application; shared SVGs and motion
styles are bundled with the application so a selected coach is immediately
available in reviews without an image request. Existing `coach=retriever`
links resolve to the dog collection; unsupported families fall back to its retained
Gentle professor. Retired production/preview IDs have the compatibility mappings
listed below. The illustration assets are
original SVG artwork maintained as React components; no external images or assets
are required.

The quieter studies use a delayed look and a small response; the playful studies
hold their anticipation before a quick reaction with overlapping hair/ear motion.
Each character keeps its expression after the entrance settles. Blunder idles use
breathing, ears or hair rather than a happy tail wag. Still (and System when the
browser requests reduced motion) keeps the expressive resting face without
animation. Explicit Animated overrides the browser preference.

Storyteller remains the default, retaining its artwork and entrance identity.
The former Quiet mentor and Graphic spark variants of
that same man have been retired in favor of three distinct people. Old family
links fall back to Storyteller. The production registry and studio use the same
catalogue, including individual animation overrides such as Storyteller's glasses
gestures. Switching a studio collection clears unsupported idle previews.
Teaching, best-move and check poses use an outward-facing open palm. Avoid a
single raised finger: its silhouette reads as an insulting gesture at review size.

## Reaction lifecycle

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
only gestures supported by the rig and appropriate to the state. For example,
worried faces do not borrow delighted glints, and closed eyes do not rely on an
invisible pupil-only glance. `motionVocabulary.ts` provides complete expression
pools and per-coach acting profiles. Character-specific eyes, ears, hair, tail or
lens gestures combine with common head-angle, breathing and stance movements.
Profiles control idle amplitude, gaze and settling independently of reaction timing.
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
clears timers. Replaying deliberately restarts only the SVG rig, not its layout.

**Settings → Animations** groups **Coach motion** and **Piece & interface motion**,
each with its own save/error feedback. **Your coach** contains character selection.
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
board, bubble or controls. No flashes, audio or infinite animation loops are used.
Eye masks belong to each SVG instance so idle glances stay within the eye shape
even when many differently posed characters appear together in the studio.

**Settings → Animations → Piece & interface motion** controls piece movement,
rating entrances, evaluation-bar transitions and other interface animations.
It has the same device-default/Animated/Still choices, saved independently from
coach motion in the account's existing preference row. Both default to the
device for existing/new users; adding this preference preserves saved coach
choices. Interface Still does not stop an explicitly animated coach, and coach
Still does not stop explicitly animated pieces. Boards in game review, SRS,
explanations and evidence all use this shared preference. CSS uses the same
resolved state as the board library; there is no second browser-only override.

## Adding a coach

`model.ts` defines the character contract. `studies/catalog.ts` and `cast/catalog.ts` supply the
collections, stable character IDs, names, descriptions, supported states, fallback
maps, families, capabilities, timing/idle configuration and artwork components.
`registry.ts` derives individual selectable definitions from that single source.
Each has one default family, explicit presentation group and a typed account ID;
collection IDs remain useful for authoring and studio URLs. They are never saved
in place of a character ID. The
default SVG rig, motion tracks and keyframes live in `classic/`; shared
lifecycle and preference code contain no references to its facial geometry.
Reusable human expressions, facial layers and open-palm hand artwork live in
`human/`. Individual human coaches provide their own silhouette, palette and acting.
The men and women use shared human primitives; cat and dog artwork share animal expressions, eyes,
muzzles and paws. Silhouettes, fur markings, hair, outfits and accessories remain
with each artwork component. Dog head geometry is separated from the common body
rig and palettes, so a new breed does not duplicate facial animation. Dark-coated
animals can supply a lighter eyelid stroke to keep closed expressions legible.
The study CSS uses its own namespaced motion tracks; classic CSS is scoped to
Storyteller so it cannot also animate the shared human rig of another man.
New artwork is organized under `cast/humansPets`, `cast/animals`, `cast/fantasy`
and `cast/scifi`, with small local rig/face helpers. These source folders do not
determine the Settings groups or persisted IDs.
Add an allowed coach ID to the backend preference contract, regenerate the API
types, and add the matching family and `coachId` to the catalogue. Browser tests
compare all selectable IDs with the API allowlist and exercise each in a real
review. Settings renders available definitions automatically. Supply an
explicit supported default state and an accessible static pose for every provided
expression; omitted states follow the fallback chain, with cycle protection.
Artwork may omit reactions or idle capabilities independently. Preserve the
reserved aspect ratio and honor the `data-motion`/phase/microgesture contract on
the containing character. Keep namespaced CSS with the artwork. No new router,
settings storage or chess-analysis code is needed for another character.

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

## Account preferences

`GET` / `PUT /api/preferences/coach` use the existing scoped workspace and database.
`user_preferences` holds at most one row per account, including the reserved local
user. Missing rows read as `classic` with `system` motion; reading defaults never
creates rows. Supported motion choices are `system` (Use device setting),
`natural` (Animated) and `still`. Existing saved Animated/Still choices persist.
The removed `subtle` choice reads as Animated without rewriting the stored value.
The motion-default migration updates the database default to `system` while
preserving saved choices.

The preference contract accepts 30 stable character IDs. Storyteller keeps
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
roster. Unrecognized saved choices fall back to Storyteller for this release
without overwriting the stored value, allowing removed coaches or older releases
to open the same database safely. Concurrent first saves serialize through the
same SQLite write transaction. No Docker configuration is required.
