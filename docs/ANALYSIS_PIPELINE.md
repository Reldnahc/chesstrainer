# Analysis pipeline

Chess.com is an optional upstream source. A background job fetches validated public archive URLs serially, filters completed standard games by time class/range/limit, and passes the original PGNs to the importer below. Each archive commits with a checkpoint, preserving partial imports on cancellation or failure. Username is checked in API metadata and PGN headers. After downloading, the same job analyzes linked learner games. See [CHESSCOM_IMPORT.md](CHESSCOM_IMPORT.md).

## Import
Python-chess parses each UTF-8 PGN. Original uploads remain in game_imports; games retain normalized mainlines and learner color; import_games preserves repeated-upload provenance. Names must match exactly one player (case-insensitively), or the importer explicitly assigns the whole batch's side. Ambiguous/invalid games are reported and skipped without discarding subsequent valid games. Only standard chess is supported.

Fingerprints include selected identifying headers, initial FEN, mainline UCI moves and learner color. Comments do not create duplicates; separately dated/site-stamped games remain independent. This is practical deduplication, not universal cross-provider identity.

Imports retain all processed provenance links but queue only newly inserted games (`import_games.is_new`). Re-uploading saved games therefore does not revisit their Stockfish/local-classification pipeline. A duplicate-only PGN upload creates no job; a duplicate-only Chess.com fetch completes with zero analysis games. Retry the original job to finish interrupted older analysis/classification. Classification retries scan saved decisions and reuse compatible completed local rule results; progress can recount saved decisions without rerunning compatible local classification.

## Two passes
For each learner decision, search the pre-move board normally and again with root_moves restricted to the actual move. Both scores use the learner's perspective at the same root. The actual-move score means the evaluation conditioned on playing that move, not a raw White-perspective child score.

Triage defaults: depth 10 OR 0.15 seconds, whichever comes first. Optional nodes add another bound. Mate transitions or loss >=70% of the mistake threshold trigger depth 16 OR 0.8 seconds with MultiPV 4 plus a restricted actual-move search. Only confirmed policy failures become meaningful mistakes. Time-limited engine scores remain estimates.

Every decision commits before classification. FEN, game/ply reconstruction, played SAN/UCI, engine result IDs, explicit losses and deterministic facts remain available. Candidates retain scores, reached depth and PV; each PV is legally replayed before saving. Facts distinguish geometric attacks from tactical proof: an attacked undefended piece is not automatically labeled hanging. Material values are 1/3/3/5/9. Phase is a simple documented heuristic.

## Scores and policy
Score stores kind cp/mate, signed value and mate_given for positive terminal mate-zero. Values are root-decision-maker relative. CP loss is max(0,best-played). Mate is never flattened to an arbitrary CP number: losing a winning mate and newly allowing losing mate are separate flags. Winning mate lengths can be interchangeable; already forced-lost positions do not generate artificial mate-length exercises.

Policies snapshot version, mode and tolerances into exercises. best_only requires primary; engine_tolerance/custom use TOLERANCE_CP; practical uses PRACTICAL_TOLERANCE_CP. Default practical tolerance is 100 cp; significant failure is 150 cp. Between thresholds is inaccuracy, currently mapped to failed recall. Target rating affects weakness prioritization, not engine evaluation or these acceptance thresholds.

MultiPV supplies stored primary and accepted alternatives. Unlisted legal moves require local verification before judgment; engine unavailability returns 503 without recording failure. Saved manual answers use curated membership and bypass Stockfish; repertoire exercises are archived and unavailable for review.

## Identity/cache/lifecycle
Training keys preserve placement, turn, castling rights and legal en passant, ignoring clocks. Engine keys additionally include full FEN clocks, root board, full UCI history, engine identity, binary SHA256, threads/hash, depth/time/nodes, MultiPV, root restrictions and adapter version. Draw/repetition context is never discarded.

Each configured worker owns a serialized local native engine. A separate serialized engine handles interactive unknown answers. Defaults are one thread and 64 MB per engine; peak resources include workers plus interactive engine. Compatible cached results persist across restart. Crashes close the engine and fail the job while preserving completed decisions; retry starts a fresh process.

