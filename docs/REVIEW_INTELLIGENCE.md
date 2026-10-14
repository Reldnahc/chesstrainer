# Review intelligence

Review intelligence turns saved Stockfish reports, optional [human move
evidence](HUMAN_MODELS.md) and the PGN into traceable semantic facts for
move-by-move coaching. The `review_intelligence` package derives facts only:
it never searches outside the bounded refinement pass, never grades, and never
stores coach prose. [Evidence-led coach dialogue](COACH_DIALOGUE.md) and
[character writing](COACH_PERSONALITIES.md) turn those facts into words.
Current schema and configuration live in [DATA_MODEL.md](DATA_MODEL.md) and
[CONFIGURATION.md](CONFIGURATION.md).

Review stays move-by-move. The owner retired Game Story / Critical Moments:
there is no ranked takeaway summary, key-moment navigation, opening/result story
prose or completion-driven coach reaction. Structured game context, diagnostic
turning points and owned history remain available for evidence-backed move
coaching and bounded refinement.


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
uses; per-query limits, threads and hash do not change, only wall-clock time
(about 26 s → 8 s per game on a 4-worker desktop). No new unbounded executor or
account-specific native pool is introduced.

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

Completed evidence is adopted only with the same engine, at least baseline depth
for the actual/best/root comparisons, and consistent best-versus-played ordering.
Budget exhaustion or unavailable/incompatible engines leaves the baseline usable.
An optional human-alternative query failure cannot discard a completed root
comparison. Diagnostics retain why an investigation was not adopted.

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

### Measured evidence and limits

```sh
python scripts/benchmark_refinement.py --stockfish /path/to/stockfish --output data/review-benchmark/refinement.json
python scripts/benchmark_refinement.py --stockfish /path/to/stockfish --targeted --output data/review-benchmark/refinement-targeted.json
```

The harness uses disposable databases and the production planner/search/report
reader. Outputs are exclusive-create under ignored data storage, never source.
Stockfish 18 on the M0 Windows host, default 16/0.8 baseline and 22/2 refinement:

- The original twelve-position synthetic corpus nominated four cases: allowed
  mate, missed mate, queen sacrifice and Bongcloud. All baseline grades survived;
  investigations took 2.343, 3.777, 3.928 and 3.121 seconds respectively. Stored
  baseline reports were byte-for-byte equivalent as decoded JSON. Wider/deeper
  lines can produce different supported motifs; this is not global ground truth.
- A targeted public Lichess probe (`C0OA7`) initially had Great / depth 16 with no
  supported sacrifice. The investigation reached depth 20, found removal of the
  defender, and tested `...Be3` followed by `fxe3`: Stockfish found mate in seven
  for Black. Fieldwork's existing sacrifice rule then supported Brilliant.
  Investigation took 2.344 seconds. This is a concrete explanatory improvement.
- The second public control (`6JpC8`) stayed Best and was not nominated because
  its baseline alternative gap was 77 cp, outside the critical-gap trigger.
  Deliberately investigating it during discovery produced a different gap/grade;
  bounded selection does **not** promise to find every such change.

Those two positions were selected from twelve hard positions in the existing
public CC0 puzzle snapshot, not a blind evaluation sample. Their provenance is
in `scripts/review_benchmark/refinement_cases.json`. These measurements establish
selected improvements and finite behavior, not a general accuracy percentage or
timing guarantee. Time-limited cold searches can vary across machines/runs.

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
| `critical_resource` | Only-good-at-depth, defensive versus decisive resource, practical difficulty | Safe best, losing searched runner-up, near-best played move, multiple legal moves; a good separately searched alternative disproves uniqueness |
| `sacrifice` | Sound offer and explicit acceptance response | Existing Fieldwork sacrifice witness and acceptance analysis ID, under 50 cp loss and no newly lost/allowed mate |
| `tactic` | Played, allowed, caused, missed or alternative motif in a verified line | Matching line root/first move, actor, valid witness plies and exact analysis/rule IDs; never attribute an alternative's tactic to the played move |
| `human_contrast` | Natural error, unusual strong find, unusual model best choice | Compatible saved human evidence plus objective references; carries conditioning, domain, unvalidated calibration and confidence |
| `clock_observation` | Low time, fast play with time, long think, accompanying evaluated error | Actual clock annotations/derivable values plus grading evidence; explicitly no psychological causation. Coaches do not voice or display it (retired 2026-10-03) |
| `opening_departure` | First unmatched move in the initial catalogue sequence | Versioned bundled book and exact mainline/PGN reference; means outside the catalogue, not a mistake |
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
than saying the opponent possesses the mover's error. Version 4 regenerates these
semantics from saved facts without rerunning Stockfish or Maia.

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
candidates. Move events (since `move-events-2`; currently `move-events-4`)
expose them as `positional` events. These are facts
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
| Piece support | Existing pin-aware effective-defender geometry gains/loses all support for a surviving non-pawn, non-king piece. An undefended piece is not necessarily capturable or lost. The coach mentions it only when the piece is attacked after the move (`attacked`); otherwise it is trivia (owner decision, 2026-10-04). |
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

