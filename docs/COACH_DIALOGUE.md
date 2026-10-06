# Evidence-led coach dialogue

For the complete creation workflow, start with
[Creating a coach](COACH_CREATION_GUIDE.md). This document owns the factual
presentation contract; [Character writing](COACH_PERSONALITIES.md) owns editorial
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
are not spoken or shown (owner decision, 2026-10-03).
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
drawbacks are left out, as is the better move's development or castling when the played
move did the same. Defender facts on a piece that is simply recaptured are left out on
any move. In speech, repeated-issue and saved-history lines only follow the sentence that
names the issue (a tactic, cause or mate clip); a move with no playable sentence speaks
its grade take instead. A second sentence never restates the lead: no capture clip after a
cause, hanging-piece or allowed-mate clip, and no stronger-alternative clip after a missed
tactic or mate. A forced-mate stage is told once per run of the same side's moves, and an
erosion run only on a move graded as an error. Takes rotate so that a side's back-to-back
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
the coach never speaks or shows a Maia reading in its line (owner decisions,
2026-10-02 and 2026-10-04). `gameIntent` adds Maia claims only when asked with
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
See [COACH_PERSONALITIES.md](COACH_PERSONALITIES.md) for the writing standards,
blind comparison and automatic corpus checks. Rare supported facts can still use
the complete neutral fallback; character wording never replaces chess evidence.

Walter and Rivet's on-screen tactical wording opt into `tacticalWording: "witness"`.
`eventClaims` attaches derived timing/effect metadata while retaining the original
claim codes, slots and source references. Only a sole matching line witness at
root ply 1 or the opponent's immediate reply at ply 2 supports direct timing;
the reference frame alone does not. Multi-ply or incomplete timing remains a
possible idea, without pretending the motif necessarily begins later. Current
facts do not imply that the move created a previously absent pin or fork.

`tacticalTemplates` selects one of 29 scoped presentation keys and typed slots
containing moves, motif names, targets and capture nouns. It does not construct
English setup or detail sentences. `scopedTacticalWording` supplies the neutral
required-slot contract and assembles static authored templates. Walter and Rivet
each author complete mandatory scope and effect sentences in
`characters/scopedTactics`; personality is not limited to an optional preface
around one shared factual sentence. Actual root effects can be factual; opponent
replies and unplayed alternatives remain prospective.
Targets on a possible future board are not described as already attacked. A
positive finite-line material delta is a possible gain dependent on follow-up,
not proof of a forced gain or a material lead. Character templates cannot discard
the required moves, replies or targets, or hide them only in optional cues.
All scoped tactical forms put the scope before its effects. Opponent facts use
the same scope without personal praise. The other 28 characters keep their
existing wording until their separate writing passes.
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

Walter and Rivet also opt into `openingWording: "sequence"`. An optional
`Claim.opening` comes from `openingPresentation`, while the original `book` or
`book_sound` code, opening-name slot, evidence, priority and source IDs remain
unchanged. `bookRecordingId` exposes the same 11 semantic variant IDs to written
and recorded dialogue: `book-opening-entry-1` through `-3`, and
`book-opening-follow-1` through `-8`. Each pilot voice authors its own complete
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
engine grades it poorly (owner decision, 2026-10-04). The engine grade stays in
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

Walter (`classic`, `storyteller.ts`) and Rivet (`robot`, `robot.ts`) are the current
production references for this complete path. Both use the scoped tactical and
opening-sequence contracts described above and have registered non-lesson voice
banks. Other characters retain safe written fallback and their existing authored
forms; a cast audition or saved provider voice does not mean a complete bank is
installed. Use the live coach and voice registries rather than assuming the two
pilot coaches are the entire cast or hard-coding their current recording count.

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

Owner decision (2026-10-03, "option 1"): the speech bubble shows what the coach
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
  Show why keeps the written detailed explanation. While the spoken line shows,
  a moves line beneath it carries the concrete facts from report/position data
  only: the opening name (`report.opening`), `<Side>’s strongest reply: <SAN>` (the engine's reply, never a claim about the move actually played) for a
  non-terminal position with an `immediate_reply`, and ", forced mate" only when an
  `allowed_mate` claim proves it. It wraps beside the Maia chip, outside the
  scrolling message; like any long line, a joined spoken line scrolls inside the
  fixed-height bubble (owner decision, 2026-10-03).
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
