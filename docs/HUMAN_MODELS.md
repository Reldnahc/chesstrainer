# Human move evidence

Fieldwork can run a pinned Maia-3 **79M** policy model alongside Stockfish. It
describes human-like choices; it does not evaluate chess truth or assign grades.
The supported checkpoint has an explicit AGPLv3 declaration. Smaller research
models remain unsupported until their weight licensing is clarified. See
[measured feasibility and selection](MAIA_FEASIBILITY.md).

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
Account-owned cached evidence remains readable if the model is later unavailable.

Optional CUDA requires an administrator-provided compatible Torch 2.8.0 CUDA
runtime, host GPU support and `HUMAN_MODEL_DEVICE=cuda`; the shipped image is CPU
only. Do not apply the CPU Torch constraint to that environment. Device and
runtime identity invalidate inference caches. CPU is fully supported; there is
no automatic GPU requirement or silent CPU/GPU switch.

## Evidence and ownership

`HumanModels` is the host service; its provider-neutral versioned contracts live
in `trainer/human_models/types.py`. `MaiaProvider` owns bounded subprocess leases.
Only its child imports Torch and the unmodified pinned inference primitives in
`trainer/_vendor/maia3`. The narrow adapter performs one forward pass and a
complete legal-move softmax, with original history tokenization and color
mirroring. It does not read Maia's WDL/cp outputs. Strict tensor-only checkpoint
loading, code hashes, model hashes and typed policies are checked before use.

The account-owned `human_analyses` table stores full policy facts and requests.
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
Cold SRS schemas exclude human hints. No production dialogue is changed by this
evidence-layer checkpoint.

## Verification

Ordinary pytest uses synthetic legal policies and real bounded transport workers,
covering cache invalidation, domain/rating history, account isolation, restart,
rank-only contracts, cancellation, corrupt/missing data, blocked pipe writes and
Stockfish-only fallback. Native opt-in tests use `MAIA_CHECKPOINT_DIR` (the folder
containing `maia3-79m.pt`), and optionally `MAIA_TEST_DEVICE=cuda`. They exercise
the production worker with special moves and full history. No test downloads
weights implicitly. See [TESTING.md](TESTING.md).
