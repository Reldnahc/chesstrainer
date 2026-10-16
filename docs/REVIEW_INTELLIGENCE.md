# Review intelligence

Review intelligence turns saved Stockfish reports, optional [human move
evidence](#human-move-evidence) and the PGN into traceable semantic facts for
move-by-move coaching. The `review_intelligence` package derives facts only:
it never searches outside the bounded refinement pass, never grades, and never
stores coach prose. [Evidence-led coach dialogue](COACH_DIALOGUE.md) and
[character writing](COACH_DIALOGUE.md#character-writing) turn those facts into words.
Current schema and configuration live in [data model](ARCHITECTURE.md#data-model) and
[configuration](ADMINISTRATION.md#configuration).

Review is move-by-move: there is no ranked takeaway summary, key-moment
navigation, opening/result story prose or completion-driven coach reaction.
Structured game context, diagnostic turning points and owned history serve
evidence-backed move coaching and bounded refinement.

## Authority and storage

| Authority | Owns | Must not claim |
|---|---|---|
| python-chess | Legality, history, terminal board outcomes | Engine evaluation |
| Stockfish | Objective searched evaluation and candidate lines | Human population likelihood |
| Human provider | Rating-conditioned human move behavior with provenance | Objective evaluation or move-quality labels |
| Fieldwork rules | Grading and supported tactical/positional evidence | Unsupported causal stories |
| Review intelligence | Traceable semantic events and relationships | Pretend memory or unsupported psychology |
| Dialogue | Communication of validated intent | New chess facts |
| Coach personality | Wording and expressive presentation | Evidence, grading or model changes |

Full-game review already uses deep Stockfish on every move: MultiPV=2, plus a
restricted-root search when the played move is absent. Defaults are depth 16 and
0.8 seconds (either limit can end a search). Later targeted refinement is additive
until benchmarks justify replacing that baseline. SRS training and full-game
review retain distinct evidence/scheduling lifecycles and shared presentation.

Existing per-ply reports contain engine facts and legacy neutral compatibility
text. Coach-specific prose must not enter this storage. Changing the selected
coach must not run Stockfish, a human model, or context analysis. Cold SRS must
remain free of answer-revealing human, tactical or history hints.

## Targeted review investigation

Full-game review first saves the existing deep Stockfish analysis for **every
move**. A finite second phase investigates critical or uncertain positions. No
cheap survey replaces that baseline. Set `REVIEW_REFINEMENT_POSITIONS=0` to keep
the baseline alone; completed deeper evidence already saved remains available.

### Selection and budgets

Baseline facts nominate newly allowed/lost mate, large concessions, verified
sacrifices, narrow defensive resources, critical alternatives, unusual model
best moves, weakly explained concessions, grading boundaries and missed gains.
Priority is deterministic; ties use ply order. Only the baseline nominates work,
so a refined finding cannot trigger an unbounded recursive investigation.

| Variable | Default | Bounds / effect |
| --- | --- | --- |
| `REVIEW_REFINEMENT_POSITIONS` | 8 | 0–128 positions per game; 0 disables extra work |
| `REVIEW_REFINEMENT_QUERIES` | 4 | 2–8 total searches per position, including acceptance probes |
| `REVIEW_REFINEMENT_DEPTH` | 22 | 1–50 requested depth |
| `REVIEW_REFINEMENT_TIME` | 2 | >0–10 seconds per search |
| `REVIEW_REFINEMENT_MULTIPV` | 4 | 2–8 candidates for narrow resources, critical alternatives, sacrifices and human disagreement |

Ordinary severity/boundary checks use two root candidates. Wider searches answer
alternative questions; restricted searches compare the played move and sacrifice
acceptance. If budget remains, an uncovered top human candidate is compared too.
The worker does not rerun Maia. Model probabilities remain behavioral evidence.

The effective depth/time never fall below the saved baseline's requested profile;
extra searches have no node cap. At defaults the ceiling is 8 × 4 × 2 = **64
seconds of native search per game**, plus process/SQLite/evidence overhead and
shared-slot wait. A host with a baseline time over two seconds raises that ceiling
accordingly. Depth can finish a search early. This is a budget, not a latency
promise. Questions are independent, so they run in parallel on
min(STOCKFISH_WORKERS, ENGINE_SLOTS) engines, the same count the baseline pass
uses; per-query limits, threads and hash do not change, only wall-clock time.
There is no unbounded executor or account-specific native pool.

Pause interrupts an active extra search or a wait for a slot/cache lock. Startup
and engine teardown retain the native transport's bounded timeouts. Partial
search output is never cached. Already finished questions are saved immediately
and reused after cancellation or restart; no database transaction spans a search.

### Stored evidence and display

`GameReviewMove.report` retains baseline chess facts. Account-owned
`ReviewRefinement` records retain triggers, pinned Stockfish binary/version,
search profile, human configuration provenance, per-question cache references,
completion status and the investigated report. A finite plan on `GameReview`
records task IDs and progress. These contain no coach-specific dialogue.

Completed evidence is adopted only with the same engine and at least baseline
depth for the actual/best/root comparisons. A deeper report that finds the played
move stronger than its best is adopted too; presentation promotes the played
move, as it does for a baseline report.
Budget exhaustion or unavailable/incompatible engines leaves the baseline usable.
An optional human-alternative query failure cannot discard a completed root
comparison. Diagnostics retain why an investigation was not adopted.
Training reads the same effective report: a decision built before a refinement
was adopted (a later refine request) takes the deeper searches when the game's
review runs again, keeping its id, so its weakness labels follow the deeper
search; a decision that stops being a mistake drops them. When the review read the
played move from the root search's own lines, the decision compares it there too,
through a saved restricted view of that search (same limits, that move first),
never a new search at other limits. An exercise already made
from it keeps its answers and schedule (rewriting them would drop answers graded in
practice, and the same mistake in other games can share the exercise); only a
decision without one gets a new one from the deeper search. While the decision is
no longer a mistake its card is ineligible, so it leaves the Due queue and focused
practice and cannot be started directly, unless another meaningful decision shares
its position; a later search that makes it a mistake again puts the card back.

One effective-report reader supplies detail/progress, with equivalent batched
score selection for library accuracy. It checks task game/ply and original
analysis IDs. Preceding-move comparisons use the same effective score generation.
If refinement changes the best move, the saved complete human policy is projected
onto that move without native inference. Owner scoping applies to tasks and human
evidence; cross-account references are rejected on writes.

Monotonic report revisions let polls receive changes to **earlier** plies, including
the next move when its preceding-score comparison changes. Cursors advance only
over actual returned updates. Legacy `after=ply` remains available; current clients
use `after_revision`. The UI shows progress during baseline analysis, then hides
the progress panel while investigation runs in the background. Polling continues
to apply deeper findings without changing the selected position; review remains
playable during either phase. Interrupted or failed jobs still expose resume/retry
controls and errors.

Opening a completed legacy review without a refinement plan queues its one extra
pass when enabled. Reopening a completed compatible plan is idempotent. An explicit
`POST /api/games/{id}/review` with `{"refine":true}` plans against current host
settings and retries unavailable questions; this is also available to development
tools. Completed compatible questions are reused, not forcibly rerun. Changing
coach has no effect on this pipeline.

### Benchmark and limits

```sh
python scripts/benchmark_refinement.py --stockfish /path/to/stockfish --output data/review-benchmark/refinement.json
python scripts/benchmark_refinement.py --stockfish /path/to/stockfish --targeted --output data/review-benchmark/refinement-targeted.json
```

The harness uses disposable databases and the production planner/search/report
reader. Outputs are exclusive-create under ignored data storage, never source.
The `--targeted` cases are hand-picked hard positions from the public CC0 puzzle
snapshot, not a blind evaluation sample; their provenance is in
`scripts/review_benchmark/refinement_cases.json`. Wider/deeper lines can produce
different supported motifs, and bounded selection does **not** promise to find
every position where deeper search would change a grade. Results show finite
behavior on selected cases, not a general accuracy percentage or timing
guarantee. Time-limited cold searches can vary across machines/runs.

## Semantic review events and clock context

`review_intelligence/events.py` derives `move-events-4` from saved Stockfish
reports, practical assessment and optional recorded-mainline context. It neither
searches nor grades. The typed `intelligence` field is shared by full review,
progress updates and interactive analysis. It is diagnostic factual input for
dialogue and the developer laboratory, including the visible coach's supported claims.

Each event has a deterministic ID, actor, confidence, importance, structured
facts and evidence references (authority, ID, field and optional game ply).
Event identity depends on those facts and references, not selected coach,
explanation wording or unrelated model updates. The enclosing input digest also
tracks evidence generation and PGN context. Original saved reports/PGNs remain
the durable sources; reading semantics requires no migration or engine/model.

### Event families and evidence gates

| Family | Supported facts | Required evidence / abstention |
| --- | --- | --- |
| `mate` | Newly allowed or missed searched mate | Best/played Stockfish IDs, typed mate transition and `mate_in` (1 when the reply itself mates); already-forced loss is not a new error |
| `forced_mate` | A move inside a forced mate that neither allows nor misses it | Best/played Stockfish IDs; `stage` is `started` (the opponent's last move allowed it), `continued`, `slower` (a faster mate existed), `next` (mate on the mover's next move whatever the reply), `hastened` (already lost, mated sooner) or `held` (already lost, best defence); delivered mate stays a `finish` |
| `evaluation_change` | Concession, lost advantage, decisive transition | Saved best/actual scores; mate remains separate from cp |
| `critical_resource` | Only-good-at-depth, defensive versus decisive resource, practical difficulty | The Great badge's only-move rule: safe best, losing searched runner-up, near-best played move that itself holds at least -50 cp, multiple legal moves; a good separately searched alternative disproves uniqueness. "Decisive" from the review's winning band (+3.00 or a forced win) |
| `sacrifice` | Sound offer and explicit acceptance response | Existing Fieldwork sacrifice witness and acceptance analysis ID, under 50 cp loss and no newly lost/allowed mate |
| `tactic` | Played, allowed, caused, missed or alternative motif in a verified line | Matching line root/first move, actor, valid witness plies and exact analysis/rule IDs; never attribute an alternative's tactic to the played move |
| `human_contrast` | Natural error, unusual strong find, unusual model best choice | Compatible saved human evidence plus objective references; carries conditioning, domain, unvalidated calibration and confidence |
| `clock_observation` | Low time, fast play with time, long think, accompanying evaluated error | Actual clock annotations/derivable values plus grading evidence; explicitly no psychological causation. Coaches do not voice or display it |
| `opening_departure` | The move after the game's last catalogue move (`opening_book.book_run`); a gap the game later returns from by transposition is not a departure, and a game that ends in the catalogue has none | Versioned bundled book and exact mainline/PGN reference; means outside the catalogue, not a mistake |
| `check` | Giving check or answering check | Legally replayed actual move; checkmate supersedes generic check |
| `finish` | Immediate checkmate, stalemate, insufficient material | python-chess actual transition; never inferred from a mate PV or declared PGN result |
| `positional` | Immediate development, pawn, rook-file, support, king-flight and bishop-pair changes | Explicit geometry/history rules in [positional evidence](#positional-evidence); no strategic value inferred from an evaluation |

Advantages at ±200 cp and the balanced band ±100 cp are descriptive rule bands,
not mathematical win/draw proofs. Evaluation-change events require at least 100
cp loss or a band change. Critical defensive resources require the practical
assessment's stronger losing-alternative gate; an already-lost position does not
become a celebrated sole defense.

For `allowed`, the actor executes the opponent's tactic. For `caused`, the actor
is the mover responsible for abandoning a defender, ignoring a newly enabled
attack, or taking an unfavorable immediate exchange; `opportunity_actor` is the
opponent who can capture. These three causal rules require the actual poor-move
line, original `[1, 2]` witness and frame zero, with actor validation retained.
Material delta remains relative to the event actor, so a caused loss is negative.
Repeated motifs and historical weakness matching treat `caused` as
an issue for the responsible mover. Dialogue uses dedicated causal claims rather
than saying the opponent possesses the mover's error. These semantics regenerate
from saved facts without rerunning Stockfish or Maia.

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

### Clock rules

Game imports retain mainline comments (variations remain excluded). Games saved
before comments were retained have unknown clocks and are not reconstructed from
unrelated sources. Duplicate imports retain the existing canonical game.
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

### Verification

`test_review_events.py` exercises every family, both positive evidence and
abstention, identity stability, wrong actors/line roots, separately searched
alternatives, uncertainty and cold-SRS API protection. `test_review_clocks.py`
tests increment arithmetic, same-player clocks, missing turns, conflicting and
invalid annotations, staged/delay/unknown controls, setup positions and opening
departure. Existing native review, human-refresh, refinement, API and explanation
suites verify integration and coach independence. Cold review's explicit response
contract excludes intelligence, clocks, themes, alternatives and human hints.

## Positional evidence

`position-facts-1` derives immediate, legal board changes for played and best
candidates. Move events (`move-events-4`) expose them as `positional` events. These are facts
about the position, **not explanations inferred from an evaluation drop**.
Stockfish remains responsible for whether either candidate is good. The event
records `value_judgment: not_inferred`, side, before/after values, squares, line
and candidate UCI, with position/rule/search references. Development also
references the PGN history proving the original piece had not moved.

Supported observations:

| Feature | Evidence / limits |
| --- | --- |
| First development | Original knight/bishop leaves its home square, tracked from the standard starting position. Returning home never resets it. Setup games/branches without history abstain. |
| Castling | Legal king/rook relocation and adjacent own pawns; no claim that the resulting king is safe. |
| King flight squares | A pawn move opens an actually legal king destination for a back-rank king on the flank. Checks, castling, attacked squares and non-flank kings abstain. |
| Passed pawns | No enemy pawn ahead on the same or either adjacent file. Track the moving pawn's identity; ordinary advancement does not falsely create a new passer. Captures/en passant/promotion update the sets. |
| Passed-pawn advance | An already passed pawn advances without promotion. No assertion that it can queen. |
| Isolated pawns | No own pawn on either adjacent file, regardless of rank. No assertion that the pawn is weak or lost. |
| Doubled files | Two or more same-color pawns on a file. The coach names only files the move newly doubled (`added`); breaking up one doubled pair while another stays doubled is not a doubling claim. No automatic good/bad judgment. |
| Rook files | Own pawn absent means semi-open; all pawns absent means open. No guarantee of entry squares or control. |
| Piece support | Existing pin-aware effective-defender geometry gains/loses all support for a surviving non-pawn, non-king piece. An undefended piece is not necessarily capturable or lost. The coach mentions it only when the piece is attacked after the move (`attacked`); otherwise it is trivia. |
| Bishop pair | Loss of one of exactly two opposite-square-color bishops. Two same-color promoted bishops do not count. No claim that the exchange was unfavorable. |

The current rules deliberately omit bad bishops, backward pawns, outposts, space
advantages, general king-safety judgments and favorable simplification. Geometry
alone is insufficient for those strategic claims. Tactical causality continues
to require the existing verified-line detectors. A fact about a best-move
alternative never impersonates a move actually played in the game.

This layer performs no new search, changes no grading and saves no coach prose.
It is derived from saved report/PGN evidence, so old reviews gain supported facts
without reanalysis. `test_review_positions.py` covers each rule, negative
lookalikes, color symmetry, illegal inputs, branch abstention and invariance to
score/prose changes. Cold SRS still excludes all review-intelligence fields.

## Practical difficulty and human naturalness

`review_intelligence/difficulty.py` derives `practical-3` from saved Stockfish and
human evidence. It performs no search, changes no grades, and uses no coach
identity. Full-game and variation reports expose the same typed assessment.
Legacy Stockfish-only reports retain structural facts and explicitly abstain
from human interpretations. Cold SRS does not expose this payload.

### Separate questions

- **Played naturalness:** preferred, plausible, unusual, or unknown to the model.
- **Best-find difficulty:** natural, challenging, difficult, unknown, or a forced
  legal reply. This describes finding the engine's preferred move, not how hard
  it is to find *any* playable move, win the game, or what the player thought.
- **Objective pressure:** saved candidate separation, near-best candidate count
  lower bound, search coverage and a narrow defensive-resource flag.
- **Supported structure:** contiguous forcing prefix (up to six saved plies),
  supported finding horizon, verified sacrifice and typed mate transition.

The API's `acceptable_count_lower_bound` counts root candidates known to stay
within 50 cp without losing/allowing a mate. This is a near-best threshold, not a
claim that other moves are unplayable. Baseline MultiPV=2 does not enumerate every
acceptable choice; `alternatives_complete=false` and an explicit limitation
preserve that distinction. Missing runner-up evidence cannot establish an only
move. `only_good_move_at_depth` requires a nonlosing best move and a runner-up at
least 150 cp worse that reaches -150 cp or a losing mate. A missed forced win
while retaining +5 is **not** a sole defensive resource. These are bounded-search
and rule conclusions, not proof against perfect play.

A separately searched played move is included when comparing alternatives.
If that move is different from the engine's first choice and also
holds the position, it disproves an only-good-move claim even if the unrestricted
MultiPV runner-up scored poorly. The same Stockfish-only comparison protects the
Fieldwork Great rule. A missing runner-up is still unknown, never proof of a sole
resource.

### Conservative bands and confidence

The fixed probe has 12 synthetic positions and four rating pairs:
600/800, 1200/1400, 1800/2000 and 2400/2600. It cannot calibrate population success
or justify five precise difficulty levels, so there are three descriptive bands.

An exact policy is **preferred** at rank 1–3 with at least 0.10 model probability;
**unusual** requires rank 7 or worse and below 0.03. Everything between is
plausible. These coarse gates were set against the fixed probe's played-move
probabilities. Combining rank and mass prevents low-rank choices
in diffuse policies from being called dominant, and avoids treating a rank just
outside top three as rare. This is a heuristic interpretation, **not an empirical
finding about player success**. Thresholds/version are explicit and boundary-tested.

Preferred best moves, and any best move among the model's top three choices,
receive the natural band: a move the model ranks second at 9% is not a hard find,
nor is its top choice in a diffuse policy. Other modeled moves are
challenging; difficult additionally requires unusual model policy and an actual
supported tactical horizon of at least three plies, a verified sacrifice of that
best move, or the narrow defensive resource. Rarity alone cannot earn difficult.
A single legal reply is structural and never praised as a difficult discovery.
There is no exceptional band or fabricated numerical difficulty score.

Rank-only providers can identify their top choice, but unseen moves and absent
probabilities remain unknown. They cannot manufacture unusual-policy claims.
Related Lichess-blitz evidence is still heuristic and uncalibrated. Cross-platform
or unknown domains, missing rating fallbacks, unknown setup history, incomplete
policy, and ratings outside the probe range lower confidence further. Neither
confidence level licenses “X% of players at your rating.” The inspected ranges
are role-specific: 600–2400 for the mover, 800–2600 for the opponent. Even inside
those ranges the small synthetic probe establishes no population calibration.

Deterministic interpretations include natural error, unusual strong move,
natural near-best move, hard-to-find defensive resource, immediate mate missed
and forced reply. They describe observable/model-supported facts, never an
individual's thought process. Strong/poor move checks still use Stockfish loss
and mate types only. Human evidence does not influence the existing grading code.

### Reproduce and inspect

Generate the input artifacts using the baseline/feasibility commands in
[the review benchmark](#review-benchmark) and
[human model verification](#human-model-verification), then:

```sh
python scripts/benchmark_difficulty.py --stockfish-report data/review-benchmark/baseline-1.json --human-report data/maia-benchmark/79m-isolated.json --output data/review-benchmark/difficulty-NEW.json
```

This command runs offline without Torch. It validates corpus identity, complete
legal policy and provider method, records both input-file hashes, and retains
per-position/rating components, limitations and evidence references for developer
inspection. Output is ignored generated analysis data. The product payload has a
version and deterministic input digest. Persona or prose changes do not alter it.

The sample is deliberately small and synthetic. Broader calibration remains a
non-blocking research follow-up; uncertainty and fewer bands are part of the
production contract, not a claim that such validation already happened.

## Game context and supported relationships

`game-context-1` is a deterministic projection over the actual PGN and the current
effective Stockfish reports. Detail and revision polling share one presentation
function. The API returns a `context` containing one node per validated reviewed
ply, evidence references, missing plies, relationships, candidate turning points
and an input digest. It is derived, not stored prose or pretend conversation
memory. Reopening or changing coach needs no engine work. Refined reports replace
their baseline generation before this graph is built.

Relations are deliberately narrower than an unrestricted chess story:

| Relation | Evidence gate |
| --- | --- |
| Punishment | Adjacent actual moves; previous concession of 100 cp or a mate transition; a searched advantage/equalizing opportunity; next move either keeps that opportunity with less than 50 cp concession or loses its advantage/playable band. Partially using an opportunity is not called wholly missed. |
| Recovery | Same player's earlier error left a searched disadvantage/forced loss; a later near-best move restores at least a playable score. Intervening opponent errors are recorded, so dialogue cannot claim the recovering player created all the improvement. A move never raises its own evaluation, so the position was already playable before it: the coach writes a recovery in neutral words ("playable again") and plays no recovery take, whose lines credit this move. |
| Repeated motif | Same responsible player, supported tactical motif and role on different reviewed plies. Duplicate detectors do not inflate the count; a best-line alternative is excluded. Counts are explicitly among observed reviewed plies. The recorded repeated-issue clip ("once before", "a second time") plays only at `occurrence` 2; the written line names the count. |
| Advantage run | At least six contiguous reviewed plies stay at 200 cp or searched mate for one side. A completed review ending in that side's recorded win adds a conversion observation. This does not mean flawless play or a mathematically proved win. `own_error_plies` lists the side's own moves inside the run graded Inaccuracy or worse, and the coach tells a conversion only when it is empty (its takes say there was no slip). |
| Erosion | At least three 30–149 cp concessions by one side in a nine-ply window, with at least 150 cp net deterioration. Opponent errors that restore the position defeat the net-deterioration claim. `own_mistake_plies` lists the side's Mistake-sized moves from the first concession, concessions included; the coach tells an erosion only on an Inaccuracy and only when it is empty, because its takes call the concessions small and say no single big mistake did it. |
| Support restored | A concrete surviving piece loses effective support and later regains it. Track its moves; captures, castling ambiguity, missing review or changed actor break the link. This says nothing about why an eventual tactic worked. The coach mentions it only when the piece is attacked on the restoring move and that move is not graded Inaccuracy or worse, in place of the plain "gains a defender" fact. |

Contiguous score relationships stop at missing plies, invalid mainline contexts,
or adjacent searches disagreeing by more than 100 cp / on mate outcome. We do not
smooth disagreeing engine values into a fabricated consistent story. Repeated
observed motifs can still be linked across a gap, with their limited scope noted.

The four candidate turning points prioritize newly lost/allowed searched mates,
then largest per-move centipawn concessions, then earliest ply. Mate is not given
a fake centipawn value. `biggest_swing_ply` means largest **reviewed concession
under this ordering**, not a guarantee of the game's deepest causal moment.
Partial reviews and searched-advantage limits accompany the graph.

Recorded game results are distinguished from board-proven endings. A result
contradicting an automatic board ending cannot support conversion. Resignation,
timeout and draw agreement are not invented from a bare result header.

The graph contains no coach-specific text, additional model query or new table.
It remains two-sided; learner-specific relationship selection happens in the
[dialogue boundary](COACH_DIALOGUE.md), using the saved game's learner color,
not the selected mover or the board's temporary display orientation.
`test_game_context.py` covers multi-ply positive/negative stories and identity;
native review tests check detail/poll agreement and restart reuse. Later dialogue
can cite these links; current cold SRS never receives them.

The adjacent `history` projection uses [cross-game context](#cross-game-context)
to link relevant learner errors to supported evidence in other owned games.
It remains separate from within-game relationships and never claims training
caused improvement.

## Cross-game context

`cross-game-1` adds corroboration for a learner's supported missed/allowed tactical
motifs and mate errors in the currently reviewed game. It reads the existing
account-owned active `SkillEvidence`/`Decision` projection. Weaknesses and review
history share the same grouping and independent-game recurrence helper;
there is no second weakness database or competing threshold.

The game being reviewed is excluded. One other game containing many related
mistakes is still one independent sample. The host's existing
`MIN_INDEPENDENT_GAMES` (default 2) determines provisional versus supported
recurrence. Provisional evidence is available to diagnostics, but must never be
presented as an established habit. Inactive/superseded classification evidence is
excluded. Opponent mistakes and the learner's successful tactics do not become
claims about the learner's weakness.

Each item includes the controlled skill/title, support state, independent-game
and occurrence counts, matching current plies and owned evidence/decision/game
references. The digest includes account, current context generation, threshold
and source evidence. No character text is saved. Reclassification changes the
projection on the next read without re-running Stockfish or Maia.

`scope: other_saved_games` is deliberate: imported history may be incomplete,
undated, or contain games later than the game being reviewed. Do not describe
these as a chronological trend or say "you always do this." SRS retention is a
separate existing metric and is not evidence that training caused improvement
in subsequent games. No training-transfer claim is produced here.

Queries use the same ownership-enforcing ORM sessions as other private data.
Only relevant motifs are fetched, in one ordered query; no per-skill practice
queries or engine work occur during review. New users and users who have only
used game review receive an empty history until actual classified evidence
exists. Viewing a review does not create Decisions, exercises or FSRS recalls.

`test_cross_game_context.py` verifies support boundaries, current-game exclusion,
duplicate positions, active projection changes, player role and cross-account
isolation. These hints remain absent from cold-SRS responses.

## Review intelligence laboratory

Run `npm run dev:intelligence` from `frontend`, then visit
`http://127.0.0.1:5175`. This is a separate loopback-only Vite process, like the
coach studio (`npm run dev:coach`) on 5174. It has no API proxy, account session, database connection,
engine or model. The production entry point does not import it; `/intelligence-lab`
is not a product route. It is not packaged into production JavaScript.

In your authenticated application browser, save the JSON response for
`GET /api/games/{id}` (the Network panel shows this request when opening a game).
Open that file in the laboratory, or paste the response. Use the completed game
response to include final refinement and context. Files are read into
browser memory only, not uploaded or saved to web storage. Keep private exports
in ignored `data/` and out of Git. Inputs over 20 MB or 5,000 frames are rejected.
Unsupported evidence versions ask for a fresh export; invalid input preserves the
last successfully inspected document.

Select a ply to see the exact production neutral intent and deterministic variant,
beside its board. Inspect expandable sections for:

- Stockfish candidates, scores, search IDs, depth, grade, reason and witness lines;
- human model provenance, conditioning, source domain and policy/rank evidence;
- practical difficulty components and calibration caveats;
- semantic tactical/positional events, direct evidence and clock observations;
- game relationships, turning points, relevant cross-game corroboration;
- selected dialogue claims, rejected/limited evidence decisions and final utterance.

Show Why uses the same board-cue wording as production. Suppressing recorded-game
context demonstrates the branch boundary; it does not create or analyze a branch.
The laboratory uses the same game/path seed as production mainline review. It
never decides legality, quality or human probabilities itself.
The Voice selector draws directly from the selectable coach registry and keeps a
neutral reference. Changing it rerenders the same intent locally; the utterance
trace identifies each custom or neutral fallback template.
The initial writing section provides synthetic examples for every dialogue purpose,
all current voices, character bibles, deterministic variants and shuffled blind
comparison. A real imported intent can also be compared across the cast. Corpus
errors and writing collisions appear locally in the viewer and fail its tests.

**Compare ten shared situations together** gives every voice the same set of
blunder, tactic, Maia-supported natural mistake, difficult best move, recovery,
missed opportunity, quiet development, forced defense, checkmate and retry inputs.
Blind mode keeps its shuffled voice numbering stable across scenarios and samples;
names, portraits and strategy labels remain hidden until the notes are opened.
This allows several responses to be judged as one voice instead of treating one
unusual synonym as a personality. These exercises are synthetic, clearly labeled
writing inputs, not claims about measured player behavior.

The coverage audit shows samples, character claims, neutral fallback claims and
composed forms for each registered coach. Common primary claims must have custom
handling; exact actor/line-scope safety still deliberately uses neutral or protected
conditional rendering when required. Identical short factual sentences are allowed.
An entire identical cross-scenario corpus is reported as a collision. Behavior
tests verify strategy execution, deterministic question selection, mandatory-slot
protection, cold feedback, and unchanged semantic delivery and provenance.

`npx playwright test --config playwright.intelligence.config.ts` tests import,
malformed/versioned data, deterministic production parity, mobile layout, no API
requests and exclusion from built assets. The suite is included in CI.

## Review benchmark

Run from the repository root with the existing Python environment:

```sh
python scripts/benchmark_review.py
python scripts/benchmark_review.py --stockfish /path/to/stockfish --workers 1 --repeats 2 --output data/review-benchmark/baseline-1.json
python scripts/benchmark_review.py --stockfish /path/to/stockfish --workers 4 --repeats 2 --output data/review-benchmark/baseline-4.json
```

The first command validates/prints the synthetic corpus without an engine. The
others call the production `analyze_move` using a disposable migrated database.
Outputs are created exclusively (no overwrite) and belong under ignored `data/`.
The benchmark records machine/runtime, corpus hash, binary hash, search settings,
process startup, cold review throughput, repeated cached latency, cache equality,
typed evaluations, qualities across four conditioning ratings and Python peak RSS.
The memory field explicitly excludes the native engine processes.

`scripts/review_benchmark/corpus.json` is synthetic, versioned and legal from the
recorded root through the full move history. It includes both colors, opening and
quiet play, attack, mate/missed mate, a queen offer, exchanges, repetition and
three source-domain contexts. These are diagnostic probes, not a calibrated human
study or comprehensive chess-quality ground truth. In particular, matching cached
results does not establish independent cold-search determinism. Time-bounded
Stockfish searches can vary between fresh runs. These small synthetic probes do
not establish general speedups or evaluation quality.

## Human move evidence

Fieldwork can run a pinned Maia-3 **79M** policy model alongside Stockfish. It
describes human-like choices; it does not evaluate chess truth or assign grades.
The supported checkpoint has an explicit AGPLv3 declaration. Smaller research
models remain unsupported until their weight licensing is clarified; see
[Pinned upstream and terms](#pinned-upstream-and-terms).

### Explicit setup

The Docker image includes the CPU runtime, but **no weights**. Normal startup,
signup, browsing and review never download a model. Review remains usable with
Stockfish alone. To opt into model evidence, run once on the host:

```sh
docker exec fieldwork python -m trainer.human_models.setup
docker exec fieldwork python -m trainer.human_models.setup --verify-only
```

In Unraid use the container Console and omit `docker exec fieldwork`. The setup
command acquires the pinned 316 MB checkpoint into `/data/models/maia3-79m.pt`,
checks size and SHA-256, and atomically publishes it. Keep `/data` on persistent
storage. A verified existing file is reused with no network. A corrupt existing
file is rejected, never silently replaced. An administrator can move that file
aside and run setup again. Model files are reproducible assets; private games,
reviews and preferences remain in the single SQLite database.

For a source installation, activate the application's Python environment:

```sh
python -m pip install --no-deps torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu
python -m pip install -c requirements.lock -c requirements-human-cpu.lock -e '.[human]'
python -m trainer.human_models.setup
```

Source installs default to `data/models/maia3-79m.pt`; `HUMAN_MODEL_PATH` overrides
it. Setup needs HTTPS access to the pinned Hugging Face repository. Once cached,
inference and saved reviews work offline. To provision an offline host, run setup
on a connected installation, transfer the verified file, and run `--verify-only`.

### Resources and readiness

`HUMAN_MODEL_ENABLED=true` permits inference when the file/runtime exist; `false`
disables new inference. Defaults are CPU, two threads and **one resident worker
for the entire host**, shared by all accounts. No process or Torch memory is
allocated at application startup; first inference verifies and loads the file.
Expect roughly 0.85 GB peak process memory and tens of milliseconds of warm
policy latency for 79M on CPU; hardware and thread budgets matter. The CPU image
is roughly 1.6 GB on disk; checkpoint storage is additional. A whole container
reviewing with Stockfish, Maia and refinement can peak around 1.3 GiB including
child processes and filesystem cache. A resident worker, engine counts, parallel
reviews and other host workloads change these figures; they are not guarantees.
The large CPU dependency layer is cached separately from application changes.

`HUMAN_MODEL_WORKERS` (1–4) multiplies model memory; `HUMAN_MODEL_THREADS` (1–16)
sets threads per worker. Budget these alongside Stockfish. A bounded queue and
`HUMAN_MODEL_TIMEOUT` (30 seconds, 1–120) cover slot waits and worker I/O/inference.
Cancellation terminates the affected worker and releases its slot. Failures use
a 60-second retry cooldown, preserve completed Stockfish reports, and expose a
generic unavailable status. Shutdown reaps all children and transport threads.

Authenticated `GET /api/human-model` reports disabled, not configured, unchecked,
ready or unavailable separately from Stockfish health. It performs no download,
hashing, inference or Torch import. Completed game reviews can acquire missing or
outdated human evidence on reopening without rerunning their Stockfish baseline.
Cached evidence remains readable if the model is later unavailable.

Optional CUDA requires a compatible Torch 2.8.0 CUDA runtime, host GPU support and
`HUMAN_MODEL_DEVICE=cuda`. The image ships only the CPU Torch build. In Docker,
give the container the GPU (see the commented `deploy` block in `compose.yaml`;
the host needs the NVIDIA Container Toolkit) and set `HUMAN_MODEL_DEVICE=cuda`. On
its first start with that setting, the entrypoint downloads Torch 2.8.0 for CUDA
12.8 (about 3 GB to download, 6.4 GB on disk, at the image's locked dependency versions) into
`/data/runtime/torch-2.8.0-cu128` and puts it ahead of the CPU build; later starts
reuse it. CPU containers download nothing. Outside Docker, install the CUDA Torch
wheel yourself; do not apply the CPU Torch pin to that environment.

On a GPU, a game review sends all of its positions to Maia in batches of 32 before
the Stockfish pass. On CPU the forward pass itself is the cost, so reviews score
move by move alongside the Stockfish searches. Device and
runtime identity invalidate inference caches. CPU is fully supported; there is
no automatic GPU requirement or silent CPU/GPU switch.

### Pinned upstream and terms

Inference code is [CSSLab/maia3, commit 1e13597](https://github.com/CSSLab/maia3/tree/1e13597c42d4858b7cfd7cfdae01e297263364b2),
AGPL-3.0. Model revisions, filenames, byte counts and SHA-256 digests are in
`backend/trainer/human_models/manifest.json`. The
[79M model card](https://huggingface.co/UofTCSSLab/Maia3-79M/blob/a107d6ceb7b298cb04ae1da4edffe2939858b894/README.md)
explicitly declares AGPLv3. The 5M and 23M cards label only the *paper* CC BY 4.0,
which must not be assigned to the weights, and
[upstream issue 12](https://github.com/CSSLab/maia3/issues/12) asking for
clarification had no answer when checked. So 79M is the only supported preset;
do not publish the smaller weights or the separately hosted ONNX file, whose
conversion provenance is unresolved in the same issue.

The [paper](https://arxiv.org/html/2605.19091v1#S4.SS1) trained on Lichess blitz,
dropping moves once a clock fell below 30 seconds, and reports 57.1% move-matching
accuracy for 79M on its own evaluation set. That is a published aggregate, not
Fieldwork calibration.

Fieldwork uses a narrow pinned policy adapter in a worker rather than Maia's UCI
engine (rank-only, no move probabilities) or upstream `score_moves` (which pulls
Torch and global thread settings into the calling process). The native
feasibility tests check the adapter against UCI top-20 ranks and upstream policy
values (within 1e-7). That establishes fidelity, not population calibration.

### Evidence and ownership

`HumanModels` is the host service; its provider-neutral versioned contracts live
in `trainer/human_models/types.py`. `MaiaProvider` owns bounded subprocess leases.
Only its child imports Torch and the unmodified pinned inference primitives in
`trainer/_vendor/maia3`. The narrow adapter performs one forward pass and a
complete legal-move softmax, with original history tokenization and color
mirroring. It does not read Maia's WDL/cp outputs. Strict tensor-only checkpoint
loading, code hashes, model hashes and typed policies are checked before use.

The shared `human_analyses` table stores full policy facts and requests. It has
no owner, like the Stockfish cache: when two members import the same game, the
second review reuses the first one's predictions. Rows nothing references are
swept at startup once they are 30 days old, and `scripts/clear_games.py` keeps
rows anything left in the database still references
(see [ARCHITECTURE.md](ARCHITECTURE.md)).
Cache identity covers full root/history/final position, mover, both actual PGN
ratings or explicit fallbacks, source/time-control domain, provider, model and
checkpoint revision, adapter revision, device, precision, Torch version, thread
count and deterministic inference settings. Worker count does not invalidate it.
Game reports reference the row and project played/best rank/probability, top five
moves, normalized entropy and top-three mass. Changing a Stockfish best move can
reuse the full distribution. Future rank-only providers may omit probabilities;
unknown values are never manufactured from rank or WDL.

Both players are conditioned separately. Maia's published domain is Lichess
blitz; Chess.com games, other speeds, missing metadata and setup-position history
are explicitly identified. Even a related-domain result is **uncalibrated**.
Policy probabilities are model outputs, never measured percentages of comparable
players. Coach selection is absent from request/cache/evidence identity.
Cold SRS schemas exclude human hints. The next layer derives
[practical difficulty and naturalness](REVIEW_INTELLIGENCE.md#practical-difficulty-and-human-naturalness) from these facts;
it still changes neither objective grades nor personality dialogue.

### Human model verification

Ordinary pytest uses synthetic legal policies and real bounded transport workers,
covering cache invalidation, domain/rating history, account isolation, restart,
rank-only contracts, cancellation, corrupt/missing data, blocked pipe writes and
Stockfish-only fallback. Native opt-in tests use `MAIA_CHECKPOINT_DIR` (the folder
containing `maia3-79m.pt`), and optionally `MAIA_TEST_DEVICE=cuda`. They exercise
the production worker with special moves and full history. No test downloads
weights implicitly. See [TESTING.md](TESTING.md).

The research benchmark compares methods and model sizes. It never acquires models:
download the official checkpoints at the manifest revisions, verify their hashes
and set `HF_HUB_OFFLINE=1`, then:

```sh
python scripts/benchmark_maia.py --model 79m --checkpoints data/maia-benchmark/models --method isolated --output data/maia-benchmark/79m-isolated.json
MAIA_CHECKPOINT_DIR=data/maia-benchmark/models python -m pytest -q backend/tests/test_maia_feasibility.py
```

Methods are `uci`, `direct`, `policy` and `isolated`; sizes are `5m`, `23m` and
`79m`. `MAIA_TEST_MODEL=79m` selects the supported preset for native tests, and
`--device cuda --method policy` measures a GPU in a matching CUDA environment.
