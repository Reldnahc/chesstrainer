# Review intelligence implementation ledger

Current checkpoint: Milestone 2 verified; Milestone 3 is next.

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

Milestone 1: `fa31d2f79bc23fdaff91293d3caa2f40932bb376` — pinned Maia feasibility
benchmark and integration decision.

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

Milestone 2: production human-evidence layer complete; commit SHA will be recorded
at the next boundary.

- One provider-neutral typed policy boundary, pinned narrow 79M adapter, bounded
  host subprocess pool, cancellable/deadline-bounded pipe I/O, cooldown/restart,
  independent readiness, explicit atomic hash-verified setup, CPU Docker runtime.
- Both-color ratings, full history, domain/fallback provenance, account-owned
  SQLite policy cache and saved report references. Migration `39c94b22a711`,
  35 application tables. Refresh reuses baseline Stockfish results; changing coach
  does no analysis. Workers alone do not invalidate semantic cache identity.
- Full backend run: 466 passed, 3 explicit native Maia opt-in skips; two existing
  TestClient dependency warnings. After final worker guard/ownership checks,
  focused evidence/transport suite: 15 passed, 1 explicit native skip.
- Native supported 79M CPU production and upstream parity suite: 11 passed.
  Includes full history, castling/en passant/promotion, exact repeat, subprocess
  teardown and absence of new Torch imports in the API process.
- Production build/API/type checks pass. Full desktop/mobile run initially had
  99 passes, 3 viewport skips and 2 obsolete reopen-request assertions. Updated
  those assertions and added a refresh cursor regression: targeted game suite had
  17 passes and one mock idempotence failure, then both corrected progress tests
  passed. No outstanding browser failures. Account browser suite: 2 passed.
- Built the actual Dockerfile CPU image. Disposable local and HTTPS-account
  fresh installs/restarts/native Stockfish reviews passed. Production Maia plus
  Stockfish review, persisted cache restart and coach independence passed with
  `--network none` and a read-only cached model (`scripts/smoke_human.py`).
- Docker initially hit ACLs walking local pytest cache; a public-source export
  built successfully without changing host permissions or production deployment.
- Critical review added bounded writer transport (hung pipe writes also cancel),
  avoided SQLite transactions across native inference, verified private foreign
  keys, and normalized source hashes to upstream Git LF bytes for Windows/Linux.
- Ruff lint/format and diff whitespace checks pass. No weights/binaries/private
  PGNs or databases enter source commits. Setup/resource docs: HUMAN_MODELS.md.

- Keep the existing separate development-only coach process. New diagnostics must not enter production navigation.
- Authority boundaries and repeatable benchmark commands live in `REVIEW_INTELLIGENCE.md`.
- No pushes or deployment changes are authorized for this implementation.
- No blocker identified.
