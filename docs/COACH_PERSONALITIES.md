# Character writing

Use [Creating a coach](COACH_CREATION_GUIDE.md) for the end-to-end workflow and
[Evidence-led coach dialogue](COACH_DIALOGUE.md) for the semantic contract.
This document is the writing quality gate for both a new character and later
additions to an existing character's dialogue.

The coach catalogue remains the identity source of truth. Each selectable family
registers its definition from `frontend/src/dialogue/characters/`. A definition
contains the internal character bible (temperament, teaching, rhythm, celebration,
correction and boundaries), communication behavior, authored factual forms, a
compactness budget and provider-neutral delivery metadata. The laboratory displays
the bible and behavior beside every voice. The owner-supplied cast direction is
preserved in [COACH_CAST_BIBLE.md](COACH_CAST_BIBLE.md).

The current cast's distinctions are deliberate:

| Coach | Writing direction |
| --- | --- |
| Walter | Connects the present consequence to how the position arrived here. |
| Femi | Welcomes comparison at a shared analysis board. |
| Jun | Economical, exact statements about what is retained or surrendered. |
| Arjun | Tests alternatives as small, evidence-backed experiments. |
| Tamar | Clear standards, concrete tasks and steady motivation. |
| Marisol | Separates observation, searched conclusions and uncertainty. |
| Réka | Quick delight in concrete tactical connections. |
| Ingrid | Easygoing, candid and approachable without softening errors. |
| Felix | Crisp, controlled confidence and occasional dry wit. |
| Juniper | Watchful, sparse observations with room for the fact to land. |
| Alfie | Patient, sequential explanations; understanding ahead of spectacle. |
| Waffles | Spirited confidence grounded in what the move actually accomplishes. |
| Scout (border collie) | Focus on patterns, linked evidence and the next useful study task. |
| Mateo (young boy) | Excitable discoveries and short, plain explanations; no prodigy caricature. |
| Tala (young girl) | Isolates a clue, asks a useful question and lets the supported discovery land. |
| Biscuit (puppy) | Warm emotional response followed by one accessible practical lesson. |
| Pickle (kitten) | Curious investigation of suspicious details, without species jokes. |
| Ziggy (alien) | Separates human appeal from the concrete outcome of the reply. |
| Celeste (unicorn) | Graceful approval of a supported idea, with honest correction. |
| Monty (gorilla) | Large concrete problem, plain reason and dependable consequence. |
| Rivet (robot) | Labeled issue, cause and result; literal structure without fake precision. |
| Orin (wizard) | A supported recurring pattern applied to this exact position. |
| Pip (slime) | One idea at a time, brief warmth and beginner-friendly wording. |
| Ember (dragon) | Firm standards and earned respect for forcing play or accurate defense. |
| Wisp (ghost) | Quietly notices threats left waiting; no invented foresight. |
| Bandit (raccoon) | Practical opportunities first, particularly material left available. |
| Fergus (frog) | The shortest complete supported fact, then stop. |
| Winston (capybara) | Calm acknowledgment, candid fact and a manageable next step. |
| Button (mushroom) | Unusual but concrete observation of connections and support. |
| Percy (living pawn) | Earnest attention to the job each piece actually performs. |

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

