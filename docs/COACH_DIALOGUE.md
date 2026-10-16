# Evidence-led coach dialogue

For the complete creation workflow, start with
[Creating a coach](COACH_CREATION_GUIDE.md). This document owns the factual
presentation contract; [Character writing](#character-writing) owns editorial
review, and [Audio](AUDIO.md#recorded-coach-voices) owns recorded delivery.

`frontend/src/dialogue` is a pure presentation boundary. The server supplies
versioned review events, practical evidence and context relationships.
The client selects `DialogueIntent` claims with evidence references, source IDs,
priority and named slots, then renders a `CoachUtterance`. Neither layer evaluates
chess, calls models or writes saved review truth.

Game review, explored variations, authorized practice feedback and Show Why use
the same utterance boundary. Old saved/API-compatible neutral text is a fallback
only when semantic evidence is absent. Practice still uses its existing gated
continuation authority; it does not borrow the original game's mistake to grade
the learner's new move. A cold card ignores even a stray future preview frame.

The neutral renderer favors concrete mate/tactical consequences, critical defenses
and recoveries, then supported positional, human and history observations. Clock observations
are not spoken or shown.
The neutral bubble targets two whole claims within 290 characters; each character
declares its own claim/character budget (Walter 320, Rivet 270, both two claims).
The first supported fact and long legacy verified explanations retain their
wording rather than being truncated to meet that target. An evaluation loss alone
never becomes a weak-square or king-safety story. Book recognition can coexist
with an objective error; its name never displaces the error's consequence with a
quality disclaimer. Human-model wording describes naturalness/difficulty, not a
calibrated percentage of Chess.com players. Cross-game references require supported
independent evidence. A branch cannot inherit recorded-game relationships.

`move-events-3` adds visible role-piece identities and exact witness plies to tactic
facts. `immediate_reply` projects the played line's first reply, not a best-line
answer. Targets being forked are distinguished from later captures. These facts
are coach independent, as are the Fieldwork labels and Stockfish scores.

`move-events-4` preserves mover-caused errors with an explicit responsible actor
and opponent opportunity actor. Dedicated causal claims explain the abandoned
defender, unaddressed preceding threat or unfavorable capture/recapture. They retain
the verified source IDs through character-specific causal wording; an opponent
tactic template never narrates a mover-caused error. Required mover, target and
reply slots cannot be removed by optional character staging.

Intent version 4 retains positional branch identity in `Claim.position`: the
actual or alternative line and its SAN move. Alternative positional claims use
shared base predicates wrapped as `<move> would ...`; an actual-board personality
template cannot override that scope. This applies to every positional family,
including bishop pairs and doubled files. Actual consequences keep factual tense
and existing personality wording. Unsupported conditional predicates abstain.
The utterance trace identifies this rendering as `positional-conditional-1`.

On a move graded Inaccuracy or worse, a positional fact is kept only when it explains
the cost: the mover's own piece losing its defender or pawns becoming doubled or isolated,
the opponent gaining an open file or passed pawn, or what the better move would have
gained. A gained defender, a new king square, castling and the better move's own
drawbacks are left out, and so is the better move's pawn structure: the alternative
doubled- and isolated-pawn lines frame it as the better move's own untidy structure,
which is false when the weakened pawns are the opponent's. The better move's
development or castling is also left out when the played move did the same. Defender facts on a piece that is simply recaptured are left out on
any move. In speech, repeated-issue and saved-history lines only follow the sentence that
names the issue (a tactic, cause or mate clip); a move with no playable sentence speaks
its grade take instead. A second sentence never restates the lead: no capture clip after a
cause, hanging-piece or allowed-mate clip, and no stronger-alternative clip after a missed
tactic or mate. Promotion clips describe a pawn still on its way, so they never play
when the witnessed move is itself the promotion, in game review or in practice findings.
Pin clips say the move makes (or allows, or missed making) the pin, so a line that only
uses a pin already on the board before the move (the tactic's `pinned_before` fact) speaks
its grade take instead.
The evaluation-loss clip, some of whose takes call the cost small, plays only on an
Inaccuracy; a larger loss passes the lead on or speaks its grade take.
A forced-mate stage is told once per run of the same side's moves, and an
erosion run only on an Inaccuracy. The chance-taken clip, some of whose takes call the
reply exact, plays only on a move graded Best, Great or Brilliant. A recovery plays
`recovery-assisted` when the opponent made Mistakes in between and `recovery`
otherwise; no take credits this move, since a move never raises its own evaluation
and the opponent's moves made the game playable. The opening-departure event fires
after the game's last move in our opening catalogue, which can be a main-line theory
move, so every take says our opening book ends there, never that theory ends or that
the game leaves the book for the first time. Repeated-issue takes never count the
occurrences, so they play from the second on. A take found false where its meaning
fires goes in `ALWAYS_FALSE` in `audio/speech/falseTakes.ts` until it is re-recorded;
the list is empty since the Oct 15 re-recordings. Narrower gates apply elsewhere: no
double-attack take plays for a double check (its witness names the king: one target, and every legal
reply meets both checks), and the move that gives it plays the coach's double-check take instead;
where our catalogue has no name, book takes saying the opening has one give way to the
coach's next take of the same kind; and chance-taken takes calling the opponent's error small drop out of the take rotation
unless that error was graded Inaccuracy or Mistake. Takes rotate so that a side's back-to-back
moves (two plies apart) differ whenever a meaning has three or more takes.

Intent version 5 records the subject as learner, opponent or unknown position.
The saved game's `orientation` is the learner identity; flipping the displayed
board does not change it. Personal relationships/history require a matching
mainline node and evidence generation, a learner move, a relation whose actor is
the learner, and a link ending at this ply. This covers recovery, punishment or
missed punishment, repeated errors, restored support, erosion and conversion.
The two-sided graph is preserved. Opponent errors can still explain the learner's
next opportunity or recovery, including explicit acknowledgement of their help.

Opponent moves keep objective grades, tactical/positional consequences and reply
explanations. Their intent stays explanatory rather than personal praise or
correction. Recognized Book moves retain the Book reaction on either side, with
the existing check and explicit explanation precedence; other opponent moves use
the explaining expression. Rendering uses neutral factual templates so personality
wording cannot address an opponent achievement as the learner's. Terminal outcomes still
use the saved learner's side. Missing mover identity never implies the learner.
Cold practice retains its separate gated intent path.

`humanClaims.ts` projects existing practical interpretations into compact claims:
natural mistake, hard find, unusual but strong, natural best/strong choice, and
hard defense found or missed. Rarity alone is not promoted to the stronger
corroborated-difficulty tier. A near-best natural move is not called the engine's
best. Missing/unavailable, forced, mismatched move/actor or stale human generations
abstain. No probability, difficulty threshold, grade or engine budget is computed
or changed here.

In game review, `HumanInsight` presents the same selected claims in the shared
coach's compact insight row,
even when a more important objective claim occupies the bubble. Its compact Maia
line opens a native popover with selected-coach wording and source/domain notes.
It remains available during Show why, closes on position/evidence changes, and
does not change board or bubble dimensions. Native Escape/focus handling takes
precedence over review shortcuts while it is open. Unknown source/time control,
domain shift, missing ratings/history and incomplete policy retain uncertainty;
estimates are never presented as measured player success rates. Provider naming
falls back generically rather than calling a future provider Maia.

The badge and popup are written only, and they are the only place Maia appears:
the coach never speaks or shows a Maia reading in its line. `gameIntent` adds Maia claims only when asked with
`human: true`, which `PositionCoach` does just for the popup's intent; the coach's
own intent has none, so a sound move with nothing else to say gets the plain best
or good line. The popup renders the reading through `DialogueText` with its
explanation, so it stays one tap away.

The popup is only a rendering of the existing intent and stored report. Changing
coaches keeps its intent/evidence identity and performs no extra engine/model
work. Cold SRS never renders this component. The intelligence laboratory can trace
the same human claims without a second inference or presentation rules engine.

Variant selection uses stable factual identity, including game/path/evidence,
never render time or analysis retry epoch. An utterance carries its intent ID,
selected template/variant, source IDs and selection decisions. It also provides
expression, intensity, priority, interruptibility, optional speech text and
auto-speak suitability. The recorded-speech layer selects supported clips from
the emitted claims; it does not synthesize this text at runtime. See
[AUDIO.md](AUDIO.md) for playback, feedback gates and the separate voice-bank
authoring process.

Claim priority ranks bubble content only. Since intent version 3, delivery
intensity and urgency derive from semantic reactions, with a supported forced-mate
override even when the move is recognized as Book. Routine opening recognition
remains quiet and interruptible; unavailable/thinking/cold feedback is unsuitable
for automatic narration of analysis. This metadata does not change grades, portraits or
the existing reduced-motion behavior.

Regression coverage lives in `dialogue-logic.spec.ts`, game/coach/practice browser
suites and backend review-event tests. Developer diagnostics consume these same
pure functions rather than implement another dialogue pipeline.

### Recorded lines that would need new takes

These takes are false in some positions where their meaning fires, so selection
keeps them silent there and the written line (or the next clip or grade take)
stands in. Re-recording them with true wording would let them play again.

- **`chance-taken`** (the base take) for celeste, mateo and pickle after an
  opponent's Blunder or Miss: "a small gift", "a little something", "a little gap".
  Their other chance-taken takes still play.
- **Book takes saying the opening has a name** (felix, pip, reka, tala, tamar) give
  way to the coach's next take of the same kind where our catalogue has no name.
The back-rank, recovery, opening-departure, repeated-issue and Orin draw takes that
were false were rewritten and re-recorded on Oct 15; each bank's
`revisions/false-takes-v1.json` (Walter's `bank/revisions/walter-false-takes-v1.json`)
holds the previous text, the new text and the reason. Orin's fork takes (which
promised only one target escapes) and the Orin and Tamar castling takes (which
called castling shelter or safety) followed on Oct 16, in `revisions/fork-takes-v1.json`
and `revisions/castling-safety-v1.json`. A spec checks no recorded take brings
those claims back. Back-rank takes saying the king is hemmed in or trapped by its
own pieces (tala, percy, pickle) are true of the pattern and stay, by Chandler's
ruling; only the claim that every escape square holds the king's own piece was false.

## Personality boundary

Each family in the existing coach catalogue may register a `CoachPersonality`.
The selectable registry carries it into the existing account-selected coach;
there is no parallel identity list or new account setting. An omitted definition
uses the neutral personality. A partial or malformed custom template falls back
to the neutral rendering for that claim. New coaches therefore work safely before
their full writing is ready.

The renderer receives only `DialogueIntent` and a character definition. Character
bibles describe temperament, teaching, rhythm, celebration, correction and explicit
prohibitions. Communication behavior selects separate praise, correction and
general strategies: reaction-first, consequence-first, observation-first,
question-first, pattern-first, mentor-first, calm-reset or minimal. Directness,
emotional amplitude, humor, jargon, sentence length and address preferences are
authoring metadata; they do not rescore a move or modify factual intensity.

Authored claims can be plain sentences or structured `ClaimWording` fragments.
`fact` and optional `consequence` are mandatory; reaction, observation, question
and takeaway are optional teaching cues. Composition changes the order of the
mandatory fragments and selects the appropriate cue. Consequence-first therefore
really states the result before its cause; minimal drops optional framing. Missed
tactics are an explicit exception: their unplayed-candidate introduction must come
before its effects, so those effects cannot be mistaken for the actual board. The
variant trace records the ordering actually used. Question
cadence is a deterministic sample of factual intent identity, never a render-time
coin toss. The selected claim cap still applies, and low-priority claims cannot
displace the main consequence. When a response is long, optional cues are removed
before an entire secondary claim is omitted. Required facts are never truncated.

Recorded positional takes are selected only where their wording holds: the
passed-pawn advance takes count one step, so a double step is not voiced; the
king-flight takes speak of one new square, so two or more are not; and the
semi-open-file takes describe a file that stays semi-open, so a file that was
open and became semi-open is not voiced. The written lines remain.

Runtime slot validation checks custom forms against the neutral claim contract.
Unknown slots, missing mandatory slots or facts hidden only in an optional cue
fall back to neutral wording. Positional alternatives and opponent/unknown-subject
claims retain their protected factual rendering and do not acquire learner praise
or character questions. The two scoped-meaning pilot voices can author objective
tactical and opening facts for either mover; opponent delivery still uses minimal
composition. Priority, reaction meaning, references and claims remain
unchanged. No personality code can query an engine, model or account; render
definitions are data rather than arbitrary callbacks.

`useDialogue` reads the existing account preference and renders synchronously.
Switching and reloading a selected coach changes language and portrait while
preserving stored reports. The laboratory's Voice selector renders the same intent
through any current registry entry or the neutral reference, with template-source
and deterministic variant provenance shown in the trace. The trace also records
active strategy, sentence/composed form, cues actually retained, claim/question/
sentence counts, and custom-versus-fallback claim counts.

An allowed-mate claim already names the report's immediate reply. The intent
builder omits a second check-only claim for that same reply, while preserving
capture facts and the actual checking reply when discussing an unplayed missed
mate. This removes repeated wording without changing saved chess evidence.

The full selectable cast now has curated claim wording and character bibles.
See [Character writing](#character-writing) for the writing standards,
blind comparison and automatic corpus checks. Rare supported facts can still use
the complete neutral fallback; character wording never replaces chess evidence.
Claim codes are a closed list (`claimCodes`/`ClaimCode` in `dialogue/model.ts`),
and `neutralTemplates` must have an entry for every code, so a new code without
neutral wording fails to compile rather than rendering as nothing.
`uncertain_reason` and `variation` have neutral templates but no producer yet.
Motif and explanation-mechanism vocabulary (spoken words, scoped motif names,
recorded tactic/cue/cause meanings and piece subjects) lives in one table,
`dialogue/tacticalVocabulary.ts`; move grades, poor-move checks and their
articles live in `moveQuality.ts`.

All thirty coaches' on-screen tactical wording uses `tacticalWording: "witness"`, which `coachPersonality()` gives every coach.
`eventClaims` attaches derived timing/effect metadata while retaining the original
claim codes, slots and source references. A line witness that starts on this
move (root ply 1, with its SAN) or on the opponent's immediate reply (ply 2), with
its reference board just before or after that move, supports direct timing, even
when the witness goes on to a later collection; the reference frame alone does
not. `eventClaims.tacticStartsHere` is that one rule, and the recorded tactic
clips use it too. A witness that starts later, or incomplete timing, remains a
possible idea. Current facts do not imply that the move created a previously
absent pin or fork.

`tacticalTemplates` selects one of 29 scoped presentation keys and typed slots
containing moves, motif names, targets and capture nouns. It does not construct
English setup or detail sentences. `scopedTacticalWording` supplies the neutral
required-slot contract and assembles static authored templates. Each coach
authors complete mandatory scope and effect sentences in its own
`characters/<coach>.ts`; personality is not limited to an optional preface
around one shared factual sentence. Actual root effects can be factual; opponent
replies and unplayed alternatives remain prospective.
Targets on a possible future board are not described as already attacked. A
positive finite-line material delta is a possible gain dependent on follow-up,
not proof of a forced gain or a material lead. Character templates cannot discard
the required moves, replies or targets, or hide them only in optional cues.
All scoped tactical forms put the scope before its effects. Opponent facts use
the same scope without personal praise.
Capture effects use their own witnessed ply: a root capture already happened
even when the motif's reference frame describes the board before that capture.

Full intent identity includes this metadata. A separate legacy wording key keeps
unchanged characters' deterministic text variants stable; it never replaces the
intent ID or source binding. `renderedClaims` continues to expose the original
claims, preserving prerecorded speech selection. Walter's rewritten character
templates remove engine-report framing; authorized practice/explanation detail
is still passed through verbatim rather than edited by guessing at its meaning.
Derived human-insight intents retain both the actual parent identity and its
separate wording seed, so this opt-in does not reshuffle other voices' Maia text.

Every coach also uses `openingWording: "sequence"`, from the same helper. An optional
`Claim.opening` comes from `openingPresentation`, while the original `book` or
`book_sound` code, opening-name slot, evidence, priority and source IDs remain
unchanged. `bookRecordingId` exposes the same 11 semantic variant IDs to written
and recorded dialogue: `book-opening-entry-1` through `-3`, and
`book-opening-follow-1` through `-8`. Each voice authors its own complete
sentence for each ID. These are recognition statements, never inferred quality,
strategic plans or claims about a player's opening knowledge.

A follow variant requires an actually reviewed mainline prefix. Each report is
bound to the frame's SAN, UCI, FEN, actor and ply, and its input digest must match
the corresponding context node. A missing or stale earlier report, missing node,
or changed opening catalogue invalidates the sequence ordinal. The current move
can still receive a generic entry phrase if its own report binds; entry wording
does not claim that this is the first recognized move. Variations, including
branches rooted at Start, use this generic recognition scope rather than copying
the mainline's sequence. Names and transpositions do not themselves reset a run;
a verified non-book move does. The finite variants are seeded by saved game ID,
catalogue version and run start, with eight follow phrases cycling by actual run
ordinal and no adjacent repeat. When the prefix is unknown or on a branch,
generic entry variation also uses the recognized move and resulting FEN, so
unrelated recognized positions are not all locked to one phrase; this adds no
sequence assertion. Search refinements, visits, coach changes and
later review progress do not enter that seed. Completing a previously unknown
prefix may make its sequence known; it is not a speech playback event.

The coach follows the displayed badge: a move shown as Book is recognized
theory, so the coach names the opening instead of correcting it, even when the
engine grades it poorly. The engine grade stays in
`engine_label` for accuracy, board arrows and the Maia popup. Opening metadata is excluded from the legacy wording seed for the other
voices and never enters cold practice dialogue. No new opening recognition,
engine work, automatic speech event or learning inference is performed here.

A poor move's immediate-capture claim needs a real loss: when the reply only
recaptures what the move took, or the mover's next move in the line
(`immediate_recapture`) takes the material straight back, it is an even trade
and the claim is omitted. A tactic whose witness starts on this move outranks
one of the same role that only appears later in the line. The spoken lead is the
first non-Maia rendered claim with a recording, so a leading claim without a
clip passes the lead on instead of silencing the move.

## Written facts and recorded summaries

Written and spoken dialogue share supported semantic meanings, not a generated
English sentence. `renderDialogue` in `neutral.ts` produces the visible text and
its exact `renderedClaims`. The selectors in `audio/speech/gameSelection.ts` and
`practiceSelection.ts` validate the corresponding source events or authorized
feedback before choosing a recording ID. They do not extract meaning from prose
or match a phrase to a clip. A missing or unsupported recording leaves the written
feedback available; it never triggers synthesis or weaker evidence validation.
A checkmate frame in a practice or Show why line plays `mate-finished` only when the
learner (the exercise's orientation) delivers the mate; when the other side mates,
it plays `mate-defense-ended`, as a game's final position does.

Walter (`classic`, `classic.ts`) and Rivet (`robot`, `robot.ts`) are the current
production references for this complete path. Both use the scoped tactical and
opening-sequence contracts described above, as every coach now does, and all
thirty coaches have registered voice banks. A cast audition or saved provider
voice alone does not mean a complete bank is installed. Use the live coach and
voice registries rather than hard-coding the current recording count.

A recorded passage teaches the supported idea without reciting arbitrary SAN,
square names, player names, opening names or evaluation numbers. The game review
moves line, the board, Show why and written course content keep those precise
details. This is intentional editorial compression, not
permission to lose the responsible side, make an unplayed alternative factual,
upgrade a possible resource to a forced result, or turn a human-model estimate
into chess truth. Lesson teaching text stays written; only the nine generic
lesson prompts are voiced.

Human-model (Maia) claims never reach the coach's dialogue, so they never select
a recording. The Maia badge supplies nothing to speech, and `meanings.json` has no
`human-*` or objective/Maia combination meanings. Late Maia
evidence can update text, and so the bubble's objective recording for the next
explicit playback, but does not authorize a second automatic spoken response for
the same move.

### Bubble text is the spoken line

The speech bubble shows what the coach
**says**, not the separately written template. The written utterance is still
rendered from claims and still drives selection and validation; only the
displayed text changes. `useSpokenText(coachId, recordingId)`
(`audio/speech/spokenText.ts`) returns the coach's recorded manifest line for the
selected meaning, otherwise that coach's own `scripts.json` line (a sequence
needs every part). It works with voice on or off and loads each coach's script
lazily, returning null while loading or when there is no line, so the written
text shows instead.

- **Game review:** the move bubble shows the spoken line for the same recording
  ID used for playback (a recorded coach's exact clip, including the greeting) or,
  for a line written but not yet recorded, the coach's script line for that meaning. No meaning
  (pending, no report, legacy prose) keeps the written text.
  Show why keeps the written detailed explanation. The concrete facts come from
  report/position data only. The engine's strongest reply (`immediate_reply`, never
  a claim about the move actually played) sits under **Best** in the portrait
  caption as **Reply <SAN>** for a non-terminal position, and the board draws it
  as a faded blue arrow. While the spoken line shows, a moves line beneath it
  carries the opening name (`report.opening`), wrapping beside the Maia chip
  outside the scrolling message. The screen-reader text still announces
  `<Side>’s strongest reply: <SAN>` and ", forced mate" only when an `allowed_mate`
  claim proves it. Like any long line, a joined spoken line scrolls inside the
  fixed-height bubble. The reply sits under Best because a footer wrapped on
  phones.
- **Practice:** puzzles, opening recall, the opening line preview and Due's
  generic states (cold, retry prompt, fallback completion) show the spoken line
  for their selected recording. Lessons replace only the coach's own sentences
  (wrong move, correct move outside a decision, guided playback, chapter
  complete). Error states (puzzle, lesson, Due and recall grading errors) keep
  their written sentence, whose instruction or fact a paraphrase can drop, and a
  solved puzzle keeps its saved record ("Saved as failed, then solved." / "Saved
  as a clean solve.") written after the spoken line. Step text, hints, authored decision feedback, game
  notes and a revealed move's SAN are course content and stay written, as do
  Due frame annotations, explanation summaries and every Show why passage, which
  name concrete moves the spoken lines leave out.

`useCoachSpeech` consumes navigation/attempt event identity separately from
utterance identity. Hydration, refinement, coach selection and completion of an
opening prefix are not new automatic narration events. Speech also consumes
semantic priority, interruptibility and automatic-play eligibility; character
writing may not change these to make a line play. See [Audio](AUDIO.md) for
cancellation, readiness, visibility, mute and manual-replay behavior.

Changing a `.ts` personality template changes written rendering only. Changing
a voice-bank transcript requires a replacement whole audio file, provenance and
regenerated mouth timing before its active manifest is updated. The writing and
recording passes must be reviewed together, but they are distinct artifacts.
The [Walter spoken revision](../frontend/src/audio/speech/bank/revisions/walter-language-v2.json)
and Rivet spoken revisions ([wording](../frontend/src/audio/speech/banks/rivet/revisions/wording-v2.json), [distinct voice](../frontend/src/audio/speech/banks/rivet/revisions/wording-v3.json))
record approved examples and the reasoning behind them; they are not additional
runtime dialogue generators.

## Character writing

Use [Creating a coach](COACH_CREATION_GUIDE.md) for the end-to-end workflow and
[Evidence-led coach dialogue](COACH_DIALOGUE.md) for the semantic contract.
This document is the writing quality gate for both a new character and later
additions to an existing character's dialogue.

The coach catalogue remains the identity source of truth. Each selectable family
registers its definition from `frontend/src/dialogue/characters/`, one file per coach
listed once in `characters/index.ts` (`coachPersonalities`). Each file is named for its
coach ID after the family (`dog-gentle` is `gentle.ts`, `classic` is `classic.ts`), so
no mapping is needed; a personality's `version` keeps its original name because
stored dialogue refers to it. A definition
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

### Behavior and composition

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
Button approaches the same fact from a slightly odd, gentle angle. All 30 coaches now
speak these lines from registered recorded banks.
Wisp (ghost) has also opted in, with its forms kept in `characters/ghost.ts`: it
names what is already on the board or waiting for a reply, in short sentences
with no questions. Pip (slime) has done the same: a small happy or gentle
reaction, then one plain fact in short everyday words, with an occasional Dublin
turn of phrase and no questions. As a one-claim voice, Pip drops a lower-priority
Book recognition rather than adding it after a correction. Percy (living pawn)
has opted in too: an earnest reaction, then the job a piece did or dropped.
Ziggy (alien) has followed with all 29 forms, the opening phrases and the full
claim set: a curious outsider's observation first, then the plain fact, with no
questions and difficulty always attributed to the human-move model. Orin (wizard) has done the same, with
his forms in `characters/wizard.ts`: a
short principle or named pattern, its application to the move, then the
consequence, with restrained approval and no questions.
Felix (tuxedo cat) has opted in with all 29 forms, the opening phrases and the
full claim set: the concrete consequence first, then a terse explanation, with
rare, understated approval, dry humor kept to practical costs, no questions and
difficulty always attributed to the human-move model.
Bandit (raccoon) has opted in as well, with its forms in `characters/raccoon.ts`: it spots what is on offer first, says plainly
why it is there to take, and treats loose pieces and scrappy, effective chess as
the good stuff, without pretending material is all that matters.
Alfie (golden retriever) has opted in as well, with his forms in
`characters/gentle.ts`: a short principle, this position's fact, then one
connection to keep, explaining the mechanism patiently when correcting.
Pickle (kitten) has opted in the same way: a nosy little detective who pokes at
one suspicious detail, asks a quick question, then answers it with the supported
fact, with delight saved for sneaky tricks and difficulty always attributed to
the human-move model.
Ember (dragon) has opted in as well, with its scoped and opening forms in
`characters/dragon.ts`: a firm verdict first,
then the concrete reason and its consequence, with sparing, earned approval for
forcing play and exact defense and no questions.
Scout (border collie) has opted in too, with his forms in `characters/collie.ts`:
a quick pattern call, the concrete fact, then one short task to train it, with
no questions.
Juniper (black cat) has followed in `characters/black.ts`:
a small exposed detail first, a beat, then a gentle conclusion, with the
occasional first-person "I noticed", soft encouragement and no questions. As a
one-claim voice, she drops a lower-priority Book recognition like Pip.
Waffles (corgi) has opted in too, with his forms in `characters/corgi.ts`:
a short command or reaction, the consequence, then the next order, in light
field-manual language with no questions and difficulty always credited to the
human-move model.
Celeste (unicorn) has followed in `characters/unicorn.ts`: a brief genuine
reaction, a flowing description of what the move joins, frees or breaks, then
one gentle lesson, with delight kept for sound sacrifices, hidden tactics and
narrow defenses, kind but clear correction and no questions.
Jun (`man-expert`) has opted in as well, in `characters/expert.ts`: the fact,
its exact consequence and the supported resource, in clipped technical labels
(absolute pin, theory, net material, flight square), with sparse approval for
precision, no emotion that depends on which side moved, and no questions.
Fergus (frog) has opted in too, with his forms in `characters/frog.ts`:
one flat report of the fact with a dry, side-neutral tail at most, no questions
and no exclamation marks.
Arjun (`man-partner`) has opted in too, in `characters/partner.ts`: an occasional
genuine question that reveals the mechanism, then the idea, then a comparison of
candidates side by side, with delight kept for unusual resources and no claim
beyond the supported line.
Femi (human host) has opted in too, with his forms in `characters/host.ts`:
a club analyst's reaction across the table, a "hold that thought" at the problem, then
the concrete reply put on the board, with occasional questions, book moves called
"prep" or "main line", and difficulty always credited to the human-move model.
Marisol (`woman-analyst`) has opted in as well, in `characters/analyst.ts`: a
compact before-and-after observation of exactly what the move changed, then its
consequence, with the human-move model's and the engine's readings kept apart,
rare factual approval and no questions.
Monty (gorilla) has opted in as well, with his forms in `characters/gorilla.ts`:
one big concrete problem in plain
words, the simple reason, then the result, with earnest, sparse approval and no
questions.
Ingrid (`woman-blonde`) has opted in too, in `characters/blonde.ts`: a relaxed,
unhurried opener, the concrete fact said plainly, then one manageable next idea,
with reassurance kept to the player's own moments and always beside a chess point,
and no questions.
Biscuit (puppy) has opted in as an eager teammate: an honest emotional beat,
the concrete reply in plain words, then one small habit to carry forward, with
ownership words kept to the learner's own moments.
Réka (`woman-spark`) has opted in too, in `characters/spark.ts`: a quick reaction to
the pattern, the tactical punchline, then its supported consequence, with her own
"eyes up" warning, "repertoire" for book moves, delight such as "Zing!" kept for
the learner's own clips, and difficulty credited to the human-move model.
Mateo (`human-boy`) has opted in as well, in `characters/boy.ts`: a short
burst of excitement aimed at the tactic itself, sometimes a "wait" or "look at
this", then one plain, complete chess fact, with an occasional question whose
answer is on the board. His cheering and sympathy stay on the player's own
moments.
Tamar (`woman-captain`) has opted in as well, in `characters/captain.ts`: a
firm verdict, the concrete reason, then one habit to build, with open mentor
pride kept to the learner's own moves, plain-clip lines that name no owner,
and no questions.
Tala (young girl) has opted in as well, with her forms in `characters/girl.ts`:
a genuine question or one circled detail,
the discovery, then its consequence, with competitive curiosity instead of scolding,
no emotion that depends on which side moved, and ownership words kept to the
learner's own moments.
Every voice in the cast now has its own scoped wording.

The same pilot uses three generic opening-recognition phrases and eight phrases
for a verified consecutive run. Every phrase has a complete Walter and Rivet
version, selected by the same stable semantic ID used for whole recorded clips.
The entry phrases make no claim about being first; follow phrases require the
reviewed-prefix contract in [COACH_DIALOGUE.md](COACH_DIALOGUE.md). Recognition
does not prove move quality, development goals, familiarity or strategic intent.
Written opening names remain available without requiring a recording for every
name, and revisiting a position does not choose a fresh phrase.

These scoped tactical and opening-sequence forms are the starting point for a
new coach's writing pass. Build the personality with `coachPersonality()` and
give its file complete authored templates for both; do not copy the
older cast's repetitive continuation phrases as the quality target. This does
not authorize converting existing characters without their own writing review.

Required named slots must occur in the mandatory fragments. A question or reaction
cannot be the only place a move, target or reply appears. Positional alternatives
still render with explicit hypothetical scope. Opponent achievements still use
objective wording, not a learner-directed celebration. Runtime validation and the
corpus audit use the same claim contract; malformed custom forms safely fall back.

### Writing and reviewing changes

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

### Walter and Rivet quality gate

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
the same scope and character. Lessons receive only the generic `lessons` prompts
in `meanings.json`, not recorded course narration.

The Rivet [editorial](../frontend/src/audio/speech/banks/rivet/revisions/wording-v2.json)
and [distinct-voice](../frontend/src/audio/speech/banks/rivet/revisions/wording-v3.json)
ledgers explain each correction instead of making more clips the measure of
quality; Rivet's lines are his own readouts, never another coach's wording.
Compare them with [Walter's spoken revision](../frontend/src/audio/speech/bank/revisions/walter-language-v2.json)
and the active manifests in [Audio](AUDIO.md#bank-and-authoring). Avoid "separate"
and "separately" in active speech: the locked voices do not pronounce them
reliably. Recording, pronunciation, timing and listening review belong to the
[audio authoring process](AUDIO.md); a clean corpus test alone does not establish
that a recorded line sounds good.

### Focused verification

Run commands from `frontend` unless specified otherwise. These are writing and
speech-contract checks, not a replacement for the broader validation appropriate
to changed artwork, playback or account code. Close a running development server
on a test port before using its normal Playwright config; do not silently test a
different existing application.

```sh
npx playwright test dialogue-logic.spec.ts personality.spec.ts walter-dialogue.spec.ts scoped-dialogue.spec.ts opening-dialogue.spec.ts
npx playwright test --config playwright.intelligence.config.ts corpus.spec.ts causal-dialogue.spec.ts human-dialogue.spec.ts positional-dialogue.spec.ts walter-dialogue.spec.ts
npm run test:audio -- game-speech-maia-silence.spec.ts voice-registry.spec.ts recorded-coach-comparison.spec.ts
```

The first two commands cover production rendering and the writing laboratory;
the third checks that Maia readings are never voiced and protects the shared bank
interface.
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