`review_intelligence/difficulty.py` derives `practical-2` from saved Stockfish and
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

Version 2 also includes a separately searched played move when comparing
alternatives. If that move is different from the engine's first choice and also
holds the position, it disproves an only-good-move claim even if the unrestricted
MultiPV runner-up scored poorly. The same Stockfish-only comparison protects the
Fieldwork Great rule. A missing runner-up is still unknown, never proof of a sole
resource. Version 1's recorded benchmark below remains a historical measurement.

### Conservative bands and confidence

The initial fixed probe has 12 synthetic positions and four rating pairs:
600/800, 1200/1400, 1800/2000 and 2400/2600. It cannot calibrate population success
or justify five precise difficulty levels. We retain three descriptive bands.

An exact policy is **preferred** at rank 1–3 with at least 0.10 model probability;
**unusual** requires rank 7 or worse and below 0.03. Everything between is
plausible. These coarse gates were chosen after inspecting the fixed probe:
lower-quartile played probabilities were approximately 0.027, 0.047, 0.045 and
0.036 across its rating pairs. Combining rank and mass prevents low-rank choices
in diffuse policies from being called dominant, and avoids treating a rank just
outside top three as rare. This is a heuristic interpretation, **not an empirical
finding about player success**. Thresholds/version are explicit and boundary-tested.

Preferred best moves receive the natural band. Other modeled moves are
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

### Inspection results

Replaying the exact M0 deep Stockfish baseline and M1 pinned 79M policies gave:

| Self rating | Natural best finds | Challenging | Difficult | Unusual played moves |
|---|---:|---:|---:|---:|
| 600 | 8 | 3 | 1 | 3 |
| 1200 | 10 | 2 | 0 | 2 |
| 1800 | 10 | 2 | 0 | 1 |
| 2400 | 10 | 2 | 0 | 1 |

The queen offer is unusual at 600 (rank 7, probability 0.0202) with a verified
sacrifice, and model-preferred at 2400 (rank 2, 0.2968). The move allowing Fool's
Mate is preferred at 600 (rank 1, 0.2049), demonstrating **natural error**. The quiet
retreat Nb8 in the Ruy Lopez is unusual at 600 (rank 24, 0.00305) while retaining
nearly the same objective position; at 2400 it is rank 2 with 0.2998. Repeated-root
history changes policy markedly. These are synthetic model probes, not real
player data or validation that the model is calibrated on Chess.com.

Deterministic interpretations include natural error, unusual strong move,
natural near-best move, hard-to-find defensive resource, immediate mate missed
and forced reply. They describe observable/model-supported facts, never an
individual's thought process. Strong/poor move checks still use Stockfish loss
and mate types only. Human evidence does not influence the existing grading code.

### Reproduce and inspect

Generate the input artifacts using the baseline/feasibility commands in
[the review benchmark](#review-benchmark) and
[HUMAN_MODELS.md](HUMAN_MODELS.md#verification), then:

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
| Recovery | Same player's earlier error left a searched disadvantage/forced loss; a later near-best move restores at least a playable score. Intervening opponent errors are recorded, so dialogue cannot claim the recovering player created all the improvement. |
| Repeated motif | Same responsible player, supported tactical motif and role on different reviewed plies. Duplicate detectors do not inflate the count; a best-line alternative is excluded. Counts are explicitly among observed reviewed plies. |
| Advantage run | At least six contiguous reviewed plies stay at 200 cp or searched mate for one side. A completed review ending in that side's recorded win adds a conversion observation. This does not mean flawless play or a mathematically proved win. |
| Erosion | At least three 30–149 cp concessions by one side in a nine-ply window, with at least 150 cp net deterioration. Opponent errors that restore the position defeat the net-deterioration claim. |
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
history now share the same grouping and independent-game recurrence helper;
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
Stockfish searches can vary between fresh runs.

Initial measurement: Stockfish 18, Windows 11, Python 3.12.10, 24 logical CPUs,
one native thread and 64 MB hash per process, depth 16 / 0.8 seconds, no node cap.
Twelve positions took 4.319 s with one worker and 1.236 s with four (search and
evidence generation, excluding startup). Startup took 0.259 / 1.022 s; second
cached passes took 0.231 / 0.240 s and exactly retained candidate output. Each
configuration made 16 native searches and 20 cache hits across the two passes.
Python peak RSS was 82.9 / 84.7 MiB; this is not total host engine memory. These
small synthetic probes do not establish general speedups or evaluation quality.
