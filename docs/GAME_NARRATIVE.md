# Game story retired

The owner removed Game Story / Critical Moments after hands-on review. The product
now stays focused on individual moves: no ranked takeaways, key-moment jumps,
opening/result story prose or completion-driven coach reaction.

`GameNarrative` and `NarrativeMoment` were response-time projections, never stored
database records. Their generator, detail/progress API fields, generated contracts,
UI, styles, language templates and story-only tests have been removed. No migration
or legacy narrative payload is needed; stored move reports remain unchanged.

The two-sided [game context](GAME_CONTEXT.md), its diagnostic turning-point data,
and [owned history](CROSS_GAME_CONTEXT.md) remain useful for evidence-backed
move-by-move coaching. Refinement still investigates selected positions under its
existing budgets. This retirement supersedes the narrative milestone in the
historical implementation plan.
