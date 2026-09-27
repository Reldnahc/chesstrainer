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

These are preview concepts, not additional selectable production characters.
The comparison surface will retain useful alternatives without adding production
accounts or artificial entries to the coach selector.

Open **Settings → Preview expressions**, or `/coach-studio`. The studio is a lazy
loaded page, reachable in local and account mode, with no engine jobs or preference
writes. Compare performances side by side, browse each complete expression
collection, replay entrances and idle gestures, run a transition sequence, and
preview natural/subtle/still motion. The two context samples use the real coach
bubble at 92.8px and 52.5px portrait widths. Expression/family URLs are bookmarkable.

The studio also includes nine new character studies, each with all 20 expressions:

| Character | Concepts | Character-specific motion |
|---|---|---|
| Woman | Club captain, Quiet analyst, Bright spark | Hair follow-through, open palms, thoughtful chin poses and a restrained or lively performance |
| Cat | Library tabby, Midnight tactician, Curious calico | Perked/flattened ears, whiskers, paw gestures and occasional tail flicks |
| Golden retriever | Sunny companion, Gentle professor, Trail buddy | Floppy ears, broad muzzles, feathered tails and gentle or enthusiastic reactions |

Use the character picker above the expression controls. `coach`, `family` and
`expression` query parameters restore a comparison directly; existing links still
open the original coach. Switching characters stops a running sequence, clears the
pending idle preview and selects a valid family/idle gesture. Preview controls
offer only the idle gestures that the character actually implements.

These nine studies are preview-only. Settings still offers the original coach,
and opening a study never writes account preferences or submits engine work.
The new artwork and motion styles are loaded with the studio route, so ordinary
reviews do not download the additional characters. The illustration assets are
original SVG artwork maintained as React components; no external images or assets
are required.

The quieter studies use a delayed look and a small response; the playful studies
hold their anticipation before a quick reaction with overlapping hair/ear motion.
Each character keeps its expression after the entrance settles. Blunder idles use
breathing, ears or hair rather than a happy tail wag. Reduced motion keeps the
full expressive silhouette while disabling all reaction and idle animations.

Storyteller remains the production direction, with its original artwork and
performance unchanged. The former Quiet mentor and Graphic spark variants of
that same man have been retired in favor of three distinct people. Old family
links fall back to Storyteller. The production registry contains only the original
character; the studio expands it through a separate preview definition.
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

Idle gestures occur after variable 4.5–10 second pauses; subtle mode adds four
seconds. The character avoids immediately repeating a gesture when alternatives
exist. Neutral, brilliant and blunder have distinct idle vocabularies. A small
number of local timers schedule gestures; CSS performs the animation without a
JavaScript frame loop. Offscreen or hidden characters stop active motion/timers.
The latest unseen reaction can play when it becomes visible; an interrupted or
already seen entrance is not replayed. Unmounting removes observers/listeners and
clears timers. Replaying deliberately restarts only the SVG rig, not its layout.

System reduced motion and the Still preference disable entrances and idle motion.
Static facial poses, ratings, evaluation and explanatory text remain. Reactions
are decorative: the existing accessible coaching text carries the analysis. The
animation changes transforms/opacity inside a reserved box and does not move the
board, bubble or controls. No flashes, audio or infinite animation loops are used.
Eye masks belong to each SVG instance so idle glances stay within the eye shape
even when many differently posed characters appear together in the studio.

## Adding a coach

`model.ts` defines the character contract. `registry.ts` supplies its ID, name,
description, supported states, fallback map, concept families, default family,
capabilities, animation timing/idle configuration and artwork component. The
default SVG rig, poses, motion tracks and keyframes live in `classic/`; shared
lifecycle and preference code contain no references to its facial geometry.
Reusable human expressions, facial layers and open-palm hand artwork live in
`human/`. Individual human coaches provide their own silhouette, palette and acting.
`studies/catalog.ts` is a separate preview catalogue. The woman uses the shared
human primitives; cat and retriever artwork share animal expressions, eyes,
muzzles and paws. Silhouettes, fur markings, hair, outfits and accessories remain
with each artwork component. The study CSS uses its own namespaced motion tracks.
To develop another concept before release, register it in the study catalogue;
production selection is still governed by the typed account preference contract.

Add an allowed coach ID to the backend preference contract, regenerate the API
types, and register the matching frontend definition. The typed registry covers
every allowed ID. Settings renders available definitions automatically. Supply an
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
complete concept collections, control geometry, settings restoration and reduced
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

The additive migration does not change games, sessions or authentication. Invalid
new choices are rejected. Unrecognized saved choices fall back for this release
without overwriting the stored value, allowing removed coaches or older releases
to open the same database safely. Concurrent first saves serialize through the
same SQLite write transaction. No Docker configuration is required.