SQLite jobs persist queued/running/completed/failed/cancelled states and game/decision/deep/mistake/classification counters. One coordinator processes jobs in queue order, using STOCKFISH_WORKERS parallel game tasks within each analysis job and CLASSIFICATION_WORKERS parallel classification tasks. Startup returns running jobs to queued; replay skips committed decisions and reuses engine/rule caches. Atomic counters are recomputed as saved decisions are revisited. A game completes after its analysis and submitted classifications settle. Cancellation stops queued/new tasks and drains in-flight work before recording final status. One server process is required.

Local classification runs after meaningful engine evidence commits. It replays saved best/actual candidates and emits only supported motifs with witness moves/squares. Completed classified and unclassified runs are cached by evidence, rules, parameters and taxonomy. Failures are retryable; rejected identical runs are not automatically revived. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md).

The local classification stage has a separate bounded queue so rule processing overlaps with engine work, including multiple decisions from one game. A full queue applies backpressure. No SQLAlchemy session is shared across threads, and rule computation runs outside the short application write lock. Classification-only jobs read saved decisions directly and launch no background Stockfish processes. Identical simultaneous engine cache requests share a fixed-size striped lock registry, avoiding redundant UCI searches without unbounded lock memory.

On-demand answers reuse the exercise analysis limits/resources and require the same binary hash/version. Incompatible executables cannot silently mix scores or create recall failures. Engine adapter cache version is 2.

Imports and classification backfills no longer refresh courses automatically. Backfills neither create exercises nor change enrollment/SRS. Existing courses are archived and their product routes return 410. New game imports still create ordinary review exercises from meaningful engine decisions.

## Review explanations

Each new legal review attempt is linked by ReviewSession.last_attempt_id. The explanation endpoint chooses the ExerciseAnswer candidate whose UCI matches that attempt; accepted alternatives use their own PV. Unknown legal game answers already receive compatible root-move analysis during grading. Explanation playback itself performs no extra engine search or model call. Every frame is replayed by python-chess from the source game decision, preserving its history; cached analysis must match the position. Captures (including en passant), castling, promotion, check and checkmate captions are deterministic. Material-change summaries describe the shown continuation, not a guarantee that every reply is forced. Mate claims use explicit learner-perspective Stockfish mate scores. Quiet positions may have no simple verified tactical explanation; show the continuation with that limitation. Manual-exercise mismatches identify saved-answer membership without claiming objective inferiority.

## Optional evidence enrichment

Rules v3.1 inspect an initial 16 plies and extend forward by at most 16 saved plies when unfinished. They accept meaningful relative pawn/exchange outcomes. The selected endpoint must be quiet; a favorable earlier prefix cannot replace an unsettled endpoint. Absolute scores no longer suppress material loss while already ahead. Motifs remain concrete legal witnesses, not inferred causes of every evaluation drop. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for exact gates.

POST /api/classifications/enrich queues at most CLASSIFICATION_PROBE_POSITIONS selected decisions (default 40). Concrete pending defensive questions rank first, then unknown outcomes and unclear mechanisms, retaining severity/recency order. A persisted classification_tasks list freezes the job budget. Existing engine workers refresh best/actual root searches, then use the remaining CLASSIFICATION_PROBE_QUERIES budget for unfinished tails and legal defensive hypotheses. Every native result is cached; supplement and query links commit together after the bounded work. Original decisions/exercise answers remain unchanged. Cancellation retains completed searches and links, retries resume the selected tasks, and later jobs skip identical completed probe keys. A changed binary or probe configuration cannot be silently stored under a previously planned key.

POST /api/classifications/retry still processes saved evidence without Stockfish. Both labeled and abstained results are cached. Outcomes, witness roles/cues, previous-move context, endpoint diagnostics, defensive-query provenance and abstention reasons are stored in immutable response schema v3. API coverage counts distinct meaningful decisions rather than historical run totals. All work remains local.
