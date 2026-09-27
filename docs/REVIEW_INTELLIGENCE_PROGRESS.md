# Review intelligence implementation ledger

Current checkpoint: Milestone 1 verified; Milestone 2 is next.

## Baseline

- Starting commit: `ea4ea5ff01d84d4bd2ecb931b0743a6a5190c` (matches the supplied plan).
- Initial tree: only the owner-supplied plan, now preserved unchanged in this directory.
- Actual registry: 16 selectable identities, generated from the shared coach catalogue.
- Alembic head: `ab35a86cd472`; 34 application tables. One database, owned account rows.
- Stockfish and Docker are available locally. Normal tests do not require Maia.
- Full-game review uses deep Stockfish MultiPV=2 plus a restricted played-move search when needed. Preserve this baseline.

## Completed checkpoints

Milestone 0: `cc57e0d6467ef4a24a93b8efe3ab4c4f2535e8d5` — audit, specification,
authority documentation, synthetic corpus and native baseline harness.

Validation actually run:

- Existing backend suite: 440 passed (two existing TestClient dependency warnings).
- Added corpus/measurement/native-cache tests: 4 passed.
- Production frontend build, OpenAPI equality and TypeScript negative contracts passed.
- Main desktop/mobile browser suite: 101 passed, 3 intentional viewport skips.
- Account browser suite: 2 passed. Coach studio: 16 passed using the existing
  confirmed checkout preview on port 5174; ordinary studio config initially refused
  its occupied port, so a disposable ignored config reused that preview.
- Full backend/scripts/migrations Ruff lint and format checks passed.
- One/four-worker native benchmark: 4.319/1.236 seconds for 12 positions;
  cached repeats 0.231/0.240 seconds with equal candidate output. See permanent
  architecture document for hardware, settings and limits of these measurements.
- Diff whitespace checks pass excluding the supplied spec's original intentional
  Markdown hard-break spaces, preserved verbatim.

Milestone 1: pinned Maia feasibility benchmark and integration decision complete;
commit SHA will be recorded at the next boundary.

- Compared standard UCI, upstream Python and complete-policy adapters for 5M/23M/79M.
  Exact repeated policies; top-20 ranks and probabilities match upstream for all
  12 positions × four conditioning pairs. No WDL/cp used as move probabilities.
- Native parity/failure/history/special-move tests passed with 5M CPU, 79M CPU and
  79M CUDA. Normal test environment explicitly skips native coverage without opt-in.
- All three cached models worked in Linux containers with networking disabled.
- Measured startup, warm latency, memory, acquisition, two-worker contention and
  actual image size. CUDA also measured; CPU remains default. Full results/limits
  and reproducible commands are in `MAIA_FEASIBILITY.md`.
- Selected a narrow pinned adapter in one resident host worker; 79M supported
  initially because its card explicitly declares AGPLv3. Smaller weight licensing
  remains a non-blocking upstream follow-up; benchmarks alone do not authorize
  production redistribution of those weights.
- Source hashes and checkpoint hashes are validated; safe tensor-only strict loading.
- Final focused normal suite: 8 passed, 2 explicit opt-in native skips; native
  parity tests separately passed for the supported 79M on CPU and CUDA. Full Ruff
  lint/format and whitespace checks passed. The bounded process/source-hash check
  also passed in a network-disabled Linux container.
- A cached Docker image export hit a missing BuildKit parent snapshot. Rebuilding
  only the disposable test image with `--no-cache` resolved it; no global pruning,
  host restart, deployment change or owner action was needed.

## Decisions / follow-ups

- Keep the existing separate development-only coach process. New diagnostics must not enter production navigation.
- Authority boundaries and repeatable benchmark commands live in `REVIEW_INTELLIGENCE.md`.
- No pushes or deployment changes are authorized for this implementation.
- No blocker identified.
