# Animated coach

The coach is a shared character system for game review, SRS practice and saved
explanations. Chess semantics belong to the reaction layer; artwork and acting
belong to the coach definition. The existing grey-haired, bespectacled coach keeps
his silhouette, beard and sage jacket.

## Visual directions

Three complete directions share the same character rig, each with all 20 states:

- **Storyteller:** open, warm facial acting, clear anticipation and recovery,
  expressive shoulders and hands. Strong contrast between delight and concern.
- **Quiet mentor:** smaller head gestures, thoughtful eyes, asymmetry and pauses.
  Character comes from attention rather than large movement.
- **Graphic spark:** crisp poses, delayed secondary motion and restrained drawn
  accents. Silhouette and timing carry the most important reactions.

These are concept families for one coach, not additional selectable characters.
The comparison surface will retain useful alternatives without adding production
accounts or artificial entries to the coach selector.

Open **Settings → Preview expressions**, or `/coach-studio`. The studio is a lazy
loaded page, reachable in local and account mode, with no engine jobs or preference
writes. Compare three performances side by side, browse each complete expression
collection, replay entrances and idle gestures, run a transition sequence, and
preview natural/subtle/still motion. The two context samples use the real coach
bubble at 92.8px and 52.5px portrait widths. Expression/family URLs are bookmarkable.

Storyteller is the production direction: its open gestures and contrast between
delight and concern read most clearly at the small mobile size. Quiet mentor is a
useful restrained alternative, but loses some facial nuance at 52.5px. Graphic
spark's held poses, glasses follow-through and accents are more theatrical; it
stays in the studio for comparison rather than making gameplay busier by default.
All three preserve the same silhouette, colors and recognizable features.

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
