# Coach revamp implementation ledger

Branch: `codex/coach-revamp`, based on `main` at `ddf1925`.

## Scope and decisions

- The supplied `fieldwork_coach_cast_bible.md` is preserved verbatim in
  [COACH_CAST_BIBLE.md](COACH_CAST_BIBLE.md). The accompanying request calls it
  `_v2`; the supplied file plus the explicit request define this implementation.
- Target: 13 retained + 17 new selectable coaches, one ordered production picker,
  behavior-led factual dialogue, 20 expressions with four valid idles per coach,
  and developer-only full-cast comparison/animation controls.
- Preserve objective evidence, grading, cold SRS gating, account ownership,
  reaction timing, 500–1000ms idle gaps and existing motion preference overrides.
- Retired saved IDs map on read without rewriting rows: `dog-sunny` → `dog-puppy`;
  `cat-tabby` and `cat-calico` → `cat-kitten`. Unknown IDs retain Storyteller fallback.
- No push or merge is authorized for this work.

## Work and validation

- Current: integrated cast, behavior composition and motion are implemented;
  independent safety review and full browser verification are in progress.
- Backend preference regressions reproduced: 12 failed before the fix. Focused
  coach/motion suite: 57 passed afterward; targeted Ruff and generated contracts
  checked. Full backend: 618 passed, three optional Maia skips; the separate
  cached/offline CPU Maia run passed all three skipped native checks.
- Ruff, formatting, exported API contracts, dependency consistency and fresh
  migration upgrade/check passed. No schema change is necessary.
- Production picker browser tests: 8 passed across desktop/mobile, including
  all 30 selections, reload, retired aliases and narrow layouts.
- Artwork contact sheets inspected at actual portrait sizes. Independent review
  confirmed all 2,400 configured idle slots have matching articulation targets.
- Remaining: finalize dialogue safety refinements, complete all browser suites,
  production build and fresh Docker smoke; permanent documentation and ledger removal.

## Completed commits

- `67a6c8c`: preserve the owner brief and implementation checkpoints.
- Next verified unit: account preference contract, explicit retired aliases,
  generated API types and backend persistence regressions.

## Follow-ups / blockers

- No owner blocker. Visual distinctness and blind dialogue comparison require
  actual application/studio inspection after integration.
