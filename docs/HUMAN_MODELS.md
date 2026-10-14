# Human move evidence

Fieldwork can run a pinned Maia-3 **79M** policy model alongside Stockfish. It
describes human-like choices; it does not evaluate chess truth or assign grades.
The supported checkpoint has an explicit AGPLv3 declaration. Smaller research
models remain unsupported until their weight licensing is clarified; see
[Pinned upstream and terms](#pinned-upstream-and-terms).

## Explicit setup

The Docker image includes the CPU runtime, but **no weights**. Normal startup,
signup, browsing and review never download a model. Review remains usable with
Stockfish alone. To opt into model evidence, run once on the host:

```sh
docker exec fieldwork python -m trainer.human_models.setup
docker exec fieldwork python -m trainer.human_models.setup --verify-only
```

In Unraid use the container Console and omit `docker exec fieldwork`. The setup
command acquires the pinned 316 MB checkpoint into `/data/models/maia3-79m.pt`,
checks size and SHA-256, and atomically publishes it. Keep `/data` on persistent
storage. A verified existing file is reused with no network. A corrupt existing
file is rejected, never silently replaced. An administrator can move that file
aside and run setup again. Model files are reproducible assets; private games,
reviews and preferences remain in the single SQLite database.

For a source installation, activate the application's Python environment:

```sh
python -m pip install --no-deps torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu
python -m pip install -c requirements.lock -c requirements-human-cpu.lock -e '.[human]'
python -m trainer.human_models.setup
```

Source installs default to `data/models/maia3-79m.pt`; `HUMAN_MODEL_PATH` overrides
it. Setup needs HTTPS access to the pinned Hugging Face repository. Once cached,
inference and saved reviews work offline. To provision an offline host, run setup
on a connected installation, transfer the verified file, and run `--verify-only`.

## Resources and readiness

`HUMAN_MODEL_ENABLED=true` permits inference when the file/runtime exist; `false`
disables new inference. Defaults are CPU, two threads and **one resident worker
for the entire host**, shared by all accounts. No process or Torch memory is
allocated at application startup; first inference verifies and loads the file.
The CPU benchmark measured roughly 0.85 GB peak process memory and 62–83 ms warm
policy latency for 79M on the tested machines. Hardware and thread budgets matter.
The CPU image is roughly 1.6 GB on disk versus the pre-Maia image's 403 MB;
checkpoint storage is additional. These are measured baselines, not guarantees.

Final combined validation reviewed 114 synthetic plies with native Stockfish,
Maia and default refinement in a network-disabled CPU container. Its cgroup peak
was 1.26 GiB including child processes and charged filesystem cache; Docker
reported 1.6 GB disk usage / 376 MB content size. A resident worker, engine counts,
parallel reviews and other host workloads change memory requirements. The large
CPU dependency layer is cached separately from application/coach-writing changes.

`HUMAN_MODEL_WORKERS` (1–4) multiplies model memory; `HUMAN_MODEL_THREADS` (1–16)
sets threads per worker. Budget these alongside Stockfish. A bounded queue and
`HUMAN_MODEL_TIMEOUT` (30 seconds, 1–120) cover slot waits and worker I/O/inference.
Cancellation terminates the affected worker and releases its slot. Failures use
a 60-second retry cooldown, preserve completed Stockfish reports, and expose a
generic unavailable status. Shutdown reaps all children and transport threads.

Authenticated `GET /api/human-model` reports disabled, not configured, unchecked,
ready or unavailable separately from Stockfish health. It performs no download,
hashing, inference or Torch import. Completed game reviews can acquire missing or
outdated human evidence on reopening without rerunning their Stockfish baseline.
Cached evidence remains readable if the model is later unavailable.

Optional CUDA requires a compatible Torch 2.8.0 CUDA runtime, host GPU support and
`HUMAN_MODEL_DEVICE=cuda`. The image ships only the CPU Torch build. In Docker,
give the container the GPU (see the commented `deploy` block in `compose.yaml`;
the host needs the NVIDIA Container Toolkit) and set `HUMAN_MODEL_DEVICE=cuda`. On
its first start with that setting, the entrypoint downloads Torch 2.8.0 for CUDA
12.8 (about 3 GB to download, 6.4 GB on disk, at the image's locked dependency versions) into
`/data/runtime/torch-2.8.0-cu128` and puts it ahead of the CPU build; later starts
reuse it. CPU containers download nothing. Outside Docker, install the CUDA Torch
wheel yourself; do not apply the CPU Torch pin to that environment.

On a GPU, a game review sends all of its positions to Maia in batches of 32 before
the Stockfish pass. On CPU the forward pass itself is the cost (batching measured
only about 1.5x faster), so reviews keep scoring move by move alongside the
Stockfish searches. Device and
runtime identity invalidate inference caches. CPU is fully supported; there is
no automatic GPU requirement or silent CPU/GPU switch.

## Pinned upstream and terms

Inference code is [CSSLab/maia3, commit 1e13597](https://github.com/CSSLab/maia3/tree/1e13597c42d4858b7cfd7cfdae01e297263364b2),
AGPL-3.0. Model revisions, filenames, byte counts and SHA-256 digests are in
`backend/trainer/human_models/manifest.json`. The
[79M model card](https://huggingface.co/UofTCSSLab/Maia3-79M/blob/a107d6ceb7b298cb04ae1da4edffe2939858b894/README.md)
explicitly declares AGPLv3. The 5M and 23M cards label only the *paper* CC BY 4.0,
which must not be assigned to the weights, and
[upstream issue 12](https://github.com/CSSLab/maia3/issues/12) asking for
clarification had no answer when checked. So 79M is the only supported preset;
do not publish the smaller weights or the separately hosted ONNX file, whose
conversion provenance is unresolved in the same issue.

The [paper](https://arxiv.org/html/2605.19091v1#S4.SS1) trained on Lichess blitz,
dropping moves once a clock fell below 30 seconds, and reports 57.1% move-matching
accuracy for 79M on its own evaluation set. That is a published aggregate, not
Fieldwork calibration.

Fieldwork uses a narrow pinned policy adapter in a worker rather than Maia's UCI
engine (rank-only, no move probabilities) or upstream `score_moves` (which pulls
Torch and global thread settings into the calling process). The adapter matched
UCI top-20 ranks and upstream policy values within 1e-7 across all three sizes,
both colors and four conditioning pairs. That establishes fidelity, not
population calibration.

## Evidence and ownership

`HumanModels` is the host service; its provider-neutral versioned contracts live
in `trainer/human_models/types.py`. `MaiaProvider` owns bounded subprocess leases.
Only its child imports Torch and the unmodified pinned inference primitives in
`trainer/_vendor/maia3`. The narrow adapter performs one forward pass and a
complete legal-move softmax, with original history tokenization and color
mirroring. It does not read Maia's WDL/cp outputs. Strict tensor-only checkpoint
loading, code hashes, model hashes and typed policies are checked before use.

The shared `human_analyses` table stores full policy facts and requests. It has
no owner, like the Stockfish cache: when two members import the same game, the
second review reuses the first one's predictions. `scripts/clear_games.py` keeps
rows another account's review still references.
Cache identity covers full root/history/final position, mover, both actual PGN
ratings or explicit fallbacks, source/time-control domain, provider, model and
checkpoint revision, adapter revision, device, precision, Torch version, thread
count and deterministic inference settings. Worker count does not invalidate it.
Game reports reference the row and project played/best rank/probability, top five
moves, normalized entropy and top-three mass. Changing a Stockfish best move can
reuse the full distribution. Future rank-only providers may omit probabilities;
unknown values are never manufactured from rank or WDL.

Both players are conditioned separately. Maia's published domain is Lichess
blitz; Chess.com games, other speeds, missing metadata and setup-position history
are explicitly identified. Even a related-domain result is **uncalibrated**.
Policy probabilities are model outputs, never measured percentages of comparable
players. Coach selection is absent from request/cache/evidence identity.
Cold SRS schemas exclude human hints. The next layer derives
[practical difficulty and naturalness](REVIEW_INTELLIGENCE.md#practical-difficulty-and-human-naturalness) from these facts;
it still changes neither objective grades nor personality dialogue.

## Verification

Ordinary pytest uses synthetic legal policies and real bounded transport workers,
covering cache invalidation, domain/rating history, account isolation, restart,
rank-only contracts, cancellation, corrupt/missing data, blocked pipe writes and
Stockfish-only fallback. Native opt-in tests use `MAIA_CHECKPOINT_DIR` (the folder
containing `maia3-79m.pt`), and optionally `MAIA_TEST_DEVICE=cuda`. They exercise
the production worker with special moves and full history. No test downloads
weights implicitly. See [TESTING.md](TESTING.md).

The research benchmark compares methods and model sizes. It never acquires models:
download the official checkpoints at the manifest revisions, verify their hashes
and set `HF_HUB_OFFLINE=1`, then:

```sh
python scripts/benchmark_maia.py --model 79m --checkpoints data/maia-benchmark/models --method isolated --output data/maia-benchmark/79m-isolated.json
MAIA_CHECKPOINT_DIR=data/maia-benchmark/models python -m pytest -q backend/tests/test_maia_feasibility.py
```

Methods are `uci`, `direct`, `policy` and `isolated`; sizes are `5m`, `23m` and
`79m`. `MAIA_TEST_MODEL=79m` selects the supported preset for native tests, and
`--device cuda --method policy` measures a GPU in a matching CUDA environment.
