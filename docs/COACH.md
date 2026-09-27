# Animated coach

The coach is a shared character system for game review, SRS practice and saved
explanations. Chess semantics belong to the reaction layer; artwork and acting
belong to the coach definition. The existing grey-haired, bespectacled coach keeps
his silhouette, beard and sage jacket.

## Visual directions

Three complete directions are being developed on the same character rig:

- **Storyteller:** open, warm facial acting, clear anticipation and recovery,
  expressive shoulders and hands. Strong contrast between delight and concern.
- **Quiet mentor:** smaller head gestures, thoughtful eyes, asymmetry and pauses.
  Character comes from attention rather than large movement.
- **Graphic spark:** crisp poses, delayed secondary motion and restrained drawn
  accents. Silhouette and timing carry the most important reactions.

These are concept families for one coach, not additional selectable characters.
The comparison surface will retain useful alternatives without adding production
accounts or artificial entries to the coach selector.

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
