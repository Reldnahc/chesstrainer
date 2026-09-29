# Evidence-led coach dialogue

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
and recoveries, then supported positional, human, clock and history observations.
Normal bubbles contain at most two whole claims within a 290-character target;
long legacy verified explanations retain their wording. An evaluation loss alone
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

In game review, `HumanInsight` presents the same selected claims beside Show why,
even when a more important objective claim occupies the bubble. Its compact Maia
line opens a native popover with selected-coach wording and source/domain notes.
It remains available during Show why, closes on position/evidence changes, and
does not change board or bubble dimensions. Native Escape/focus handling takes
precedence over review shortcuts while it is open. Unknown source/time control,
domain shift, missing ratings/history and incomplete policy retain uncertainty;
estimates are never presented as measured player success rates. Provider naming
falls back generically rather than calling a future provider Maia.

The popup is only a rendering of the existing intent and stored report. Changing
coaches keeps its intent/evidence identity and performs no extra engine/model
work. Cold SRS never renders this component. The intelligence laboratory can trace
the same human claims without a second inference or presentation rules engine.

Variant selection uses stable factual identity, including game/path/evidence,
never render time or analysis retry epoch. An utterance carries its intent ID,
selected template/variant, source IDs and selection decisions. It also provides
expression, intensity, priority, interruptibility, optional speech text and future
auto-speak suitability; there is no audio or TTS integration.

Claim priority ranks bubble content only. Since intent version 3, delivery
intensity and urgency derive from semantic reactions, with a supported forced-mate
override even when the move is recognized as Book. Routine opening recognition
remains quiet and interruptible; unavailable/thinking/cold feedback is unsuitable
for future automatic speech. This metadata does not change grades, portraits or
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
or character questions. Priority, reaction meaning, references and claims remain
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
