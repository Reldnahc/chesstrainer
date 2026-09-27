# Mistake classification without an LLM

Historical research record from September 12, 2026, before removal of the model runtime. Repository observations and proposed steps below describe that investigation, not current setup or remaining work. The replacement has since been implemented and upgraded; see [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for current behavior and [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for priorities.

## Conclusion

Replace paid classification with local, versioned tactical detectors over saved Stockfish lines and python-chess board states. Start with a narrower set of supported labels, allow abstention, and keep the engine's practical move-acceptance policy separate. Useful classification does not require an LLM; comprehensive strategic diagnosis is a substantially harder problem.

This is an engineering recommendation, not a measured accuracy claim. No replacement classifier was executed or benchmarked in this research pass.

## Primary-source findings

Lichess documents automatic puzzle tagging followed by player refinement of tags. Its dataset therefore offers a useful comparison set, but labels are not infallible ground truth. Its puzzles also generally require uniquely good solution moves, whereas Fieldwork intentionally accepts multiple sound alternatives. Preserve Fieldwork's policy when adapting the approach. The exported puzzle data is published under CC0. [Lichess database documentation](https://database.lichess.org/#puzzles).

The public Lichess tagger uses Python and python-chess to examine move sequences for forks, hanging pieces, skewers, discovered attacks, pins, mate patterns and other themes. It is explicitly incomplete: the inspected `overloading()` detector returns false. The fork routine excludes kings and pawn targets. These are useful examples of conservative coverage limits, not a universal mistake classifier. [Tagger implementation](https://github.com/ornicar/lichess-puzzler/blob/master/tagger/cook.py).

The Lichess puzzle model fixes the solver's side relative to an initial opponent move. Fieldwork would need explicit perspective adaptation for both a missed learner opportunity and an opponent tactic allowed by the learner's actual move. Passing arbitrary PVs directly into its puzzle API risks reversed attribution. [Puzzle model](https://github.com/ornicar/lichess-puzzler/blob/master/tagger/model.py).

python-chess already supplies attacks, legal moves and absolute-pin detection. Its attack maps include pinned attackers, and its built-in pin helpers concern pins to the king. Consequently, geometric attack counts alone cannot prove that a capture wins material or that a relative pin matters. [Rules API documentation](https://python-chess.readthedocs.io/en/latest/core.html).

Stockfish supplies search scores and principal variations; python-chess supports MultiPV and restricting root moves. These support targeted verification of suspected motifs, rather than asking an engine for a pedagogical label. [Engine API](https://python-chess.readthedocs.io/en/latest/engine.html), [Stockfish UCI implementation](https://github.com/official-stockfish/Stockfish/blob/master/src/uci.cpp).

An additional project, chess_detect, advertises PGN motif detectors and board annotations. It is worth examining for examples, but its feature list and tests do not establish mistake-cause accuracy on Fieldwork games. Do not adopt it as an authority without independent evaluation. [Project documentation](https://github.com/aslyamov/chess_detect).

Lichess-puzzler identifies its source license as AGPL-3.0; Fieldwork currently has a GPL-3.0 license. Source reuse needs an explicit licensing decision and attribution. Prefer a small implementation fitted to our evidence model rather than importing the entire puzzle pipeline. [Upstream repository/license](https://github.com/ornicar/lichess-puzzler).

## Fit with the current application

Already reusable:

- `analysis.py`: same-root best and actual-move searches, learner-perspective scores, meaningful-mistake policy and persistent analyses.
- `chess_core.py`: legality, canonical identity, material, explicit mate transitions and replayed facts.
- `explanations.py`: legal PV frames, actual captures, checks, promotion, castling, highlights and material changes.
- `weaknesses.py`: deterministic aggregation of independent game evidence for weakness summaries.
- Review, accepted alternatives, counter-move playback and FSRS: already independent of OpenAI inference.

The current classifier receives both candidate sets, but deterministic facts primarily describe the actual-move line. The replacement should explicitly examine the useful alternative as well. Reconstruct positions from the saved game when repetition history matters.

The existing `Classifier` protocol is a useful boundary, but persistence is not yet provider-neutral: `SkillEvidence.llm_run_id` is mandatory, cache records are `LLMRun`, and health/settings/retry/audit paths assume an LLM provider. A replacement needs a migration and API/UI changes; swapping one class alone would produce misleading provenance.

## Proposed classification contract

Keep three distinct concepts:

1. **Consequence:** lost material, allowed mate, missed mate, or another significant engine-evaluated loss.
2. **Mechanism:** fork, exploited pin, skewer, discovered attack, undefended capture, promotion tactic, and so on.
3. **Context:** opening/endgame type, material advantage, castling rights, pawn structure.

A rook endgame is context, not proof that rook-endgame understanding caused a mistake. Likewise, an exposed king or doubled pawn need not be the reason a move fails. Do not force every decision into a specific skill.

Each emitted label should carry a rule ID/version, decision and analysis IDs, relevant plies, actor, affected squares/pieces, and direction (`missed_opportunity` or `allowed_opponent_tactic`). Generate short explanations from these fields. Keep raw evidence independent of wording and detector versions. Do not invent a numerical confidence probability; record verification status, and use measured detector precision once available.

## Initial scope and limits

| Classification | Proposed support | Evidence required |
|---|---|---|
| Allowed/missed forced mate | First release | Existing normalized mate transition; only name a mate pattern when replay reaches the necessary verified board state |
| Material loss / missed winning capture | First release | Actual and alternative lines, settled capture sequence, compatible engine advantage; immediate material count alone is insufficient |
| Hanging piece | First release, conservative | Legal opponent capture with a verified unfavorable consequence; exclude normal exchanges, compensation and unrelated losses |
| Fork / double attack | First release | Multiple relevant targets plus a line exploiting the attack; reject harmless geometry |
| Discovered check / double check | First release | Changed checking pieces, linked to the meaningful continuation |
| Promotion opportunity/threat | First release | Actual promotion or a verified promotion continuation, not merely an advanced pawn |
| Exploited pin / skewer / removal of defender | Subsequent detectors | Piece relationships across plies and demonstrated tactical exploitation |
| Pawn structure, development, conversion, king activity | Context initially | Feature detection is feasible; causal strategic explanations require additional evidence and validation |
| Calculation / opponent-plan awareness | Avoid automatic diagnosis | A bad move does not reveal the learner's thought process |

Analyze both sides of the decision. A fork in the learner's best line is a missed opportunity; a fork in the opponent's refutation is an allowed tactic. Also reject motifs that already existed identically before the mistake and do not explain its additional loss.

## Verification safeguards

Use saved evidence first. Replay legal moves and identify a candidate motif; then verify its role against the actual line and sound alternatives. If a PV stops midway through an exchange, compensation is unclear, or the relevant defense was not explored, run a bounded additional local search or abstain. Cache additional analysis through the existing engine adapter.

A principal variation is one engine continuation, not proof that every reply is forced. Search scores can change with limits. Static exchange checks can help screen captures but do not replace engine checks for checks, intermezzos, mating compensation or remote tactical responses.

This removes per-classification API charges. Local CPU cost remains, especially for extra verification. Replaying already saved lines should be inexpensive relative to Stockfish searching, but measure actual throughput before promising a speedup.

## Evaluation before replacing the active labels

Build a small, independent human-reviewed benchmark from learner decisions, stratified by game, outcome, game phase and supported motif. Include sound moves, harmless attacks, equal trades, temporary sacrifices, pinned defenders, mate threats, special moves and both colors. Keep tuning and held-out examples in different games; deduplicate positions.

Use a sample of Lichess puzzles as supplemental motif regression data. Avoid evaluating only against the same tagger whose rules inspired the implementation. Existing LLM labels are comparison outputs, not the answer key. Keep private game fixtures local unless explicitly approved for publication.

Report per-label precision, recall, coverage/abstention, direction errors, explanation evidence correctness, extra searches and processing time. Prefer fewer defensible labels over broad coverage. A proposed initial target is at least 95% precision for enabled tactical labels on the held-out set, with sample sizes and uncertainty reported; this is a quality target, not a result or guarantee. Disable poorly supported detectors.

Manually inspect representative correct detections, false positives and unclassified cases. Recheck progress/restart behavior and verify that classification backfills create no reviews, reset no schedules and reactivate no retired positions.

## Recommended transition

1. Implement versioned local findings and a provider-neutral classification audit, preserving historical LLM runs and course snapshots.
2. Run the initial detectors against saved analyses without changing active labels. Compare the results using the benchmark above.
3. Enable validated detectors and rebuild weakness summaries from their evidence. Backfill incrementally with cancellation/resume and cache reuse. Keep unknown cases usable in Review.
4. Remove OpenAI runtime calls, SDK dependency, provider configuration and paid job/UI paths once the local route is proven. Preserve historical data and export readability. No need to delete existing learning history or reimport games.

The next concrete milestone is a reviewable local-classification report on saved games, followed by replacing connectivity. It is not a lesson rewrite or a new public puzzle database.