Walter and Rivet are the first two voices using scoped tactical meanings. The
shared projection selects role, timing and effect keys plus concrete noun/move
slots; it supplies no full English sentences as runtime slots. Each voice authors
the mandatory factual sentences as well as any optional teaching cues. Walter
connects the idea to what can happen next; Rivet separates a present pattern,
an available reply and a possible result in compact, orderly language. Their 29
scoped forms retain the same evidence without forcing identical factual prose.
Winston and Button have since authored all 29 forms and the opening phrases in
their own voices: Winston calmly states the fact and a manageable next look;
Button approaches the same fact from a slightly odd, gentle angle. Their written
opt-in precedes recorded banks, so they remain silent until a bank is registered.
Wisp (ghost) has also opted in, with its forms kept in `characters/ghost.ts`: it
names what is already on the board or waiting for a reply, in short sentences
with no questions. Pip (slime) has done the same: a small happy or gentle
reaction, then one plain fact in short everyday words, with an occasional Dublin
turn of phrase and no questions. As a one-claim voice, Pip drops a lower-priority
Book recognition rather than adding it after a correction. Percy (living pawn)
has opted in too: an earnest reaction, then the job a piece did or dropped. Like
Winston and Button, Wisp, Pip and Percy stay silent until a bank is registered.
Ziggy (alien) has followed with all 29 forms, the opening phrases and the full
claim set: a curious outsider's observation first, then the plain fact, with no
questions and difficulty always attributed to the human-move model. Ziggy also
stays silent until a bank is registered. Orin (wizard) has done the same, with
his forms in `characters/wizard.ts` and the shared tactic and opening blocks: a
short principle or named pattern, its application to the move, then the
consequence, with restrained approval and no questions. Orin also stays silent
until a bank is registered.
Felix (tuxedo cat) has opted in with all 29 forms, the opening phrases and the
full claim set: the concrete consequence first, then a terse explanation, with
rare, understated approval, dry humor kept to practical costs, no questions and
difficulty always attributed to the human-move model. Felix also stays silent
until a bank is registered.
Bandit (raccoon) has opted in as well, with its forms in `characters/scopedTactics.ts`
and `characters/openingSequence.ts`: it spots what is on offer first, says plainly
why it is there to take, and treats loose pieces and scrappy, effective chess as
the good stuff, without pretending material is all that matters. Bandit stays
silent until a bank is registered.
Alfie (golden retriever) has opted in as well, with his forms in
`characters/professor.ts`: a short principle, this position's fact, then one
connection to keep, explaining the mechanism patiently when correcting. Alfie
also stays silent until a bank is registered.
Pickle (kitten) has opted in the same way: a nosy little detective who pokes at
one suspicious detail, asks a quick question, then answers it with the supported
fact, with delight saved for sneaky tricks and difficulty always attributed to
the human-move model. Pickle also stays silent until a bank is registered.
Ember (dragon) has opted in as well, with its scoped and opening forms in the
shared `scopedTactics.ts` and `openingSequence.ts` blocks: a firm verdict first,
then the concrete reason and its consequence, with sparing, earned approval for
forcing play and exact defense and no questions. Ember also stays silent until a
bank is registered.
Waffles (corgi) has opted in too, with his forms in the shared tactic and opening
blocks: a short command or reaction, the consequence, then the next order, in light
field-manual language with no questions and difficulty always credited to the
human-move model. Waffles stays silent until a bank is registered.
The other 15 voices retain their current wording and deterministic variants.

The same pilot uses three generic opening-recognition phrases and eight phrases
for a verified consecutive run. Every phrase has a complete Walter and Rivet
version, selected by the same stable semantic ID used for whole recorded clips.
The entry phrases make no claim about being first; follow phrases require the
reviewed-prefix contract in [COACH_DIALOGUE.md](COACH_DIALOGUE.md). Recognition
does not prove move quality, development goals, familiarity or strategic intent.
Written opening names remain available without requiring a recording for every
name, and revisiting a position does not choose a fresh phrase.

These scoped tactical and opening-sequence forms are the starting point for a
new coach's writing pass. Use `tacticalWording: "witness"` and
`openingWording: "sequence"` with complete authored templates; do not copy the
older cast's repetitive continuation phrases as the quality target. This does
not authorize converting existing characters without their own writing review.

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

## Walter and Rivet quality gate

Walter and Rivet demonstrate two distinct deliveries of the same supported
meaning. Their writing is a reference standard, not a generic base script to
decorate with another coach's catchphrase. Walter connects the chess event to
its consequence in a warm, measured explanation. Rivet leads with a concrete
pattern or issue, follows cause/result succinctly, and earns occasional dry
understatement. Labels are useful when they clarify the thought; a repetitive
diagnostic prefix is not a personality.

Review a writing change in this order:

1. **Fix the meaning before styling it.** Identify the original claim/recording
   ID, actor, actual versus alternative branch, immediate versus possible effect,
   required slots and evidence limits. A pin can already exist; a witnessed
   follow-up is not guaranteed; only-move evidence is bounded to moves searched.
   Strong and Best are not synonyms. Cold SRS feedback cannot disclose an answer.
2. **Lead with useful chess.** Explain the resource, cost or supported consequence
   before discussing why analysis found it interesting. Reject vague repeated
   framing such as "in this continuation," routine engine-report narration,
   circular praise and a second sentence that merely restates the first.
   Do not remove a necessary qualification just to shorten the line.
