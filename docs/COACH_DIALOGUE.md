# Evidence-led coach dialogue

`frontend/src/dialogue` is a pure presentation boundary. The server supplies
versioned review events, practical evidence, context relationships and narratives.
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
with an objective error. Human-model wording refers to a model assessment, not a
calibrated percentage of Chess.com players. Cross-game references require supported
independent evidence. A branch cannot inherit recorded-game relationships.

`move-events-3` adds visible role-piece identities and exact witness plies to tactic
facts. `immediate_reply` projects the played line's first reply, not a best-line
answer. Targets being forked are distinguished from later captures. These facts
are coach independent, as are the Fieldwork labels and Stockfish scores.

Variant selection uses stable factual identity, including game/path/evidence,
never render time or analysis retry epoch. An utterance carries its intent ID,
selected template/variant, source IDs and selection decisions. It also provides
expression, intensity, priority, interruptibility, optional speech text and future
auto-speak suitability; there is no audio or TTS integration.

Regression coverage lives in `dialogue-logic.spec.ts`, game/coach/practice browser
suites and backend review-event tests. Developer diagnostics consume these same
pure functions rather than implement another dialogue pipeline.
