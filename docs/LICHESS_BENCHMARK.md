# Lichess positive-theme benchmark

Developer-only, offline evaluation of Fieldwork's deterministic tactical **line detector**. This does not import puzzles into the trainer, modify rules, grade moves, schedule reviews or read the application database.

## Why this exists

The project owner is approximately 600 Elo; manual chess adjudication by the owner is not a viable validation strategy. We need an external test of whether a motif known to be present is recognized. Lichess supplies millions of tagged tactical positions, making a statement such as "Fieldwork recognized its fork motif in X% of 1,000 sampled Lichess fork puzzles" possible without relying on the owner's chess strength.

The labels are external to this benchmark, but are not infallible expert annotations. Lichess generates tags automatically and refines them through player votes. Since classifier v4, Fieldwork reuses the pinned upstream motif predicates. Agreement now partly measures compatibility with a related label generator; it is not independent validation of the reused rules. The v3.1 baseline remains preserved.

Sources inspected September 13, 2026: [dataset, format and CC0 terms](https://database.lichess.org/#puzzles), [official theme definitions](https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml), [upstream tagger](https://github.com/ornicar/lichess-puzzler/blob/master/tagger/cook.py). The current exported dataset is authoritative for candidate tags; an older tagger checkout may not list every exported theme.

## Run it

Use a source checkout with Python 3.12+ and the normal locked Python dependencies installed, including the editable trainer package; see [README](../README.md#install-and-run). No running backend, Stockfish executable, model key or frontend is needed.

Download the puzzle CSV from the [official database page](https://database.lichess.org/#puzzles) separately and put it under ignored data/lichess-benchmark. The benchmark itself makes no network requests. It accepts UTF-8 CSV, gzip-compressed CSV and Zstandard-compressed CSV. Zstandard is optional developer tooling, outside production dependencies:

```sh
python -m pip install -r scripts/lichess_benchmark/requirements.txt
python scripts/benchmark_lichess.py --list-mappings
python scripts/benchmark_lichess.py --input data/lichess-benchmark/lichess_db_puzzle.csv.zst --output data/lichess-benchmark/quick-NEW
```

Defaults: all 12 eligible theme mappings, 200 rows per theme, seed 0. A quick sample still scans the **entire file** to avoid a first-N bias. Select a smaller local dataset if scan time is the constraint. Example of a larger focused run:

```sh
python scripts/benchmark_lichess.py --input data/lichess-benchmark/lichess_db_puzzle.csv.zst --output data/lichess-benchmark/forks-pins-NEW --motifs fork pin --samples-per-motif 5000 --seed 42
```

Use Lichess theme names for --motifs, including capturingDefender and backRankMate, rather than Fieldwork skill IDs. Unknown or unsupported selections fail with an explanation. Windows users can substitute .venv/Scripts/python.exe without activating the environment. python -m scripts.lichess_benchmark is an equivalent entry point from the root.

The output directory must be new; the default is data/lichess-benchmark/results. Existing runs are never overwritten. Exit codes: 0 for a completed run with reconstructed positives, 1 for an error, 2 for a completed scan with no reconstructed selected positives. Zero candidates produce unknown/null agreement, never 0% or 100%.

## Module boundaries

| Module under scripts/lichess_benchmark | Responsibility |
|---|---|
| themes.py | Versioned eligibility, semantic relationship and witness-subtype projections |
| dataset.py | Streaming CSV/compression validation, file hashing, candidate counts and independent reservoirs |
| positions.py | Validate each sampled row and reconstruct legal setup/solution states using production chess-core helpers |
| detector.py | Adapt solver continuations to unchanged production detectors and preserve witness coordinates |
| reports.py | Positive-only denominators, exact/approximate summaries and Markdown rendering |
| runner.py | Orchestrate sampling/evaluation and write JSON/JSONL artifacts |
| compare.py | Replay a frozen samples.jsonl through raw upstream recognition and current Fieldwork admission, preserving baseline records |
| cli.py / __main__.py | Standalone developer commands; scripts/benchmark_lichess.py is the direct entry point |
| requirements.txt | Optional pinned Zstandard decoder; no application dependency changes |

Production imports no benchmark code. The adapter does not instantiate application Settings, load .env, open SQLite, call native engines or contact providers. It uses LocalClassifier's default parameters and records them, rather than inheriting a host's classification overrides.

## Theme mapping

The executable source of truth is [themes.py](../scripts/lichess_benchmark/themes.py); --list-mappings and each report include its full semantics. Exact describes the **motif event**, not equality of every outcome/evidence gate. Approximate mappings deliberately expose narrower production witnesses rather than broadening rules to match a theme name.

| Lichess theme | Fieldwork skill | Relationship | Eligible | Semantic relationship and limits |
|---|---|---|---|---|
| fork | fork | approximate | Yes | Pinned Lichess fork recognition plus existing collection witnesses. Upstream tests valuable non-pawn targets and forker safety; Fieldwork outcome/episode gates remain. Native defensive-probe extensions are not exercised. |
| pin | pin | approximate | Yes | Pinned Lichess absolute-pin predicates recognize restricted captures or escape; existing collection witnesses remain. Relative pins need native probes. Fieldwork outcome/episode gates remain. |
| skewer | skewer | approximate | Yes | Pinned Lichess skewer predicate supports aligned front targets beyond kings, with same-slider collection; existing king-skewer witnesses remain. Fieldwork outcome/episode gates remain. |
| capturingDefender | removing_defender | approximate | Yes | Pinned Lichess capture-of-defender predicate plus existing collection witnesses. Fieldwork retains its reviewed free-queen/pawn-cleanup attribution safeguard and outcome/episode gates. |
| backRankMate | back_rank | approximate | Yes | Pinned Lichess actual back-rank mate with own-piece escape barriers, plus existing rook/queen-and-pawn witnesses. Terminal mate must appear in the bounded line. |
| promotion | promotion_awareness | approximate | Yes | An actual promotion from the upstream predicate or existing retained-gain witness; promotion threats do not qualify. Fieldwork outcome/episode gates remain. |
| underPromotion | promotion_awareness | approximate | Yes | Project actual knight/bishop/rook promotion witnesses from the broader promotion skill. The raw upstream under_promotion predicate excludes rook/bishop mating promotions; this projection can include them. Fieldwork outcome/episode gates remain. |
| discoveredAttack | discovered_attack | approximate | Yes | Pinned Lichess uncovered single check or discovered line capture, plus existing collection witnesses. Quiet threats without collection may miss. Fieldwork outcome/episode gates remain. |
| discoveredCheck | discovered_attack | approximate | Yes | Only the uncovered-single-check witness qualifies, not a nonchecking discovery or double check. This theme may not be exported separately. |
| doubleCheck | double_attack | exact | Yes | Exact double-check event, selected from Fieldwork's broader double_attack skill. A nonchecking double attack cannot earn agreement. Adapter outcome gates still apply. |
| hangingPiece | missed_tactical_capture | approximate | Yes | First solver capture, the positive-side counterpart of hanging_piece: upstream undefended-piece capture with real setup context or existing retained-gain witness. Fieldwork outcome gates remain; insufficiently defended pieces are broader. |
| deflection | deflection | approximate | Yes | Pinned Lichess deflection sequences plus existing check/recapture and collection witnesses. Broader attraction is not substituted. Fieldwork outcome/episode gates remain. |
| trappedPiece | trapped_piece | unsupported | No | Production requires native counterfactual escape/capture searches, absent from CSV. |
| attraction | No equivalent | unsupported | No | Luring a piece to a square is not equivalent to removing its defensive duty. |
| overloading | overloaded_defender | unsupported | No | No emitted production line detector for overloaded defenders. |
| interference | No equivalent | unsupported | No | Blocking a line is not equivalent to capturing or deflecting its defender. |
| xRayAttack | No equivalent | unsupported | No | Ray-through-piece motifs do not establish Fieldwork pin or skewer witnesses. |
| advancedPawn | promotion_awareness | unsupported | No | An advanced pawn or promotion threat is not an actual promotion witness. |
| mate | No equivalent | unsupported | No | A mating solution cannot establish allowed/missed mate without alternative scores. |
| defensiveMove | defensive_resource | unsupported | No | No equivalent emitted line detector; the taxonomy ID alone is insufficient. |
| sacrifice | No equivalent | unsupported | No | A successful sacrifice is not evidence of Fieldwork's avoiding_bad_trades label. |

Other dataset themes are counted in input.theme_counts but have no mapping or agreement estimate. Unsupported mappings have candidate counts and zero sampled rows; their percentages remain null.

## Transforming a puzzle into detector input

1. The CSV FEN is **before the opponent's setup move**. Validate it with trainer.chess_core.valid_board.
2. Replay Moves token 1 as the setup using legal_move and python-chess. Its resulting turn is the solver's color. Record the setup separately.
3. Validate and replay every remaining UCI move, recording SAN and board states. Board 0 is the solver root; board 1 follows the first solution move. Preserve castling rights, legal en passant, promotions and the reconstructed move stack. Pre-FEN repetition history is unavailable; the benchmark makes no repetition/draw adjudication.
4. Visit each solver decision (solution offsets 0, 2, 4, ...). Opponent moves remain context; the opponent never becomes the detection subject. Each suffix uses production's 16-ply endpoint with up to 16 extension plies.
5. Call unchanged trainer.tactical_patterns.detect_patterns with first=1, the production endpoint, missed_opportunity direction and the default eight-ply connected tactical-episode bound.
6. Match the expected skill and, when needed, its emitted witness subtype. Reuse production findings, moves, roles, frames, explanations and rule IDs; no chess pattern logic is reimplemented.

Example synthetic row: setup d7e8, solution b5c7 e8d7 c7a8. The solver is White, and a fork witness uses solution plies [1, 3], corresponding to Nc7+ and Nxa8. It does not identify Ke8 as the learner's tactical move.

The CSV has no best-versus-actual candidate scores or counterfactual branches. The tool therefore **does not call LocalClassifier.classify** or fabricate Candidate evaluations. For this adapter only, material support means observed endpoint material-balance gain of at least one point; mate support means a legally replayed terminal checkmate for the solver. The production endpoint reason and nullable settled material delta are recorded alongside this weaker observed delta.

An unfinished line ending in a capture can enable material support despite an unknown recapture. A later suffix can show a gain after an earlier sacrifice. Neither proves a forced or globally profitable tactic. Raw production witnesses retain their verification/explanation fields, but their outer source explicitly says lichess_supplied_line_not_native_analysis. They must not be mistaken for new engine evidence.

Recognition anywhere in a solver episode is the main metric. Recognition within the initial episode is reported separately, since the production mistake classifier must attribute a motif to a particular original decision. Hanging-piece credit is restricted to the initial solver capture even for the main metric.

## Sampling and input failures

An independent seeded reservoir per theme samples uniformly over all matching CSV rows before chess or outcome validation. Selecting another theme does not change an existing theme's sample. There is no rating, popularity, length or difficulty filter. Memory scales with sample size times selected themes, not dataset size; decoding and CSV parsing stream bounded chunks/records.

The same ordered dataset, configuration, seed and sampling version produce the same samples. Reordering the dataset or changing the seed can change the sample. Compression of identical CSV content leaves row selection unchanged but changes the file fingerprint. The row is the sampling unit: duplicate source rows can reweight selection. A puzzle may appear in several theme samples.

Rows with known themes but incompatible column counts, FENs, moves, variants or missing solver moves stay sampled and are skipped with reasons. A 256-solution-ply safety limit is also explicit, not a difficulty selector. Skips are never replenished. Valid short lines, absent material support, missing collection witnesses and broad semantic differences remain disagreements when the detector does not match.

Malformed CSV quoting, invalid encoding or corrupt/truncated compression abort the scan; a partial file cannot receive a completed result. Zstandard frame completion, including concatenated frames, is checked explicitly because the ordinary streaming decoder can accept truncation. Unknown extra columns are preserved. Rows whose malformed data has no assignable theme are counted globally, not invented as candidates for any motif.

## Metrics and artifacts

Per selected motif, let S be sampled, R reconstructed, D detected and K skipped:

- Positive agreement / recall on tagged positives = 100 * D / R.
- Initial-episode agreement = 100 * initial_episode_detected / R.
- Reconstruction coverage = 100 * R / S.
- Sample detection including skips = 100 * D / S.
- Disagreements = R - D; S = R + K. Zero denominators are null.

Candidate counts cover the full input, not just the reservoir. Exact and approximate groups have separate macro (mean nonempty motif percentages) and micro (pooled detected / reconstructed) summaries. Empty themes are explicitly excluded from the macro. Micro counts **theme-puzzle incidences**, not unique-puzzle accuracy; overlapping themes and subsets such as underpromotion prevent treating incidences as independent examples.

| File | Contents |
|---|---|
| report.json | Completion status; versions, input bytes/SHA256/row counts; configuration; production and benchmark source hashes; parameters; all mappings; per-motif counts, reasons and percentages; group summaries and adapter diagnostics |
| report.md | Human-readable per-motif tables, exact/approximate summaries, all mapping semantics, file descriptions and explicit interpretation limits |
| samples.jsonl | Every sampled theme-puzzle incidence, including detected, missed and skipped results |
| failures.jsonl | Every missed/skipped positive with the same context; unexpected detector errors are preserved here before the run fails |

Each corpus record stores puzzle ID if present, CSV record number, original fields/FEN, setup move, complete dataset and solution UCI moves, original themes, expected theme/skill, relationship, status/reason, actual detected skills and full witness information. Reconstructed records additionally contain solver FEN/color, setup/solution SAN and each detector window's endpoint/material/mate diagnostics.

For each witness, finding.plies and finding.frame_ply are local to its window. solution_plies and frame_solution_ply translate them to the full solver line; ply 0 is its root position. window_start_solution_ply tells where the window begins. Moves token indices are one larger because token 1 is the setup. Witness analysis IDs are benchmark references, not database engine-analysis IDs.

Miss reasons distinguish no_visible_material_gain_or_terminal_mate from expected_witness_not_emitted. These are adapter diagnostics, not adjudicated explanations of the detector's blind spot. Additional detected motifs are recorded **without treating absent Lichess tags as negative ground truth**.

Before evaluation the report is incomplete. An unexpected detector exception preserves the offending row and changes the report to failed; it cannot silently inflate a completed metric. Fix/review harness errors before interpreting that run. Keep inputs and artifacts in ignored data, never the full database in Git.

## Interpretation and next validation layer

This can establish repeatable agreement on tagged positive examples under a documented line adapter. Since upstream reuse, those labels are related to the production recognizer and cannot serve as independent proof of its precision. The [initial benchmark](LICHESS_BENCHMARK_RESULTS.md) reports 1,000 examples for each eligible theme, including weak motifs and unsettled endpoints.

It cannot establish:

- Precision or false-positive rates from absent tags. **A missing theme is not a negative label.**
- End-to-end classifier recall, including actual-versus-best scores, source-game causality and native defensive queries.
- Precision on real user mistakes or the psychologically correct reason a learner erred.
- Strategic/positional diagnosis, long-term learning improvement or exact transfer from curated puzzles to arbitrary games.

The next separate layer is blinded human review of stratified positive findings, primarily to estimate precision; [existing annotation tooling](LOCAL_CLASSIFICATION.md#configuration-and-evaluation) preserves reviewer provenance and uncertainty. Preserve this baseline and inspect disagreements before proposing any rule work. The harness does not modify classifier rules. The separate v4 integration reuses pinned upstream conditions without tuning them against these failures.

## Tests

```sh
python -m pytest -q backend/tests/test_lichess_dataset.py backend/tests/test_lichess_benchmark.py
```

48 deterministic tests cover theme eligibility/subtypes, setup orientation, legal full replay, both colors, castling/en passant/promotion, shared-detector invocation, initial versus later episodes, seeded independent reservoirs, file fingerprints, denominator arithmetic, corpus reproducibility and malformed/unsupported/failing input.

Tiny checked-in fixtures are explicitly synthetic, including deliberately inconsistent tags for miss-path tests. They establish harness contracts, not detector accuracy. Four compression tests skip clearly when optional zstandard is absent; no dataset download, database, engine or network is needed for these tests. Full application tests and results are documented in [TESTING](TESTING.md) and [VERIFICATION](VERIFICATION.md).

## Frozen upstream versus application comparison

After a baseline run, compare its exact saved sample without scanning or resampling the dataset:

```sh
python -m scripts.lichess_benchmark.compare --samples data/lichess-benchmark/baseline-v3.1-seed0-1000/samples.jsonl --output data/lichess-upstream/comparison-NEW
```

A completed report.json must accompany samples.jsonl. The command streams those records, fingerprints the sample bytes, verifies selected positive tags/counts, preserves malformed-row skips, and writes a new output directory. It supplies no alternative scores and never calls the full mistake classifier.

- **Baseline** preserves the original record and its detector/mapping metadata.
- **Raw upstream** calls the pinned predicates once over the entire legal solver line. It has no material/episode admission gate and no initial-episode metric.
- **Fieldwork admission** calls the current shared line detector through the original benchmark's visible-outcome adapter, including retained collection/native-independent extensions and episode gates.

report.json contains per-theme counts/percentages, separate exact/approximate macro and micro summaries, baseline provenance, all current detector/vendor source hashes and upstream commit. report.md compares the three percentages without claiming precision. comparisons.jsonl retains each baseline/current record and raw upstream themes/witnesses; failures.jsonl contains every incidence missed or skipped by either current path. Unexpected errors fail the report with reproducing context.

Underpromotion is a deliberately visible semantic difference: raw upstream excludes rook/bishop mating underpromotions, whereas Fieldwork's witness projection recognizes any actual nonqueen promotion that passes its admission checks. Discovered-check projection requires a single uncovered check, excluding double check. Neither mapping was widened to flatter results.

See [LICHESS_REUSE.md](LICHESS_REUSE.md) for the frozen 12,000-incidence comparison, remaining gaps and provenance. The comparison adds eight deterministic tests in test_lichess_comparison.py.
