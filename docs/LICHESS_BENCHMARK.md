# Lichess positive-theme benchmark

Developer-only evaluation tooling for the deterministic tactical detector. It must never import puzzles into the trainer or change production rules, grades, schedules or data.

## Question and evidence

Can Fieldwork recognize a tactical motif in a solution independently tagged with that theme? The project owner need not be a strong chess player to run this external comparison. Lichess exports millions of puzzles; its tags are produced automatically and refined by player votes. They are useful external labels, not infallible expert annotations. Earlier Fieldwork design research inspected the Lichess tagger, so shared assumptions can produce correlated errors.

This primarily measures positive agreement/recall on tagged examples. **A missing theme is not a negative label. No precision, specificity or false-positive rate is inferred from absent tags.** Real-game finding precision, psychological explanations, strategic diagnosis and actual learning outcomes remain separate questions. The next precision layer is blinded human review of stratified positive findings.

Sources: [dataset format and provenance](https://database.lichess.org/#puzzles), [official theme definitions](https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml), [upstream tagger](https://github.com/ornicar/lichess-puzzler/blob/master/tagger/cook.py). Inspected September 13, 2026.

## Implementation plan

1. Define versioned exact/approximate/unsupported mappings. Stream CSV and compressed input, reservoir-sample each theme independently with a stable seed, and validate/replay tiny synthetic fixtures.
2. Adapt legal solver lines to the unchanged production detect_patterns function. Write per-theme metrics, separate semantic-group summaries, complete sample records and a missed/skipped corpus. Add deterministic adapter/metric/export/CLI tests.
3. Run the complete backend suite and lint; run an initial full-dataset benchmark if practical. Document measured limitations without changing detector rules.

Code stays under scripts/lichess_benchmark with a standalone entry point. Production imports no benchmark code. No database, application settings, network requests or native engine processes are needed by a benchmark run. Zstandard support, if used, is an optional developer-only dependency.

## Detector boundary

Lichess FEN precedes the opponent's setup move. Replay that first UCI move, then use the remaining line from the solver's perspective. Check every move with python-chess, preserve castling/en-passant/promotion state, and record the setup separately.

Call the production line-pattern detector on each solver decision's bounded continuation. This allows a theme anywhere in the supplied solution; report recognition from the initial episode separately. Keep the production tactical-episode limit. Do not generate missing continuations, invent centipawn scores, call LocalClassifier.classify with fabricated comparisons, or synthesize defense probes.

For this adapter only, material support means a positive material delta actually visible at the end of the supplied bounded continuation; mate support means a terminal legal checkmate for the solver. Record whether the material endpoint is settled by production's endpoint checker. An observed gain in an unfinished line is not guaranteed material or engine evaluation. This is line-detector agreement, not end-to-end production-classifier recall.

Fully replayable lines with no visible outcome, short tactical evidence or missing follow-up captures remain misses if the expected detector does not fire. They are not silently excluded to improve the score. Invalid FEN/moves, absent solver moves and incompatible row data are explicit skips; report reconstruction coverage alongside agreement.

## Sampling and reports

Sample before legality/outcome filtering. Use an independent seeded reservoir per selected theme across the entire input; do not select by rating, popularity, puzzle length or early file order. Sampling is over CSV rows, so duplicated source rows can affect weights. Record input SHA256, row counts, seed, sample size, adapter/mapping versions, detector source hashes and parameters.

Report candidates encountered, sampled, reconstructed, detected, skipped, disagreements and positive agreement for every selected theme. Separate exact and approximate mappings, list unsupported mappings without invented scores, and label macro/micro summaries as theme-puzzle incidences because a puzzle can contribute to multiple themes.

JSON and Markdown summarize the run. JSONL stores every sampled row; a failure corpus contains each missed/skipped positive with original FEN, setup/solution, themes, expected/actual motifs, witness plies/squares, adapter diagnostics and reason. Never treat additional emitted motifs as false positives solely because their tags are absent.

Implementation status and commands will be filled in as each stage is verified.
