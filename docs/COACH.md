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

All sixteen characters are selectable in **Settings → Your coach**, organized
into four compact groups. Browsing a group does not save a choice; selecting a
portrait does. Settings restores the selected character's group on load. Only
the selected portrait animates, and phone layouts use two columns. The same saved
character appears in game review, SRS practice and saved explanations.

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
preview natural/subtle/still motion. The two context samples use the real coach
bubble at 92.8px and 52.5px portrait widths. Expression/family URLs are bookmarkable.

The studio contains 16 concepts across four groups, each with all 20 expressions:

| Character | Concepts | Character-specific motion |
|---|---|---|
| Men | Storyteller, Club host, Endgame expert, Creative partner | Shared facial/hand articulation; distinct hair, facial hair, face shapes and clothing |
| Women | Club captain, Quiet analyst, Bright spark, Golden braid | Hair follow-through, open palms, thoughtful chin poses; blonde side braid on the fourth concept |
| Cats | Library tabby, Midnight tactician, Curious calico, Velvet night | Expressive ears, whiskers, paws and tails; the fourth has solid-black fur and amber eyes |
| Dogs | Sunny companion, Gentle professor, Pocket captain, Border collie | Two goldens, a corgi and a border collie with distinct ears, muzzle geometry, coats, chests and tails |

Use the character picker above the expression controls. `coach`, `family` and
`expression` query parameters restore a comparison on the studio's own server.
Switching characters stops a running sequence, clears the
pending idle preview and selects a valid family/idle gesture. Preview controls
offer only the idle gestures that the character actually implements.

The studio never connects to accounts or submits engine work. It imports the
same character catalogue and review bubble as the application; shared SVGs and motion
styles are bundled with the application so a selected coach is immediately
available in reviews without an image request. Existing `coach=retriever`
links resolve to the dog collection; the retired Trail buddy (`scout`) family
falls back to Sunny companion. The illustration assets are
original SVG artwork maintained as React components; no external images or assets
are required.

The quieter studies use a delayed look and a small response; the playful studies
hold their anticipation before a quick reaction with overlapping hair/ear motion.
Each character keeps its expression after the entrance settles. Blunder idles use
breathing, ears or hair rather than a happy tail wag. Reduced motion keeps the
full expressive silhouette while disabling all reaction and idle animations.

Storyteller remains the default, with its review artwork and
performance unchanged. The former Quiet mentor and Graphic spark variants of
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

Idle gestures occur after variable 2–5 second pauses for human coaches,
2.5–5.5 seconds for cats, and 3–6 seconds for dogs. Subtle mode adds 1.5 seconds.
Each gesture still lasts 1.2 seconds before scheduling the next pause.
The character avoids immediately repeating a gesture when alternatives
exist. Neutral, brilliant and blunder have distinct idle vocabularies. A small
number of local timers schedule gestures; CSS performs the animation without a
JavaScript frame loop. Offscreen or hidden characters stop active motion/timers.
The latest unseen reaction can play when it becomes visible; an interrupted or
already seen entrance is not replayed. Unmounting removes observers/listeners and
clears timers. Replaying deliberately restarts only the SVG rig, not its layout.

System reduced motion and the Still preference disable entrances and idle motion.
`coach/useReducedMotion.ts` shares an event-driven snapshot between portraits,
Settings and studio controls. It uses one native media listener while consumers
are mounted, detaches it after the last unmount, and resynchronizes when a consumer
returns. Animation renders never reread the live query: in Chromium that could
consume a pending change notification and leave controls behind the portraits.
The studio's manual preview remains selected when the device preference switches
off again; the device preference always takes precedence while enabled.
Static facial poses, ratings, evaluation and explanatory text remain. Reactions
are decorative: the existing accessible coaching text carries the analysis. The
animation changes transforms/opacity inside a reserved box and does not move the
board, bubble or controls. No flashes, audio or infinite animation loops are used.
Eye masks belong to each SVG instance so idle glances stay within the eye shape
even when many differently posed characters appear together in the studio.

## Adding a coach

`model.ts` defines the character contract. `studies/catalog.ts` supplies the
collections, stable character IDs, names, descriptions, supported states, fallback
maps, families, capabilities, timing/idle configuration and artwork components.
`registry.ts` derives individual selectable definitions from that single source.
Each has one default family and a typed account ID; collection IDs remain useful
for browsing and studio URLs. They are never saved in place of a character ID. The
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
complete concept collections, control geometry, selection of all 16 coaches,
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
user. Missing rows read as `classic` with `natural` motion; reading defaults never
creates rows. Supported motion choices are natural, subtle and still. System
reduced motion always takes precedence over an animation preference.

The preference contract accepts 16 stable character IDs. Storyteller keeps
`classic`; the others use `man-*`, `woman-*`, `cat-*` and `dog-*` IDs so a saved
choice identifies one specific character, independent of its display name.
Expanding this allowlist uses the existing string column and needs no new
database migration. Tests round-trip every allowed ID through an application
restart and verify that another account starts with its own default.

The additive migration does not change games, sessions or authentication. Invalid
new choices are rejected. Unrecognized saved choices fall back for this release
without overwriting the stored value, allowing removed coaches or older releases
to open the same database safely. Concurrent first saves serialize through the
same SQLite write transaction. No Docker configuration is required.
