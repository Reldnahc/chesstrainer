# Reuse of the Lichess tactical tagger

## Decision and scope

Requested September 13, 2026 after the external benchmark exposed poor recognition in the custom detector. Reuse the public Lichess motif predicates, pinned to commit 8d9faff694ba3a8598abc5465347209af3f90a82 (August 7, 2026), as the recognition source for the mapped tactical themes.

Keep python-chess, native Stockfish, practical grading, source games, review sessions and FSRS. Existing historical classifier responses remain readable. This is a classifier implementation change, not a puzzle-training product or an LLM integration.

## Repository assessment

The existing Classifier protocol, versioned caches, Finding audit model and shared review explanation path provide the integration boundaries. The current custom detector mixes recognizing motifs with proving material/mate consequences. The standalone positive-theme benchmark already provides a frozen sample and reproducible context. No SQL schema change is needed.

The upstream Python predicates inspect python-chess PGN nodes and return booleans. They do not emit the exact move/square witnesses required by Fieldwork's review UI. The adapter must preserve perspective, bounded continuation context and auditable coordinates. Direct copying without this adaptation would lose explanation fidelity or assign the opponent's tags to the learner.

## Incremental plan

1. Run the unmodified pinned predicates on the frozen 12,000-incidence sample; preserve results. Complete.
2. Vendor the relevant source with license/provenance and minimal package integration. Add witness reporting without changing predicate conditions; verify structural and output parity with upstream. Adapt legal saved lines, including missing setup context, without fabricated moves or scores.
3. Connect upstream recognition to the classifier and explanation paths. Preserve outcome verification and original review grading; keep an explicit distinction between motif occurrence and a player's mistake. Retain useful existing causal/native evidence and historical compatibility.
4. Run deterministic regressions, benchmark comparisons and full application verification. Document final behavior, measured gaps and deployment status. Commit verified stages.

## Initial upstream comparison

Unmodified individual motif predicates were run against the exact frozen sample from LICHESS_BENCHMARK_RESULTS.md, without fabricated scores or Fieldwork outcome gates. Results are in ignored data/lichess-upstream/8d9faff694ba3a8598abc5465347209af3f90a82/comparison-raw.

Per 1,000 positive examples: fork 1,000; pin 999; skewer 1,000; capturingDefender 1,000; backRankMate 1,000; promotion 1,000; underPromotion 981; discoveredAttack 1,000; discoveredCheck 746; doubleCheck 1,000; hangingPiece 999; deflection 1,000.

This is agreement with labels related to the upstream generator, not independent precision or proof of real-game causal accuracy. Preserve the initial Fieldwork baseline. Missing themes never constitute negative ground truth. Do not broaden upstream predicates to improve these numbers.

## Licensing and provenance

Upstream source is AGPL-3.0; preserve its complete license, pinned commit, original source hashes and a list of local modifications. Fieldwork's existing source remains available under its original GPL-3.0-or-later terms. Combined distributions containing the AGPL tagger must also satisfy the applicable AGPL terms; document source availability for LAN users. No private data or secrets belong in distributed source.

Primary source: [Lichess puzzler](https://github.com/ornicar/lichess-puzzler), [tagger](https://github.com/ornicar/lichess-puzzler/blob/8d9faff694ba3a8598abc5465347209af3f90a82/tagger/cook.py), [license](https://github.com/ornicar/lichess-puzzler/blob/8d9faff694ba3a8598abc5465347209af3f90a82/LICENSE).

## Risks and acceptance criteria

- A motif in a line is not automatically the reason for a learner's mistake. Preserve explicit engine comparison and relevant episode constraints for active weakness evidence.
- Upstream predicates describe selected puzzle solutions; ordinary game/PV inputs require legal replay and both-color/setup tests.
- Pinned-version quirks, including underpromotion and discovered-check theme differences, must be visible rather than hidden by mapping changes.
- Witness instrumentation must leave every original detector decision unchanged. Existing wrong-label regressions must remain meaningful.
- No loss of reviews, schedules, retired positions, original analyses or historical audits. No background reclassification of live data merely from importing a module.

## Adapter verification

The pinned-source adapter passed 19 deterministic tests. Removing the witness observers reproduces every original function AST hash, and util.py/model.py/license bytes match upstream exactly. Across the complete frozen sample, all 12,000 theme sets matched the unmodified upstream execution; 17,468 concrete witness records had valid actor/frame/ply coordinates. No fabricated score, null setup move, global tracing or cross-worker observer state is used.
