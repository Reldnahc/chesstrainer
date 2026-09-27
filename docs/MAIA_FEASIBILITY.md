# Maia feasibility and integration decision

Milestone 1, measured on 2026-09-27. These are engineering measurements, not a
new validation of Maia's human move-matching accuracy.

## Pinned upstream and terms

Inference code: [CSSLab/maia3, commit 1e13597](https://github.com/CSSLab/maia3/tree/1e13597c42d4858b7cfd7cfdae01e297263364b2),
AGPL-3.0. Model revisions, filenames, byte counts and SHA-256 digests are recorded
in `scripts/review_benchmark/maia_pins.json`; all three downloaded files matched.

| Model | Model revision | Checkpoint bytes |
|---|---|---:|
| 5M | b6559de2398d7140b985f28fd2c19fb5e47ddabe | 20,968,049 |
| 23M | 51a0145a8178046f7de23119160b136672deeb2b | 91,799,307 |
| 79M | a107d6ceb7b298cb04ae1da4edffe2939858b894 | 315,651,851 |

The [79M model card](https://huggingface.co/UofTCSSLab/Maia3-79M/blob/a107d6ceb7b298cb04ae1da4edffe2939858b894/README.md)
explicitly declares AGPLv3. The smaller cards refer elsewhere for code/weight
licensing and label the *paper* CC BY 4.0; that paper license must not be assigned
to the weights. [Upstream issue 12](https://github.com/CSSLab/maia3/issues/12)
asks for weight/license clarification and had no maintainer reply at inspection.
Therefore the production preset will initially be **79M**, whose card supplies an
explicit license and whose CPU cost is practical here. The 5M/23M measurements
remain developer research; do not publish those weights or offer them as supported
production presets until their terms are explicit. This is a bounded alternative,
not a blocker for the project. Do not use the separately hosted ONNX file: its
conversion provenance is unresolved in the same issue.

The [paper, section 4.1](https://arxiv.org/html/2605.19091v1#S4.SS1) describes
Lichess blitz training and filtering moves once a clock falls below 30 seconds.
Its reported move-matching accuracy is 55.4%, 56.6% and 57.1% for 5M, 23M and 79M
on its evaluation set. These are published aggregate results, not Fieldwork
calibration. Chess.com ratings, rapid games, missing history/ratings, arbitrary
PGNs and time trouble require explicit domain qualification. A model policy
probability is never a measured percentage of players at a Fieldwork user's rating.

## UCI, direct Python and a narrow adapter

| Option | Benefit | Cost / limitation |
|---|---|---|
| Standard UCI subprocess | Isolation; established lifecycle/timeout tooling | Ranked top-N only; no move-policy probability in standard output; extra candidate value-head passes |
| Upstream Python `score_moves` | Actual top-20 policy values available | API process acquires Torch/global thread configuration; still computes unused candidate WDL |
| Narrow pinned policy adapter in a worker | Exact complete legal distribution; one forward pass; isolates Torch and global state | Small versioned adapter requires upstream parity tests and explicit process supervision |

Choose the third option. The prototype uses the pinned model, tokenizer, history
padding, move vocabulary and side-to-move mirroring. It masks illegal moves and
softmaxes the policy logits without sampling, temperature scaling, or top-p
truncation. It does not return the value head. Loading uses `weights_only=True`,
strict state-dict keys and a pinned file hash. A missing/corrupt checkpoint fails
locally before any attempt to acquire a model.

Upstream UCI's `score cp` is a compatibility transform of its human WDL prediction.
Neither is objective evaluation, neither gives move probability, and neither is
read by the benchmark's UCI consumer. The UCI result is explicitly rank-only.
Across all 12 synthetic positions, both colors and four self/opponent conditioning
pairs, all three adapter presets matched UCI top-20 ranks and upstream Python
policy values within 1e-7. Repeated inference in each measured process was exactly
stable. The corpus also verifies that identical layouts with different histories
can produce different predictions. These checks establish adapter fidelity, not
population calibration or reliable tactical judgment by Maia.

## CPU and installation measurements

Windows 11 / Python 3.12.10 / 24 logical CPUs; Torch 2.8.0+cpu, NumPy 2.2.6,
two intra-op threads and one inter-op thread, FP32, no AMP, no compilation.
Each run used 12 positions × four conditioning pairs, twice. Times below are
warm medians from the second pass; startup includes import/loading, while a warm
process remains resident between requests. Windows file-system cache was not
purged, so these startup figures are not physical-disk cold-start guarantees.

| Model | UCI ms | Upstream Python ms | Isolated policy ms | Worker startup s | Worker load peak MiB |
|---|---:|---:|---:|---:|---:|
| 5M | 108.32 | 121.68 | 10.53 | 1.227 | 238.9 |
| 23M | 364.32 | 355.60 | 26.73 | 1.421 | 374.4 |
| 79M | 1120.20 | 1124.66 | 83.25 | 1.646 | 801.7 |

Worker memory above is peak **at readiness**, including transient state-dict load;
direct 79M runs reached 836.9 MiB including candidate inference. Measurements are
not host limits or a claim that every machine meets these latencies. Two independent
23M workers, two threads each, completed 192 combined requests plus startups in
4.857 s; warm medians were 33.90/34.34 ms, versus 26.73 ms alone. This supports
starting with one shared resident worker, not one copy per account. More workers
trade memory for throughput and must remain explicitly bounded.

Linux Docker runs used the same cached checkpoints and `--network none`:

| Model | Isolated warm median ms | Startup s | Worker load peak MiB |
|---|---:|---:|---:|
| 5M | 8.61 | 1.548 | 261.4 |
| 23M | 20.92 | 1.753 | 398.9 |
| 79M | 62.43 | 3.220 | 825.6 |

All three completed with repeated output equality and no network. Explicit first
checkpoint acquisition took 2.34/8.63/31.12 s locally; network speed varies. These
downloads happened before inference, not during a review.

The existing local Fieldwork image reports 403 MB disk usage in Docker's image
listing; adding CPU Torch, NumPy and the pinned inference code reports 1.6 GB.
`docker image inspect` reports content sizes 128,416,076 and 375,184,521 bytes,
respectively; these are different Docker accounting measures, not interchangeable
with resident RAM. Checkpoints are outside both images. Windows' CPU Torch wheel
download was 590.7 MiB and its installed package used approximately 3.15 GB;
the Linux CPU wheel download was 183.9 MB. Do not infer Linux image cost from the
Windows package or install the default CUDA dependency set into the CPU image.

Optional CUDA was also exercised in a separate environment on the available
RTX 4070 Ti (12 GB, driver 591.59), Torch 2.8.0+cu128, FP32/no AMP and deterministic
algorithms with `CUBLAS_WORKSPACE_CONFIG=:4096:8`. Warm policy medians were
12.71/11.87/11.42 ms for 5M/23M/79M; peak tensor allocations were 53.5/179.0/603.2
MiB. Repeats were exact on that device. The 79M native parity/special-move/history
tests passed on both CPU and CUDA. Cross-device bitwise equality is not promised.
The optional CUDA wheel alone downloaded 3.2 GiB, strengthening the decision to
keep the default Docker image CPU-only and GPU installation explicitly opt-in.

## Production direction for Milestone 2

- One provider-neutral versioned human-evidence result, with explicit provider,
  code/model/hash/adapter provenance. Human WDL is unnecessary for the first provider.
- One long-lived isolated process per host by default, two CPU threads, bounded
  admission and a finite request deadline. Cancellation can kill/restart a stuck
  worker; no account gets its own permanent process. Workers never own the database.
- CPU is the default. Any optional CUDA configuration must be explicit, validated,
  and part of evidence/cache identity; no GPU is required for normal installation.
- Include CPU-only dependencies in the self-host image to preserve one-container
  installation. Model acquisition remains a separate explicit setup command into
  the persistent model directory. Startup/review must never download implicitly.
- Use 79M with the pinned SHA above as the supported preset. The user-facing
  review remains fully functional when human evidence is disabled or unavailable.
- Cache complete root/history, actual self/opponent conditioning ratings and their
  fallback provenance, source/time-control/domain context, model and adapter revision,
  dtype/device and inference settings. Worker count is scheduling, not identity.
- Keep all objective evaluation and move grading with Stockfish and Fieldwork.
  Missing human evidence means abstention, not failed review or invented probabilities.

## Reproduction and validation

Use a separate environment. Install CPU Torch from its official CPU index, NumPy
2.2.6, the normal Fieldwork requirements and the pinned upstream checkout (without
allowing it to replace the CPU Torch wheel). Acquire the official checkpoint files
at the manifest revisions, verify hashes, and set `HF_HUB_OFFLINE=1` before running:

```sh
python scripts/benchmark_maia.py --model 79m --checkpoints data/maia-benchmark/models --method isolated --output data/maia-benchmark/79m-isolated.json
# Repeat with methods uci/direct/policy and sizes 5m/23m for research comparisons.
MAIA_CHECKPOINT_DIR=data/maia-benchmark/models python -m pytest -q backend/tests/test_maia_feasibility.py
```

`MAIA_TEST_MODEL=79m` selects the supported preset for native tests;
`MAIA_TEST_DEVICE=cuda` enables optional GPU coverage. In a matching CUDA environment,
pass `--device cuda --method policy` for GPU measurements. The installed upstream
source files are hash-checked against the manifest before inference, preventing a
different package revision from silently inheriting the recorded provenance.

The benchmark never acquires models. It requires an explicit checkpoint directory,
rejects existing output files, verifies hashes and writes results only when requested.
Generated reports/model files/environments remain ignored. Ordinary pytest imports
no Torch and explicitly skips the two native tests unless the opt-in runtime/cache
is supplied. Native checks cover parity, normalized legal distributions, black-side
mirroring, special moves, independent Elo inputs, real history, and repeatability.
The marker is `maia`. Production runtime tests in Milestone 2 must additionally
cover deadlines, bounded contention, cancellation, readiness and persistence.
