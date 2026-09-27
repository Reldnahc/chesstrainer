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

## Personality boundary

Each family in the existing coach catalogue may register a `CoachPersonality`.
The selectable registry carries it into the existing account-selected coach;
there is no parallel identity list or new account setting. An omitted definition
uses the neutral personality. A partial or malformed custom template falls back
to the neutral rendering for that claim. New coaches therefore work safely before
their full writing is ready.

The renderer receives only `DialogueIntent` and a character definition. Curated
claim templates change sentence structure; character bibles define temperament,
teaching, rhythm, celebration, correction and boundaries. Compactness and neutral
delivery metadata are configurable. Priority, factual intensity, reaction meaning,
references and claims remain unchanged. No personality code can query an engine,
model or account from this interface. Named factual slots come from the shared
intent; render functions have no arbitrary callbacks.

`useDialogue` reads the existing account preference and renders synchronously.
Switching and reloading a selected coach changes language and portrait while
preserving stored reports. The laboratory's Voice selector renders the same intent
through any current registry entry or the neutral reference, with template-source
and deterministic variant provenance shown in the trace.
