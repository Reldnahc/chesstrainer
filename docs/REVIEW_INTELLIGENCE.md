# Review intelligence

The production human-evidence boundary is described in
[HUMAN_MODELS.md](HUMAN_MODELS.md): one host-shared isolated Maia provider,
account-owned policy facts, explicit setup and independent Stockfish authority.
Its first implementation preserves the baseline below without changing grades
or dialogue. Current schema and runtime configuration live in DATA_MODEL.md and
CONFIGURATION.md; this document's baseline measurements remain historical.

[Practical difficulty](PRACTICAL_DIFFICULTY.md) documents the versioned derivation,
fixed-probe inspection and limits of human naturalness/difficulty bands. The
`review_intelligence` package derives semantic facts only; raw chess and human
provider authorities remain unchanged.

The durable implementation specification is
[REVIEW_INTELLIGENCE_PLAN.md](REVIEW_INTELLIGENCE_PLAN.md). This document records
implemented architecture and measured decisions, not promises of completed features.

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

## Baseline audit (2026-09-27)

The checkout matched specification commit `ea4ea5f`. The production registry is
derived from `frontend/src/coach/studies/catalog.ts`, currently 16 selectable
identities. The studio is a separate development-only Vite process. The current
schema is `ab35a86cd472`, with 34 application tables, one SQLite file and explicit
account ownership. No second evidence database or per-account resident engine
service is needed.

API response contracts live in `trainer/contracts`; generated frontend types and
the backend OpenAPI snapshot must be regenerated together when contracts change.
No human-model integration exists at this checkpoint. Normal tests and serving
saved reviews require neither Torch nor a model checkpoint.

The subsequent feasibility investigation and production integration decision are
recorded in [MAIA_FEASIBILITY.md](MAIA_FEASIBILITY.md), including exact upstream
revisions, actual probabilities versus UCI rank-only behavior, domain limits,
model/file sizes and CPU/offline Docker measurements.

## Repeatable benchmark

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

The same corpus and portable measurement helpers will support isolated human-model
benchmarks. Model cold load, warm inference, concurrency, independent-run output
stability, cached/offline behavior, model bytes and Docker image size must be
measured separately; unavailable measurements must be explicit, never zero-filled.

Initial measurement: Stockfish 18, Windows 11, Python 3.12.10, 24 logical CPUs,
one native thread and 64 MB hash per process, depth 16 / 0.8 seconds, no node cap.
Twelve positions took 4.319 s with one worker and 1.236 s with four (search and
evidence generation, excluding startup). Startup took 0.259 / 1.022 s; second
cached passes took 0.231 / 0.240 s and exactly retained candidate output. Each
configuration made 16 native searches and 20 cache hits across the two passes.
Python peak RSS was 82.9 / 84.7 MiB; this is not total host engine memory. These
small synthetic probes do not establish general speedups or evaluation quality.
