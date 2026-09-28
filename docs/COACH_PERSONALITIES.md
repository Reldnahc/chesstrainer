# Character writing

The coach catalogue remains the identity source of truth. Each selectable family
registers its definition from `frontend/src/dialogue/characters/`. A definition
contains the internal character bible (temperament, teaching, rhythm, celebration,
correction and boundaries), communication behavior, authored factual forms, a
compactness budget and future-neutral delivery metadata. The laboratory displays
the bible and behavior beside every voice. The owner-supplied cast direction is
preserved in [COACH_CAST_BIBLE.md](COACH_CAST_BIBLE.md).

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
| Midnight tactician | Crisp, controlled confidence and occasional dry wit. |
| Velvet night | Watchful, sparse observations with room for the fact to land. |
| Gentle professor | Patient, sequential explanations; understanding ahead of spectacle. |
| Pocket captain | Spirited confidence grounded in what the move actually accomplishes. |
| Border collie | Focus on patterns, linked evidence and the next useful study task. |
| Young boy | Excitable discoveries and short, plain explanations; no prodigy caricature. |
| Young girl | Isolates a clue, asks a useful question and lets the supported discovery land. |
| Puppy | Warm emotional response followed by one accessible practical lesson. |
| Kitten | Curious investigation of suspicious details, without species jokes. |
| Alien | Separates human appeal from the concrete outcome of the reply. |
| Unicorn | Graceful approval of a supported idea, with honest correction. |
| Gorilla | Large concrete problem, plain reason and dependable consequence. |
| Robot | Labeled issue, cause and result; literal structure without fake precision. |
| Wizard | A supported recurring pattern applied to this exact position. |
| Slime | One idea at a time, brief warmth and beginner-friendly wording. |
| Dragon | Firm standards and earned respect for forcing play or accurate defense. |
| Ghost | Quietly notices threats left waiting; no invented foresight. |
| Raccoon | Practical opportunities first, particularly material left available. |
| Frog | The shortest complete supported fact, then stop. |
| Capybara | Calm acknowledgment, candid fact and a manageable next step. |
| Mushroom | Unusual but concrete observation of connections and support. |
| Living pawn | Earnest attention to the job each piece actually performs. |

Animal voices come from temperament. They do not substitute paw/meow/woof jokes
for analysis. No character may invent intent, claim a calibrated player percentage,
change a grade, or introduce a tactical explanation absent from the intent. The
slot checker preserves the required factual payload when wording changes. The
roster contains 30 selectable coaches; retired definitions are not selectable.
Selection compatibility is handled by the coach registry and account preference
boundary, not by dialogue aliases or a second personality identity list.

## Behavior and composition

Every current coach declares praise, correction and general response strategies,
question frequency, directness, emotional amplitude, humor, jargon tolerance,
address frequency, sentence rhythm, metaphor allowance and a concrete signature.
These settings describe communication, not the meaning or urgency of chess events.
Question cadence, response order, claim caps and optional cues are executed by the
shared pure composition stage. The remaining traits are explicit writing constraints
and visible review metadata rather than hidden numerical rewriting heuristics.

Structured forms contain mandatory fact/consequence fragments and optional
reaction, observation, question and takeaway cues. A consequence-first character
puts a self-contained outcome before the mechanism; question-first asks an authored
question without turning it into a claim about the player's thoughts. Minimal
voices omit the framing and retain necessary qualifications. Compact voices can
choose one claim while patient teachers retain a second supported connection.
Distinctness comes from this structure and the actual authored sentences together.

Required named slots must occur in the mandatory fragments. A question or reaction
cannot be the only place a move, target or reply appears. Positional alternatives
still render with explicit hypothetical scope. Opponent achievements still use
objective wording, not a learner-directed celebration. Runtime validation and the
corpus audit use the same claim contract; malformed custom forms safely fall back.

## Writing and reviewing changes

Use `npm run dev:intelligence` and open the writing comparison on port 5175. The
synthetic exercises cover the full dialogue-purpose contract and common human and
causal claims. They are explicitly
writing examples, not saved chess evidence. Every coach receives the same facts.
Use the deterministic sample control to see other curated variants. Blind mode
hides portraits/names and uses a stable shuffled order across scenarios, allowing
several lines from a voice to be compared before revealing its bible. Enable the
ten-situation comparison to read the same blunder, tactical success, natural mistake,
difficult best move, recovery, miss, quiet improvement, forced defense, mate and
retry together for every coach.

For a real review, import its game-detail JSON and expand **Compare this exact
intent across the cast**. This reuses the production intent and renderer. Compare
both the sentence and its trace, including custom-template or neutral-fallback
source. A missing custom explanation is better served by an accurate neutral
fallback than unsupported character embellishment.

The corpus audit checks every registered coach automatically: full purpose and
common-claim coverage, required/unknown slots, complete bibles/behavior signatures,
duplicate variants, rendered length/placeholders, custom/fallback coverage and
semantic delivery. It reports a whole-corpus collision instead of requiring every
short true sentence to be rewritten 30 ways. Structural tests execute all eight
strategies, claim limits and deterministic question behavior, and ensure common
primary claims do not collapse to neutral. Separate production-path tests protect
causal actor attribution, hypothetical alternatives, human-evidence uncertainty,
learner identity and cold SRS feedback. These checks are not proof of good writing:
inspect blind samples and actual bubble sizes as part of every writing pass.

`dialogue-intent-3` uses a stable avalanche-mixed hash. Raw low-bit modulo selection
made two-choice templates with similar factual keys vary in lockstep; mixing fixes
that correlation while preserving repeatability across navigation and reloads.
No text is selected by time or React render count. The laboratory derives corpus
and roster counts from the registry, not from a historical cast size.

Version 3 separates claim-selection priority from semantic delivery intensity and
urgency. A book fact can lead the bubble without receiving mate-level delivery.
Characters cannot alter that metadata; no speech or new animation loop consumes it.
