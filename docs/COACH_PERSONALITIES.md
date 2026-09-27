# Character writing

The coach catalogue remains the identity source of truth. Each selectable family
registers its definition from `frontend/src/dialogue/characters/`. A definition
contains the internal character bible (temperament, teaching, rhythm, celebration,
correction and boundaries), curated factual templates, a compactness budget and
future-neutral delivery metadata. The laboratory displays the bible beside every
voice, so art, writing and teaching style can be reviewed together.

The current cast's distinctions are deliberate:

| Coach | Writing direction |
| --- | --- |
| Storyteller | Connects the present consequence to how the position arrived here. |
| Club host | Welcomes comparison at a shared analysis board. |
| Endgame expert | Economical, exact statements about what is retained or surrendered. |
| Creative partner | Tests alternatives as small, evidence-backed experiments. |
| Club captain | Clear standards, concrete tasks and steady motivation. |
| Quiet analyst | Separates observation, searched conclusions and uncertainty. |
| Bright spark | Quick delight in concrete tactical connections. |
| Golden braid | Easygoing, candid and approachable without softening errors. |
| Library tabby | Unhurried curiosity; lingers over a useful detail. |
| Midnight tactician | Crisp, controlled confidence and occasional dry wit. |
| Curious calico | Investigates connections and encourages looking from another angle. |
| Velvet night | Watchful, sparse observations with room for the fact to land. |
| Sunny companion | Open enthusiasm for discoveries and practical engagement after errors. |
| Gentle professor | Patient, sequential explanations; understanding ahead of spectacle. |
| Pocket captain | Spirited confidence grounded in what the move actually accomplishes. |
| Border collie | Focus on patterns, linked evidence and the next useful study task. |

Animal voices come from temperament. They do not substitute paw/meow/woof jokes
for analysis. No character may invent intent, claim a calibrated player percentage,
change a grade, or introduce a tactical explanation absent from the intent. The
slot checker preserves the required factual payload when wording changes.

## Writing and reviewing changes

Use `npm run dev:intelligence` and open the writing comparison on port 5175. The
26 synthetic exercises cover the full dialogue-purpose contract. They are explicitly
writing examples, not saved chess evidence. Every coach receives the same facts.
Use the deterministic sample control to see other curated variants. Blind mode
hides portraits/names and uses a stable shuffled order across scenarios, allowing
several lines from a voice to be compared before revealing its bible.

For a real review, import its game-detail JSON and expand **Compare this exact
intent across the cast**. This reuses the production intent and renderer. Compare
both the sentence and its trace, including custom-template or neutral-fallback
source. A missing custom explanation is better served by an accurate neutral
fallback than unsupported character embellishment.

The corpus audit checks every registered coach automatically: full purpose
coverage, high-frequency variation, required/unknown slots, empty bibles, duplicate
lines, long normalized duplicates, near-identical long sentences within a claim
family (token overlap above 0.9), and rendered length/placeholder/semantic delivery.
These are useful mechanical checks, not proof of good writing. Inspect short and
quiet lines, actual bubble sizes, and blind samples as part of every writing pass.

`dialogue-intent-2` uses a stable avalanche-mixed hash. Raw low-bit modulo selection
made two-choice templates with similar factual keys vary in lockstep; mixing fixes
that correlation while preserving repeatability across navigation and reloads.
No text is selected by time or React render count. The first full-cast pass has
912 curated lines; this count is a dated observation, not a fixed registry limit.
