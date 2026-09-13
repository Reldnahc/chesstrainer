# Reuse of the Lichess tactical tagger

## Decision and scope

Requested September 13, 2026 after the external benchmark exposed poor recognition in the custom detector. Reuse the public Lichess motif predicates, pinned to commit 8d9faff694ba3a8598abc5465347209af3f90a82 (August 7, 2026), as the recognition source for the mapped tactical themes.

Keep python-chess, native Stockfish, practical grading, source games, review sessions and FSRS. Existing historical classifier responses remain readable. This is a classifier implementation change, not a puzzle-training product or an LLM integration.

## Repository assessment

The existing Classifier protocol, versioned caches, Finding audit model and shared review explanation path provide the integration boundaries. The current custom detector mixes recognizing motifs with proving material/mate consequences. The standalone positive-theme benchmark already provides a frozen sample and reproducible context. No SQL schema change is needed.

The upstream Python predicates inspect python-chess PGN nodes and return booleans. They do not emit the exact move/square witnesses required by Fieldwork's review UI. The adapter must preserve perspective, bounded continuation context and auditable coordinates. Direct copying without this adaptation would lose explanation fidelity or assign the opponent's tags to the learner.

## Incremental plan

1. Run the unmodified pinned predicates on the frozen 12,000-incidence sample; preserve results. Complete.
2. Complete: vendor the relevant source with license/provenance and minimal package integration. Add witness reporting without changing predicate conditions; verify structural and output parity with upstream. Adapt legal saved lines, including missing setup context, without fabricated moves or scores.
3. Complete: connect upstream recognition to the classifier and explanation paths. Preserve outcome verification and original review grading; keep an explicit distinction between motif occurrence and a player's mistake. Retain useful existing causal/native evidence and historical compatibility.
4. Complete: run deterministic regressions, benchmark comparisons and full application verification. Document final behavior, measured gaps and deployment status. Commit verified stages.

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

## Application integration

`lichess_patterns.py` reconstructs a python-chess PGN line and invokes the pinned predicates. `lichess_witnesses.py` translates their successful return sites into real move indices, board frames and square roles. `tactical_patterns.py` applies Fieldwork's existing connected-episode and outcome admission boundaries. `verified_patterns.py` retains the previous detailed collection witnesses and independently verified extensions; this preserves reviewed regressions and richer explanations without requiring every new upstream tag to satisfy the old recognition rules.

Classifier version `4.0-lichess-8d9faff6` invalidates previous classification cache identities while retaining historical responses. Active weakness evidence still requires meaningful engine comparison and supported material/mate outcomes. Review explanations can annotate a motif present in the saved answer line without turning that observation into a new diagnosis or changing the answer grade. No Stockfish, grading, scheduling or database schema changes are involved.

Missing pre-position context explicitly skips upstream hanging-piece recognition; no null setup move or invented score is supplied. The existing native capture evidence remains available. A quiet gap excludes unrelated later motifs from a decision's explanation. The reviewed safeguard against teaching pawn cleanup after a free queen capture as defender removal remains at the application attribution boundary.

Integration tests demonstrate pin exploitation newly recognized by upstream for both colors, and double check visible in a line without asserting a mistake when the engine comparison supplies no meaningful loss. Existing classifier, explanation and wrong-label regression contracts continue to apply unchanged. Saved games are not automatically reclassified on startup; use Settings > Classify saved games after deploying the version.

## Frozen comparison after integration

Final replay: September 13, 2026; 12,000 theme-puzzle incidences, 1,000 per theme; all reconstructed, zero skips. It took 105.031 seconds. The exact sample SHA256 is e44fad1c330ce878f3b2ad9f0adcbe01685129a2ae6a54b73325938b5a86fef0. Original dataset/sample provenance remains in LICHESS_BENCHMARK_RESULTS.md.

| Theme | v3.1 line detector | Raw upstream recognition | v4 Fieldwork admission |
|---|---:|---:|---:|
| backRankMate | 99.2% | 100.0% | 100.0% |
| capturingDefender | 63.8% | 100.0% | 78.7% |
| deflection | 76.7% | 100.0% | 94.8% |
| discoveredAttack | 81.4% | 100.0% | 93.8% |
| discoveredCheck | 65.9% | 74.6% | 66.0% |
| doubleCheck | 94.0% | 100.0% | 94.0% |
| fork | 71.3% | 100.0% | 98.2% |
| hangingPiece | 99.2% | 99.9% | 99.2% |
| pin | 39.7% | 99.9% | 86.1% |
| promotion | 97.9% | 100.0% | 98.1% |
| skewer | 87.9% | 100.0% | 92.8% |
| underPromotion | 97.0% | 98.1% | 98.4% |

Raw upstream matches the earlier unmodified predicate run. Fieldwork admission uses the original benchmark adapter: observed puzzle-line material/mate support and connected episodes, not full Stockfish-backed mistake classification. It also retains prior verified collection extensions. These columns are deliberately different measurements.

The 12,000 incidences contain 999 v4 admission disagreements versus 2,260 in v3.1. Raw upstream has 275 disagreements. This is not precision; tags related to the reused generator cannot independently validate it. No ordinary false-positive metric is inferred from missing tags.

Remaining restrictions are visible: defender removal still reaches only 78.7% after admission, pin 86.1%, and discoveredCheck 66.0%. The last theme excludes double check in both the projection and upstream single-discovery predicate. Underpromotion also differs: upstream rejects rook/bishop mating underpromotions while the application projects any admitted nonqueen promotion. No rule was changed to improve these figures.

Reports live in ignored data/lichess-upstream/comparison-v4-final-seed0-1000: report.json, report.md, comparisons.jsonl and failures.jsonl. The standalone command in LICHESS_BENCHMARK.md reproduces the comparison from frozen samples. It streams records, preserves baseline context, validates counts and exports raw witnesses alongside current admission windows.

## Source availability

Original Fieldwork licensing is unchanged. NOTICE.md explains the combined GPL/AGPL source offer. npm run build and npm run dev prepare a Git-listed public-source snapshot; Settings links the ZIP served locally through the existing assets mount. Private data, environment secrets, dependencies and untracked files are excluded. Stage new public files and regenerate after source changes; exported snapshots also rebuild from their file manifest.

Final application verification: 280 backend/native/API tests passed; 39 Playwright tests passed with one intentional phone-only desktop skip; migration preservation, repository Ruff and production build passed. See VERIFICATION.md for deployment status and the mobile control regression caught and fixed during testing.
