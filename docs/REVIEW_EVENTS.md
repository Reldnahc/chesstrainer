# Semantic review events and clock context

`review_intelligence/events.py` derives `move-events-1` from saved Stockfish
reports, practical assessment and optional recorded-mainline context. It neither
searches nor grades. The typed `intelligence` field is shared by full review,
progress updates and interactive analysis. It is diagnostic factual input for
dialogue and the developer laboratory; this checkpoint does not replace the
visible coach's existing prose yet.

Each event has a deterministic ID, actor, confidence, importance, structured
facts and evidence references (authority, ID, field and optional game ply).
Event identity depends on those facts and references, not selected coach,
explanation wording or unrelated model updates. The enclosing input digest also
tracks evidence generation and PGN context. Original saved reports/PGNs remain
the durable sources; reading semantics requires no migration or engine/model.

## Event families and evidence gates

| Family | Supported facts | Required evidence / abstention |
| --- | --- | --- |
| `mate` | Newly allowed or missed searched mate | Best/played Stockfish IDs and typed mate transition; already-forced loss is not a new error |
| `evaluation_change` | Concession, lost advantage, decisive transition | Saved best/actual scores; mate remains separate from cp |
| `critical_resource` | Only-good-at-depth, defensive versus decisive resource, practical difficulty | Safe best, losing searched runner-up, near-best played move, multiple legal moves; a good separately searched alternative disproves uniqueness |
| `sacrifice` | Sound offer and explicit acceptance response | Existing Fieldwork sacrifice witness and acceptance analysis ID, under 50 cp loss and no newly lost/allowed mate |
| `tactic` | Played, allowed, missed or alternative motif in a verified line | Matching line root/first move, actor, valid witness plies and exact analysis/rule IDs; never attribute an alternative's tactic to the played move |
| `human_contrast` | Natural error, unusual strong find, unusual model best choice | Compatible saved human evidence plus objective references; carries conditioning, domain, unvalidated calibration and confidence |
| `clock_observation` | Low time, fast play with time, long think, accompanying evaluated error | Actual clock annotations/derivable values plus grading evidence; explicitly no psychological causation |
| `opening_departure` | First unmatched move in the initial catalogue sequence | Versioned bundled book and exact mainline/PGN reference; means outside the catalogue, not a mistake |
| `check` | Giving check or answering check | Legally replayed actual move; checkmate supersedes generic check |
| `finish` | Immediate checkmate, stalemate, insufficient material | python-chess actual transition; never inferred from a mate PV or declared PGN result |

Advantages at ±200 cp and the balanced band ±100 cp are descriptive rule bands,
not mathematical win/draw proofs. Evaluation-change events require at least 100
cp loss or a band change. Critical defensive resources require the practical
assessment's stronger losing-alternative gate; an already-lost position does not
become a celebrated sole defense.

Tactical facts retain witness moves, frame indices, square roles and optional
prior-position context. Their `line_witness` confidence means **in this saved
continuation**. It does not establish that the game continued that way or that
the opponent had no defense. Supporting native defense references are retained
when present. The chosen coach cannot edit any of these facts.
The event actor is the side performing the witnessed action; for an allowed
opponent tactic that is the opponent, while the review frame still identifies
the player whose move allowed it. Context consumers must retain that distinction.

Recovery, exploitation of earlier errors, repeated motifs, conversion and game
conclusions require relationships across positions. Those belong to the planned
whole-game context layer, not invented memory in a move-local event.

## Clock rules

New game imports retain mainline comments (variations remain excluded). Earlier
versions stripped comments from `Game.pgn`; those already saved games correctly
have unknown clocks and are not silently reconstructed from unrelated sources.
Duplicate imports retain the existing canonical game, as before.
A single valid `[%clk H:MM:SS.s]` provides remaining
time after a move; a valid `[%emt H:MM:SS.s]` provides annotated elapsed time.
Duplicate, malformed, negative or out-of-range minute/second annotations abstain.
No annotations means unknown clock context, even when a TimeControl header exists.

For a standard-start game and a single sudden-death/increment control, initial
time is derivable. Later before-move time uses the same player's immediately
preceding remaining-time annotation, not the opponent's clock. Elapsed time is
`before + increment - after`, explicitly recording the post-increment convention.
A missing turn breaks the chain. Setup positions never inherit presumed initial
time. Unexpected clock increases or contradictory elapsed annotations suppress
derived time; literal valid remaining-time observations survive.

Staged/per-move controls, delays, unknown and malformed controls retain literal
clock observations but do not infer elapsed time from clock subtraction. An
explicit valid elapsed annotation remains useful. Fractions are preserved.

- Before/after bands: critical at ≤10 seconds, low at ≤30, otherwise ample.
- Fast-with-time: ≤2 seconds spent with at least 60 seconds remaining before.
- Long-think: ≥30 seconds spent and at least 15% of known remaining time; explicit
  elapsed observations without known remaining time can still meet the 30-second gate.
- These are explicit contextual heuristics, not a diagnosis of rushing, panic,
  concentration or why a mistake happened. Scores and grades never use clocks.
- When a human-policy result accompanies a known before-clock below 30 seconds,
  intelligence records that Maia's published training excluded that clock domain.

Mainline context is checked against the exact pre-move FEN and played UCI. An
arbitrary branch receives no recorded-game clocks or opening-departure claims.
Native engine evidence and model policy remain usable in branches independently.

## Verification

`test_review_events.py` exercises every family, both positive evidence and
abstention, identity stability, wrong actors/line roots, separately searched
alternatives, uncertainty and cold-SRS API protection. `test_review_clocks.py`
tests increment arithmetic, same-player clocks, missing turns, conflicting and
invalid annotations, staged/delay/unknown controls, setup positions and opening
departure. Existing native review, human-refresh, refinement, API and explanation
suites verify integration and coach independence. Cold review's explicit response
contract excludes intelligence, clocks, themes, alternatives and human hints.
