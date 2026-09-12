# Analysis pipeline

Chess.com is an optional upstream source. A background job fetches validated public archive URLs serially, filters completed standard games by time class/range/limit, and passes the original PGNs to the importer below. Each archive commits with a checkpoint, preserving partial imports on cancellation or failure. Username is checked in API metadata and PGN headers. After downloading, the same job analyzes linked learner games. See CHESSCOM_IMPORT.md.

## Import
Python-chess parses each UTF-8 PGN. Original uploads remain in game_imports; games retain normalized mainlines and learner color; import_games preserves repeated-upload provenance. Names must match exactly one player (case-insensitively), or the importer explicitly assigns the whole batch's side. Ambiguous/invalid games are reported and skipped without discarding subsequent valid games. Only standard chess is supported.

Fingerprints include selected identifying headers, initial FEN, mainline UCI moves and learner color. Comments do not create duplicates; separately dated/site-stamped games remain independent. This is practical deduplication, not universal cross-provider identity.

Imports retain all processed provenance links but queue only newly inserted games (`import_games.is_new`). Re-uploading saved games therefore does not revisit their Stockfish/LLM pipeline. A duplicate-only PGN upload creates no job; a duplicate-only Chess.com fetch completes with zero analysis games. Retry the original job to finish interrupted older analysis/classification. Classification retries scan saved decisions and reuse compatible completed LLM results; local progress recounting is not repeated paid work.

## Two passes
For each learner decision, search the pre-move board normally and again with root_moves restricted to the actual move. Both scores use the learner's perspective at the same root. The actual-move score means the evaluation conditioned on playing that move, not a raw White-perspective child score.

Triage defaults: depth 10 OR 0.15 seconds, whichever comes first. Optional nodes add another bound. Mate transitions or loss >=70% of the mistake threshold trigger depth 16 OR 0.8 seconds with MultiPV 4 plus a restricted actual-move search. Only confirmed policy failures become meaningful mistakes. Time-limited engine scores remain estimates.

Every decision commits before classification. FEN, game/ply reconstruction, played SAN/UCI, engine result IDs, explicit losses and deterministic facts remain available. Candidates retain scores, reached depth and PV; each PV is legally replayed before saving. Facts distinguish geometric attacks from tactical proof: an attacked undefended piece is not automatically labeled hanging. Material values are 1/3/3/5/9. Phase is a simple documented heuristic.

## Scores and policy
Score stores kind cp/mate, signed value and mate_given for positive terminal mate-zero. Values are root-decision-maker relative. CP loss is max(0,best-played). Mate is never flattened to an arbitrary CP number: losing a winning mate and newly allowing losing mate are separate flags. Winning mate lengths can be interchangeable; already forced-lost positions do not generate artificial mate-length lessons.

Policies snapshot version, mode and tolerances into exercises. best_only requires primary; engine_tolerance/custom use TOLERANCE_CP; practical uses PRACTICAL_TOLERANCE_CP. Default practical tolerance is 100 cp; significant failure is 150 cp. Between thresholds is inaccuracy, currently mapped to failed recall. Target rating affects teaching priorities only.

MultiPV supplies stored primary and accepted alternatives. Unlisted legal moves require local verification before judgment; engine unavailability returns 503 without recording failure. Curated answers bypass Stockfish.

## Identity/cache/lifecycle
Training keys preserve placement, turn, castling rights and legal en passant, ignoring clocks. Engine keys additionally include full FEN clocks, root board, full UCI history, engine identity, binary SHA256, threads/hash, depth/time/nodes, MultiPV, root restrictions and adapter version. Draw/repetition context is never discarded.

Each configured worker owns a serialized local native engine. A separate serialized engine handles interactive unknown answers. Defaults are one thread and 64 MB per engine; peak resources include workers plus interactive engine. Compatible cached results persist across restart. Crashes close the engine and fail the job while preserving completed decisions; retry starts a fresh process.

SQLite jobs persist queued/running/completed/failed/cancelled states and game/decision/deep/mistake/classification counters. One coordinator processes jobs in queue order, using STOCKFISH_WORKERS parallel game tasks within each analysis job and LLM_WORKERS parallel classification tasks. Startup returns running jobs to queued; replay skips committed decisions and reuses engine/model caches. Atomic counters are recomputed as saved decisions are revisited. A game completes after its analysis and submitted classifications settle. Cancellation stops queued/new tasks and drains in-flight work before recording final status. One server process is required.

OpenAI runs only after meaningful objective evidence commits. Versioned successful classifications are cached; failures remain retryable. REST polling every two seconds is sufficient; no WebSocket/broker is required.

The OpenAI stage has a separate bounded queue so requests overlap with engine work, including multiple decisions from one game. Slow model service applies backpressure once the queue is full. No SQLAlchemy session is shared across threads and no model call runs under the short application write lock. Classification-only jobs read saved decisions directly and launch no background Stockfish processes. Identical simultaneous engine cache requests share a fixed-size striped lock registry, avoiding redundant UCI searches without unbounded lock memory.

On-demand answers reuse the exercise analysis limits/resources and require the same binary hash/version. Incompatible executables cannot silently mix scores or create recall failures. Engine adapter cache version is 2.
