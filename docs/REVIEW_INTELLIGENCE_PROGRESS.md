# Review intelligence implementation ledger

Current checkpoint: Milestone 0 verified; Milestone 1 is next.

## Baseline

- Starting commit: `ea4ea5ff01d84d4bd2ecb931b0743a6a5190c` (matches the supplied plan).
- Initial tree: only the owner-supplied plan, now preserved unchanged in this directory.
- Actual registry: 16 selectable identities, generated from the shared coach catalogue.
- Alembic head: `ab35a86cd472`; 34 application tables. One database, owned account rows.
- Stockfish and Docker are available locally. Normal tests do not require Maia.
- Full-game review uses deep Stockfish MultiPV=2 plus a restricted played-move search when needed. Preserve this baseline.

## Completed checkpoints

Milestone 0: audit, durable specification, authority documentation, legal synthetic
corpus and native baseline harness completed. Its commit SHA is recorded at the
next checkpoint (a commit cannot contain its own SHA).

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

## Decisions / follow-ups

- Keep the existing separate development-only coach process. New diagnostics must not enter production navigation.
- Authority boundaries and repeatable benchmark commands live in `REVIEW_INTELLIGENCE.md`.
- No pushes or deployment changes are authorized for this implementation.
- No blocker identified.
