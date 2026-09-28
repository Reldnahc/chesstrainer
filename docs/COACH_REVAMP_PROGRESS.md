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

- Current: cast/registry/persistence and unified picker; artwork and dialogue
  implementation in separate owned modules, followed by integrated verification.
- Backend preference regressions reproduced: 12 failed before the fix. Focused
  coach/motion suite: 57 passed afterward; targeted Ruff and generated contracts
  checked. Not yet committed with the complete selectable-registry slice.
- Upcoming checkpoints: coherent cast/picker; behavior composition and cast
  writing; complete idle pools and developer previews; full validation/visual
  review, permanent documentation and removal of this temporary ledger.

## Completed commits

- None yet beyond the recorded baseline.

## Follow-ups / blockers

- No owner blocker. Visual distinctness and blind dialogue comparison require
  actual application/studio inspection after integration.