3. **Preserve the character in the mandatory sentence.** Optional reactions may
   be removed for space, so they cannot carry all the personality or any unique
   fact. Compare the same meaning across characters with names/portraits hidden.
   It should differ in thought order, teaching approach and rhythm, not only
   synonyms. Do not require every short factual sentence to be unique.
4. **Review sequences, not only isolated highlights.** Read several Book moves,
   corrections, strong moves and recoveries consecutively. Opening recognition
   never proves quality or opening knowledge. Use the shared verified-prefix
   variation contract, not random phrases or assumptions based on move number.
   Include generic entry fallback and a recognized opening move that is an error.
5. **Read the combined objective/human passage as one response.** Preserve the
   distinction between naturalness, an unusual strong choice and corroborated
   difficulty. Natural does not mean good; rare does not mean difficult;
   model estimates are not observed population success rates. The human point
   must add something useful without repeating the tactical explanation or
   turning each line into a methodology disclaimer.
6. **Inspect the actual output.** Check learner and opponent turns, branches,
   positional alternatives, missing evidence and narrow bubbles. Compare trace
   sources and `renderedClaims` as well as the sentence. Unexpected neutral
   fallback on frequent claims is a writing/integration problem, not a reason
   to bypass validation. Neutral fallback is appropriate when custom wording
   cannot safely retain a rare fact.

Written templates may name the actual moves and targets. Recorded summaries
deliberately teach the reusable idea while the board/text provide the specifics.
Do not force their transcripts to match, and do not independently invent chess
reasoning for speech. The active bank manifest is the shipped spoken script;
changing a personality template does not rerecord it. Both paths must preserve
the same scope and character. Lessons do not receive recorded narration.

The latest [Rivet editorial ledger](../frontend/src/audio/speech/banks/rivet/revisions/wording-v2.json)
records 197 replacements among 257 reviewed additions, with 60 additions retained.
It explains each correction instead of making more clips the measure of quality.
Compare it with [Walter's spoken revision](../frontend/src/audio/speech/bank/revisions/walter-language-v2.json)
and the active manifests in [Audio](AUDIO.md#bank-and-authoring). Avoid "separate"
and "separately" in active speech: the locked voices do not pronounce them
reliably. Recording, pronunciation, timing and listening review belong to the
[audio authoring process](AUDIO.md); a clean corpus test alone does not establish
that a recorded line sounds good.

## Focused verification

Run commands from `frontend` unless specified otherwise. These are writing and
speech-contract checks, not a replacement for the broader validation appropriate
to changed artwork, playback or account code. Close a running development server
on a test port before using its normal Playwright config; do not silently test a
different existing application.

```sh
npx playwright test dialogue-logic.spec.ts personality.spec.ts walter-dialogue.spec.ts scoped-dialogue.spec.ts opening-dialogue.spec.ts
npx playwright test --config playwright.intelligence.config.ts corpus.spec.ts causal-dialogue.spec.ts human-dialogue.spec.ts positional-dialogue.spec.ts walter-dialogue.spec.ts
npm run test:audio -- game-speech-combinations.spec.ts maia-meaning-coverage.spec.ts voice-registry.spec.ts recorded-coach-comparison.spec.ts
```

The first two commands cover production rendering and the writing laboratory;
the third protects whole-recording combinations and the shared bank interface.
For script changes, from repository root:

```sh
.venv/Scripts/python.exe -m pytest backend/tests/test_coach_pilot_scripts.py backend/tests/test_walter_language_revision.py backend/tests/test_coach_voice_bank.py -q
.venv/Scripts/python.exe -S scripts/prepare_coach_voice_bank.py --check
```

Use `.venv/bin/python` on POSIX. The strict bank check is offline and does not
record audio. Read/listen to the actual edited scripts and production comparison
at desktop and mobile sizes after automated checks. Report any listening or
browser inspection that the environment cannot perform, rather than counting
compilation or file validation as subjective quality approval.

`dialogue-intent-3` uses a stable avalanche-mixed hash. Raw low-bit modulo selection
made two-choice templates with similar factual keys vary in lockstep; mixing fixes
that correlation while preserving repeatability across navigation and reloads.
No text is selected by time or React render count. The laboratory derives corpus
and roster counts from the registry, not from a historical cast size.

Version 3 separates claim-selection priority from semantic delivery intensity and
urgency. A book fact can lead the bubble without receiving mate-level delivery.
Characters cannot alter that metadata. Recorded speech consumes priority,
interruptibility and automatic-play eligibility without changing chess facts or
starting a second animation scheduler.
