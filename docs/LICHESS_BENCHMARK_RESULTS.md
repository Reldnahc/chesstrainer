# Initial Lichess benchmark: September 13, 2026

This is the first external positive-theme **line-detector agreement** baseline, not a precision measurement or a full mistake-classifier accuracy result. No production rules were changed in response to it. The [methodology and commands](LICHESS_BENCHMARK.md) define the adapter and mappings.

## Reproduce

- Production rule version: 3.1; benchmark implementation commit: 44b3c9a.
- Adapter/mapping version 1; sampling independent-reservoir-v1; seed 0; 1,000 requested rows per eligible theme.
- Full input: 6,100,952 rows, 304,429,328 compressed bytes; no malformed CSV rows.
- Input SHA256: 95fd454bec9efe8f940d5863d5db4c57474f281a865834997bd8cb5d6a149bb9.
- Official [Lichess puzzle download](https://database.lichess.org/#puzzles), retrieved September 13, 2026. HTTP last-modified: September 9, 2026, 17:40:14 UTC. The download URL is mutable: preserve the input hash/file when comparing runs.
- Windows; Python 3.12; chess 1.11.2; optional zstandard 0.25.0. Completed in 40.688 seconds on this host, including the complete streaming scan. This is one run, not a performance guarantee.

```sh
python scripts/benchmark_lichess.py --input data/lichess-benchmark/lichess_db_puzzle.csv.zst --output data/lichess-benchmark/baseline-v3.1-seed0-1000 --samples-per-motif 1000 --seed 0
```

Choose a new output directory when repeating the command. No backend, native engine, database or model connection was used. Reports and both corpora remain locally under ignored data/lichess-benchmark/baseline-v3.1-seed0-1000; only this aggregate summary is committed. report.json preserves production and harness source hashes and the actual default detector parameters.

## Per-theme results

Every theme sampled and successfully reconstructed **1,000 positives**, with **zero skips**. Agreement is detected / reconstructed. Initial episode uses that same denominator but requires recognition from the original solver root. There are 12,000 theme-puzzle incidences, spanning 11,978 unique puzzle IDs.

| Lichess theme | Relationship | Candidates | Detected / 1,000 | Agreement | Initial episode | Missed |
|---|---|---:|---:|---:|---:|---:|
| fork | Approximate | 781,805 | 713 | 71.3% | 68.7% | 287 |
| pin | Approximate | 366,072 | 397 | 39.7% | 35.4% | 603 |
| skewer | Approximate | 134,761 | 879 | 87.9% | 79.8% | 121 |
| capturingDefender | Approximate | 39,866 | 638 | 63.8% | 58.6% | 362 |
| backRankMate | Approximate | 206,205 | 992 | 99.2% | 99.2% | 8 |
| promotion | Approximate | 146,748 | 979 | 97.9% | 44.2% | 21 |
| underPromotion | Approximate | 1,123 | 970 | 97.0% | 67.2% | 30 |
| discoveredAttack | Approximate | 308,429 | 814 | 81.4% | 78.2% | 186 |
| discoveredCheck | Approximate | 108,796 | 659 | 65.9% | 59.9% | 341 |
| doubleCheck | Exact event | 31,924 | 940 | 94.0% | 89.0% | 60 |
| hangingPiece | Approximate | 222,072 | 992 | 99.2% | 99.2% | 8 |
| deflection | Approximate | 264,140 | 767 | 76.7% | 72.0% | 233 |

Exact group: macro/micro **94.0%** (double check only). Approximate group: macro/micro **80.0%** across 11 themes. Equal per-theme denominators make macro and micro equal here. Micro is a pool of overlapping theme-puzzle incidences; it is not unique-puzzle accuracy. No combined headline score mixes the semantic groups.

The rare underPromotion theme has only 1,123 candidate rows; this sample covers most of that snapshot. Do not interpret it as 1,000 independent themes or as an independent estimate from the broader promotion family.

## What the failure corpus reveals

All **2,260 missed positives** are saved in failures.jsonl with initial FEN, setup/solution, original themes, expected and actual motifs, raw production witnesses, translated frames/plies and window diagnostics. samples.jsonl preserves all 12,000 incidences, including successes. Corpus counts were reconciled against the report, and every witness move/actor/frame was checked for coordinate consistency.

- Pin agreement is 39.7%, with 603 misses. This exposes a substantial gap between the exported theme and this detector entry point. The detector's narrower absolute-pin witnesses and omitted native relative-pin probes are documented differences, not an adjudication of each miss.
- Fork (71.3%), capturingDefender (63.8%) and discoveredCheck (65.9%) also warrant inspection of specific witnesses before proposing rule changes. Misses can reflect narrower semantics, incomplete solution evidence, outcome gates or a legitimate blind spot.
- Promotion agreement changes from 97.9% anywhere in solver episodes to 44.2% from the initial episode. The large gap demonstrates why solution recognition cannot be passed off as correct attribution to an original game mistake.
- 331 incidences have no solver window with visible material gain or terminal mate and remain misses. The other 1,929 misses have some visible outcome support but do not emit the expected mapped witness. These are mechanical adapter reasons, not expert labels of the causes.
- 10,312 incidences have at least one material-supported window whose production endpoint is unsettled. That count does not say that every matching witness depends on that window, but it shows why the benchmark's observed line gains cannot substitute for production's settled/native evidence.

Only double check has an exact **event** mapping; it still inherits the adapter's outcome gates. Fifty of its 60 misses have no visible outcome support. No theme rules, gates, sample filters or skips were adjusted to improve these numbers.

## What remains unknown

Lichess tags are external automated/player-refined labels, and Fieldwork's earlier research examined the upstream tagger. This is stronger evidence than owner spot-checking, but correlated assumptions and imperfect tags remain possible.

Absent tags are **not negative ground truth**. These numbers establish neither precision nor false-positive rates, full-classifier recall, correct psychological diagnosis, strategic accuracy or exact transfer to real user games. Native counterfactual queries and best-versus-actual scores are deliberately absent.

Preserve this baseline as development evidence. Before improving a rule, inspect reproducible disagreements and verify that the proposed change fixes a defensible chess witness rather than merely fitting these samples. Use fresh held-out data for subsequent claims; the separate next layer remains blinded human review of stratified positive findings to estimate precision.

## Artifact fingerprints

Full generated artifacts and the dataset are not committed. These hashes identify the retained local run:

| Artifact | SHA256 |
|---|---|
| report.json | 10c018c5129168246be7a79d367aafff8778bcc0a9c3058faddcaae60f8c0cdd |
| report.md | 36ba956528ea251e775536f9f4314b7f25829234c60ae927d9945b52a74abef9 |
| samples.jsonl | e44fad1c330ce878f3b2ad9f0adcbe01685129a2ae6a54b73325938b5a86fef0 |
| failures.jsonl | 13591e56d832dc6088ee851e8b5301339e09f68024291b54c7a92aae11cf59c6 |
