# Review intelligence implementation ledger

Current checkpoint: Milestone 8 verified; Milestone 9 is next.

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

Milestone 2: `0bfa31b209dda119a5cc4b0a3c3fece5eb1bce03` — production human-evidence layer.

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

Milestone 3: `f9f1abfc73e74a1054b37af6baf3a3d5b44eec84` — versioned practical
difficulty and human naturalness.

- Pure semantic layer derives model naturalness separately from Stockfish quality,
  conservative best-find bands, narrow defensive resources, candidate-coverage
  lower bounds and supported witness components. Unknown/stale human evidence
  abstains. No grading or personality changes, no population percentages.
- Replayed the fixed M0/M1 corpus at four rating pairs with recorded artifact
  hashes. 48 probes yielded 38 natural, 9 challenging and 1 difficult best find.
  The one difficult result is the supported queen sacrifice at the lowest rating.
  Threshold rationale, per-rating distributions and limits: PRACTICAL_DIFFICULTY.md.
- Focused review/difficulty/human/API suite: 59 passed. Final stale-context and
  confidence checks rerun separately. Native Stockfish+79M application smoke,
  restart cache and coach-independence assertions passed with the new payload.
- Generated OpenAPI/types, production build and Ruff/diff checks pass. Derived
  assessments retain evidence IDs and a deterministic version/input digest; no
  new tables, no model rerun and no cold-SRS exposure.
- Broader empirical population calibration remains explicitly unclaimed, not a
  blocker; only coarse heuristic bands are exposed.

Milestone 4: `c9b6f0bdf74e5f8ea3e08bf9878f8752051862ad` — bounded additive investigation.

- Preserved per-move baseline, finite priority nominations, deeper/wider/restricted
  questions through existing Stockfish authority/cache/pool, 8 positions × 4
  queries by default. Interruptible active search/slot wait; resumed question
  references. Separate owned tasks, identity/depth/consistency adoption gates.
- Migration `55de0b7b8ff2`, 36 application tables. Effective-report reader and
  revision polling keep earlier moves, following comparisons and accuracy aligned.
  Saved full human policies reproject new best moves without another inference.
- Full backend: 491 passed, 3 explicit native Maia opt-in skips, two existing
  TestClient warnings. Added storage/ownership/migration checks then focused
  review/difficulty/API suite: 54 passed. Final leased-engine identity guard is
  covered by an additional focused transport test.
- Production build/API/type checks pass. Desktop/mobile review run: 18 passed,
  two new tests failed on a nonexistent test selector; corrected selector and
  both passed, including stable board bounds across an earlier-ply revision.
  Screenshots visually inspected. Account browser suite: 2 passed.
- Production planner benchmark: four of twelve synthetic positions investigated,
  grades retained, baseline JSON unchanged. Public targeted C0OA7 probe gained
  defender-removal evidence and verified mate after bishop acceptance, supporting
  Brilliant instead of Great. A second probe was not nominated; bounded coverage
  limits are explicit. Config/timings/provenance: REVIEW_REFINEMENT.md.
- Critical review added root-candidate depth floors, safe optional-query failure,
  migration preservation, cross-account FK checks and verification of the actual
  pooled search result's binary identity. No pushes or deployment changes.

Milestone 5: `f593279` — semantic events and clock context.

- Versioned coach-independent events reference Stockfish, human policy, rules,
  legal board transitions and PGN/book evidence. Positive resources, sacrifices,
  tactics, mate transitions, evaluation swings and honest human contrasts all
  have positive and abstention coverage. Objective event IDs survive human refresh.
- Valid PGN clocks now survive canonical imports. Same-player clock arithmetic
  handles increments, missing observations, invalid annotations and unsupported
  staged/delay controls conservatively; branches never inherit mainline clocks.
  Previously stripped comments cannot be reconstructed from saved Game PGNs.
- Critical review found separately searched played moves could disprove an
  only-good-move claim. Shared typed score comparison now protects both Great
  grading and practical-2 assessment. No fake centipawn mate ordering.
- Full backend: 529 passed, 3 explicit native Maia opt-in skips, two existing
  TestClient dependency warnings. Focused semantic/review suite: 104 passed;
  import/restart/branch and sync coverage after comment preservation: 36 passed.
- Native Stockfish + supported 79M application review, offline restart cache and
  coach-independence smoke passed separately. Production build, generated API,
  negative TypeScript contracts, Ruff lint/format and whitespace checks pass.
- No new database tables or production UI surfaces. Cold-SRS response tests
  explicitly exclude the added answer-revealing intelligence.

Milestone 6: `a2b944c` — deterministic positional evidence.

- Added ten supported immediate-change families, shared pin-aware defenders,
  original-piece development history and separate played/alternative facts.
  Every observation explicitly avoids a strategic value judgment; unsupported
  weak-square/bad-bishop/king-safety stories continue to abstain.
- Focused positional/events/clocks/game/human/API suite: 79 passed. After final
  history-reference and flank-king restrictions, all 12 positional tests pass.
  Production build/API/type checks and full Ruff/diff checks pass.
- Re-ran native Stockfish on the 12-position baseline corpus and inspected all
  positional output, including quiet Ruy Lopez support changes and castling.
  Strong sacrifices/mates retain higher-priority tactical/finish semantics;
  an unguarded piece is never declared lost from geometry alone.
- Rules and false-positive boundaries: POSITIONAL_EVIDENCE.md. No schema,
  grading, coach, resource-setting or production layout changes in this slice.

Milestone 7: `5783d32` — whole-game context.

- Versioned nodes/links for repeated motifs, punishment, recovery, sustained
  conversion, gradual erosion and restored support of a tracked surviving piece.
  Missing/mismatched plies and inconsistent adjacent searches break sequential
  inference. Partial counts, engine bands and PGN-result limits are explicit.
- Detail and polling share one projection; client retains refreshed context.
  No new table, searches or coach-dependent saved data. Linear linked motif
  history avoids duplicating all earlier occurrences in every relation.
- Focused context/native game/refinement/API suite: 44 passed (two existing
  TestClient warnings). Native game tests verify both-color rating selection,
  detail/poll graph equality and persisted restart behavior. Production
  build/API/type checks, Ruff and whitespace checks pass.
- Rules and caveats: GAME_CONTEXT.md. Causal king-safety-collapse narratives
  remain unsupported; supported support changes never impersonate proof of a
  tactical cause. No production dialogue change until the planned dialogue slice.

Milestone 8: conservative cross-game context complete; commit SHA will be
recorded at the next boundary.

- Shared active-evidence grouping/recurrence helpers retain Weaknesses semantics.
  Relevant learner errors can reference other owned classified games; current
  game excluded, repeated positions count once per independent game, default
  support threshold remains the actual setting (2). No practice-transfer claims.
- Context/native review/training pipeline regression: 39 passed. New history and
  adversarial accounts suite: 11 passed. Final API/native review/cold-SRS events
  suite: 44 passed. Two existing TestClient dependency warnings only.
- Production build, API/type checks, Ruff and whitespace checks pass. History
  agrees between native detail and polling; no new tables or searches. Updated
  stale data-model headline to the current 36-table/refinement migration baseline.
- Other saved games are not asserted to be earlier in playing chronology.
  Provisional items remain explicitly provisional and new users get empty history.
  Implementation boundaries: CROSS_GAME_CONTEXT.md.

## Decisions / follow-ups

- Keep the existing separate development-only coach process. New diagnostics must not enter production navigation.
- Authority boundaries and repeatable benchmark commands live in `REVIEW_INTELLIGENCE.md`.
- No pushes or deployment changes are authorized for this implementation.
- No blocker identified.
