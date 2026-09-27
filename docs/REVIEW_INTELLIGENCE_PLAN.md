# Fieldwork Review Intelligence, Human Modeling, and Coach Dialogue Plan

**Status:** Implementation-ready design specification  
**Prepared:** September 27, 2026  
**Baseline inspected:** `Reldnahc/chesstrainer` `main` through commit `ea4ea5ff01d84d4bd2ecb931b0743a6a41a5190c`  
**Important:** The working tree at implementation time is authoritative. Do not hard-code current counts, paths, or assumptions when the repository has evolved beyond this baseline.

## 1. Purpose

Fieldwork already has a strong local review foundation: native Stockfish analysis, persistent engine evidence, deterministic move grading, tactical evidence, opening recognition, full-game review, rated variations, weakness aggregation, FSRS practice, resumable jobs, account-scoped coach selection, and a production-ready animated coach system.

The next project is not merely “better strings” or “add Maia.” It is a **review intelligence layer** that combines objective engine truth, human move modeling, game-level context, prior evidence, and deterministic dialogue so Fieldwork can explain not only *what* happened, but *how difficult it was for a human*, *how it relates to earlier moments*, and *what matters most in the story of the game*.

Coach personality is the final presentation layer on top of that intelligence. Personality must never become a second chess-analysis system.

The target experience is that Fieldwork can distinguish statements such as:

- “This was a blunder, but the saving move was exceptionally difficult for players around your rating.”
- “This was a blunder and the natural defensive move was available; this is one worth learning from.”
- “You fixed the king-safety problem that started on move 17.”
- “This is the second fork opportunity you missed in this game.”
- “Your opponent finally gave you the chance you had been defending against, and you found the punishment.”
- “The engine’s top move is objectively best but highly unnatural at this rating; your move was the human favorite and still kept the position playable.”

Those claims must be grounded in structured evidence rather than improvised prose.

---

## 2. Existing baseline and constraints

Implementation must respect the actual architecture instead of replacing it unnecessarily.

### 2.1 Existing authorities

Fieldwork currently separates responsibilities deliberately:

- **python-chess** owns chess legality, PGN replay, board history, and move validation.
- **Stockfish** owns objective search evaluation and verified candidate lines.
- **Fieldwork policy/rules** own grading, move-quality labels, evidence gates, and weakness projection.
- **Local tactical detectors** own supported mechanism findings and abstain when evidence is insufficient.
- **FSRS** owns review scheduling.
- **Coach preferences** select presentation only.

This project extends that split rather than collapsing it.

### 2.2 Current game-review evidence

At the inspected baseline, `backend/trainer/game_review.py` already records per-move evidence including:

- best and played candidates;
- before/played analysis IDs;
- typed Stockfish score data;
- loss in centipawns where applicable;
- previous score;
- second candidate score;
- legal move count;
- sound-sacrifice evidence;
- missed-opportunity evidence;
- replay lines;
- tactical findings;
- material deltas;
- opening recognition;
- board cues;
- player rating-sensitive presentation rules.

Full-game review persists each ply separately and resumes interrupted jobs. Interactive branches use separate serialized native analysis. Preserve these strengths.

### 2.3 Current coach system

The inspected `main` has 16 selectable coaches across men, women, cats, and dogs. The registry is derived from a catalogue; account preference stores a stable coach ID. Every current coach supports the shared semantic expression system.

**Never hard-code 16.** At implementation time enumerate the actual registry and require every registered selectable coach to satisfy the personality/dialogue contract.

The expression studio is intentionally a separate loopback-only development process and is absent from the production application. That separation is a useful precedent for diagnostic tooling in this project.

### 2.4 Current voice state

There is no production voice/TTS system in the inspected repository. Repository documentation explicitly lists voice as absent.

This project must make dialogue **future voice-ready**, but must not add TTS unless a later explicit instruction changes scope.

### 2.5 Licensing state

`docs/LICENSE_TRANSITION.md` records that the earlier PolyForm Perimeter transition was closed and the owner chose to retain the existing licensing. Do not reopen or silently change that decision.

The current package metadata declares GPL/AGPL licensing because Fieldwork already incorporates GPL/AGPL components. Maia-3’s upstream repository currently uses AGPL-3.0. Before integrating it, record exact source/model provenance and preserve required notices. Do not make a legal conclusion beyond the repository’s documented licensing policy; update NOTICE/reuse documentation as required by the actual pinned dependency and model terms.

### 2.6 Deployment philosophy

Fieldwork is self-hosted and may serve one person or a small community. It can spend materially more compute per user than a mass-market SaaS product, but installation must remain understandable and failures must degrade gracefully.

The project should exploit **lavish local compute intelligently**, not waste it uniformly.

---

## 3. Non-negotiable architecture rules

### 3.1 Authority pipeline

Use this conceptual pipeline throughout the implementation:

```text
python-chess legality/history
        ↓
Stockfish objective evidence
        +
Maia human-behavior evidence
        +
Fieldwork tactical/positional/weakness evidence
        ↓
structured review intelligence / semantic events
        ↓
neutral factual dialogue intent
        ↓
selected coach personality rendering
        ↓
UI now / optional voice later
```

### 3.2 Maia is not a second Stockfish

Maia-3 models human move behavior. Its UCI WDL output represents predicted human-game outcomes for candidate lines, and the UCI centipawn field is a compatibility transformation of that WDL—not searched objective centipawn evaluation.

Maia-3's published human-emulation training data is Lichess blitz. Fieldwork may ingest Chess.com rapid/blitz and arbitrary PGNs whose rating scale and time-control domain do not match that training population. Treat cross-platform/time-control use as a domain-shifted human-likeness signal unless Fieldwork has an explicit calibration layer. Do not turn a raw conditioned probability into prose such as “37% of players at your rating find this” when the source rating/time-control is not comparable. Under domain shift, prefer wording such as “the human model considers this unusual at the selected skill band,” and carry a confidence/calibration flag through the intelligence layer. Maia's published evaluation also filters severe time-pressure positions; reduce confidence rather than overinterpreting its prediction in clock states far outside its training/evaluation regime.

Therefore:

- never replace Stockfish evaluation with Maia output;
- never average Stockfish cp with Maia cp;
- never use Maia WDL as proof that a move is objectively winning/losing;
- never let Maia directly assign Brilliant/Blunder/etc.;
- never claim a human-probability model proves what this individual user was thinking.

### 3.3 Personality never reasons about chess

Personality code must consume structured semantic facts. It may change tone, sentence rhythm, humor, directness, vocabulary, and emphasis. It may not invent mechanisms, evals, causal relationships, or player psychology.

### 3.4 Abstention beats invention

If Fieldwork cannot establish a tactical or positional reason, it must say less. Existing neutral fallback behavior is preferable to a confident but unsupported strategic explanation.

### 3.5 Preserve baseline quality

Current full-game review already performs deep Stockfish analysis for each move. Adaptive compute must initially **add targeted refinement on top of that baseline**. Do not weaken baseline review quality merely to create a cheaper “survey” pass.

A cheaper first pass may replace the baseline only after measured evidence shows equivalent or better user-visible quality and the change is separately documented.

### 3.6 Persistent work remains resumable

Expensive new analysis must participate in Fieldwork’s existing persistence/cancellation/restart philosophy. A restart should not throw away completed Maia or refinement work when its cache identity remains compatible.

### 3.7 No network dependency during ordinary review after setup

A model may need to be acquired during explicit installation/setup/cache preparation. Once installed and cached, ordinary review must not unexpectedly contact Hugging Face or another remote model service.

### 3.8 Deterministic dialogue variation

Dialogue can vary, but revisiting the same reviewed position with the same coach/context should normally produce the same wording. Never use unseeded randomness during rendering.

### 3.9 Preserve cold-review information boundaries

SRS intentionally hides answers and tactical hints before the learner attempts or reveals a move. Smarter dialogue and cross-game context must never leak concealed information into cold practice.

### 3.10 Keep human-model plumbing provider-neutral

Maia-3 is the first planned human model, not the definition of the abstraction. Use a small provider-neutral human-move-evidence interface with explicit provider/model provenance so a future human-like engine/model can be evaluated without rewriting review intelligence. Do not prematurely implement additional providers in this project.

### 3.11 Grow diagnostics with the system

Do not wait until the final developer-lab milestone to make complex evidence inspectable. Each human-difficulty, adaptive-compute, semantic-event, and context milestone should add enough structured debug output/fixtures to diagnose itself. Milestone 11 consolidates those diagnostics into a polished developer surface.

### 3.12 Persist facts, not the selected character's prose

Saved engine/human/context evidence must remain coach-neutral. A user who switches from one coach to another must get the new coach's wording from the same saved factual review without rerunning Stockfish, Maia, tactical detection, or game-context analysis. If a neutral fallback message remains persisted for API/backward compatibility, it must not be treated as the canonical personality output. Coach-specific wording belongs in the presentation/dialogue rendering layer.

### 3.13 Reaction intensity is semantic data

The current coach reaction contract primarily selects an expression state. This project may extend it with a conservative intensity/severity value or tier derived from factual review intelligence. A barely qualifying inaccuracy and a move allowing forced mate should not be forced to use identical delivery when artwork/dialogue supports nuance. Intensity must remain independent of coach personality, respect reduced motion, and degrade safely for coaches/animations that ignore it.

---

## 4. Upstream Maia facts to verify and pin during implementation

At the time this document was written, the official `CSSLab/maia3` repository provides:

- 5M, 23M, and 79M model presets;
- UCI execution through `maia3-uci` / preset commands;
- `Elo`, `SelfElo`, and `OppoElo` conditioning;
- `Temperature`, `TopP`, and `MultiPV` options;
- reconstructed UCI move history via `--use-uci-history`;
- CPU mode;
- Hugging Face checkpoint caching;
- dependencies including `torch`, `huggingface-hub`, `numpy`, and `python-chess`;
- AGPL-3.0 repository licensing.

The official UCI wrapper internally computes policy probabilities for top legal moves, but standard UCI `info` output currently exposes ranked MultiPV moves and human-outcome WDL rather than the raw policy probability itself.

This creates an explicit spike decision:

1. **UCI subprocess integration** gives strong process isolation and fits Fieldwork’s existing engine style, but may expose ranking without exact policy probability.
2. **Direct Python/in-process integration** can access policy probabilities but couples Fieldwork to Maia’s Python/Torch API and may increase memory/lifecycle complexity.
3. A narrow, pinned adapter around upstream code may be appropriate if it preserves provenance and avoids maintaining a forked model implementation.

Do not assume which option wins. Measure and decide in Milestone 1.

Pin exact upstream code/model revisions when the integration becomes production behavior. Do not silently track moving `main` or an unpinned model revision.

Primary upstream reference: <https://github.com/CSSLab/maia3>

---

# Implementation milestones

Each milestone is a **hard checkpoint**.

For every milestone:

1. inspect the current working tree and relevant living docs;
2. implement the smallest coherent version of that milestone;
3. add/adjust automated tests;
4. exercise it manually where meaningful;
5. update living architecture/behavior documentation;
6. run relevant validation;
7. commit the completed verified milestone with a descriptive commit;
8. ensure unrelated changes were not swept into the commit;
9. proceed to the next milestone without asking for permission.

Do not accumulate several completed milestones into one giant commit.


### Persistent progress protocol

Because this project is intentionally large, implementation must survive context resets and handoffs. At the start of Milestone 0, create a small tracked progress ledger such as `docs/REVIEW_INTELLIGENCE_PROGRESS.md` containing:

- current milestone and status;
- completed milestone commit SHAs;
- validation actually run;
- benchmark decisions that later milestones depend on;
- unresolved non-blocking follow-ups;
- any concrete blocker evidence if one occurs.

Update it at milestone boundaries, not after every tiny edit. It is an implementation aid, not permanent product documentation. At final completion, move durable decisions/results into the appropriate living docs/verification history and delete the temporary progress ledger before the final clean-tree commit.

---

## Milestone 0 — Baseline audit, contracts, and benchmark harness

### Goal

Establish explicit invariants and measurement tools before introducing a heavy model dependency.

### Work

- Re-read `AGENTS.md`, `PRODUCT.md`, `FEATURE_STATUS.md`, `GAME_REVIEW.md`, `ANALYSIS_PIPELINE.md`, `CONFIGURATION.md`, `COACH.md`, `TESTING.md`, `NOTICE.md`, and licensing/reuse docs.
- Confirm current coach registry and do not rely on this document’s historical count.
- Confirm current review API/report contracts and migration state.
- Add or extend a reproducible benchmark harness capable of measuring:
  - process/model startup;
  - cold model load;
  - warm inference latency;
  - per-position throughput;
  - memory footprint where practical;
  - concurrency behavior;
  - container/image impact;
  - result determinism;
  - cache behavior.
- Establish a small fixed set of representative legal positions with full move history and a spread of ratings. Keep private user games out of committed fixtures.
- Record the existing Stockfish review baseline so later work can prove it did not regress latency/quality unexpectedly.

### Acceptance criteria

- Baseline tests remain green.
- A repeatable benchmark command is documented.
- No Maia dependency is required for ordinary baseline tests yet.
- The milestone produces an explicit architecture note defining Stockfish vs Maia authority.

---

## Milestone 1 — Maia feasibility spike and integration decision

### Goal

Choose the production integration based on evidence, not assumption.

### Required experiments

Compare at least the practical candidate configurations available in the environment, starting with 5M and evaluating larger models when feasible.

Measure:

- first-run checkpoint acquisition behavior;
- cached/offline startup;
- CPU latency and memory;
- GPU behavior if the environment makes it available, without requiring a GPU for baseline operation;
- 5M vs 23M vs 79M tradeoffs where runnable;
- UCI process startup/teardown;
- long-lived process behavior;
- multiple Elo settings;
- `SelfElo`/`OppoElo` behavior;
- full-history reconstruction;
- MultiPV ranking;
- exact policy probability availability;
- repeated-call determinism at deterministic sampling settings;
- failure behavior with a missing/corrupt checkpoint;
- concurrent self-hosted users.

### Decision requirements

Select an approach for:

- process isolation vs in-process inference;
- default model size;
- host configurability;
- checkpoint/cache location;
- model acquisition/pre-cache workflow;
- CPU baseline;
- optional GPU acceleration;
- human-evidence cache identity;
- how to obtain **actual policy probability** if the final product intends to expose it.

If exact probability would require brittle dependence on unstable internals, prefer an explicit rank/top-N contract over pretending UCI WDL/cp is policy probability.

### Default bias

Prefer the smallest/simplest configuration that yields useful human-move evidence and preserves easy self-hosting. Larger models can be host-selectable when their quality benefit justifies the cost.

### Deliverable

Document the measured decision and then implement only enough scaffolding to make Milestone 2 straightforward.

### Acceptance criteria

- Decision is backed by benchmark output and recorded assumptions.
- No unsupported claim equates Maia WDL/cp with Stockfish evaluation or move probability.
- Model provenance/license notes are updated.
- Completed spike work is committed separately.

---

## Milestone 2 — Production Maia evidence layer

### Goal

Make human-move evidence a reliable, cached, resumable backend capability without changing dialogue yet.

### Data contract

Create a small provider-neutral, versioned human-model result concept. Maia is the first provider; provider/model/revision provenance is explicit. Exact fields may change based on Milestone 1, but should support as much of the following as reliably available:

- model identity/revision;
- history identity;
- self Elo;
- opponent Elo;
- played move rank;
- played move policy probability when truly available;
- Stockfish-best move rank/probability when available;
- top human-likely moves with rank and optional probability;
- distribution concentration/entropy when exact probabilities are available;
- Maia human-outcome WDL only when useful and clearly typed as Maia-derived, never objective evaluation;
- source/rating/time-control domain metadata;
- calibration/confidence status for interpreting the human signal;
- inference configuration relevant to cache identity.

### Persistence and caching

Human evidence must be cached by all materially relevant identity inputs, including:

- position and required move history;
- model revision/checkpoint identity;
- player/opponent Elo conditioning;
- rating source/domain and time-control domain when they change interpretation/calibration;
- inference settings that change outputs;
- adapter version.

Changing worker count alone should not invalidate semantic results.

### Runtime

- Follow full-game review's both-color semantics: condition the human model on the actual mover/opponent ratings when available, while allowing budgets to prioritize learner moves if measurement later justifies it.
- Integrate with host resource limits rather than launching unbounded model workers.
- Support a sane single-user CPU baseline.
- Support small-community hosting without one account spawning unlimited inference.
- Expose health/readiness distinctly from Stockfish health.
- Existing Stockfish-only review must remain readable when Maia is unavailable.
- A Maia failure must not corrupt or erase completed Stockfish review evidence.

### Setup/offline behavior

- Provide an explicit model cache/setup path.
- Ordinary cached review should work without internet.
- Do not unexpectedly download a model during a normal browser review request.

### Tests

Cover:

- cache identity;
- history-sensitive positions;
- Elo-sensitive results;
- missing model;
- unavailable runtime;
- restart reuse;
- account concurrency/resource bounds;
- model output parsing/typing;
- graceful Stockfish-only fallback.

### Acceptance criteria

A reviewed position can persist and retrieve Maia evidence independently of dialogue or personality.

---

## Milestone 3 — Human difficulty and naturalness model

### Goal

Turn raw human-move evidence into useful, deterministic coaching facts.

### Core principle

Do not equate “low Maia probability” with “objectively bad,” and do not equate “high Maia probability” with “good.”

Human difficulty is an interpretation layer over multiple facts.

### Candidate inputs

Use only inputs supported by actual data, such as:

- played-move human rank/probability;
- best-move human rank/probability;
- top-human-move concentration;
- number of objectively acceptable alternatives;
- Stockfish candidate separation;
- only-good-move evidence;
- forcing line structure;
- tactical depth/witness horizon;
- verified sacrifice/counterintuitive move;
- forced-mate transitions;
- player rating;
- opponent rating where relevant;
- actual mover/opponent PGN ratings when present, with an explicit fallback policy rather than silently conditioning both sides on one number;
- rating platform/source and time-control domain;
- calibration confidence / domain-shift status;
- later, player-specific history.

### Output

Prefer a versioned structured result containing a numeric score or components plus conservative presentation bands, for example:

- routine;
- natural;
- challenging;
- difficult;
- exceptional.

Names are not sacred; calibration and semantic clarity matter more.

Also distinguish concepts such as:

- obvious mistake;
- natural but inaccurate human move;
- hard-to-find defense;
- engine-like/rare good move;
- humanly natural best move;
- objectively strong move that most comparable players miss.

### Calibration

Do not invent thresholds by aesthetics alone. Use a fixed sample/benchmark and inspect distributions across ratings. Record uncertainty. If calibration is weak, expose fewer bands rather than false precision.

When the source game uses a rating ecosystem/time control that is not directly comparable to Maia's Lichess-blitz conditioning, do not present the conditioned value as a calibrated population frequency. Either implement and validate an explicit mapping, use a broader skill-band heuristic with lower confidence, or omit percentage-style claims. Prefer conservative semantics over fake precision.

### Acceptance criteria

- Difficulty is deterministic/versioned.
- Tests cover important boundaries.
- UI/dialogue has not yet become personality-specific.
- No claim describes an individual user’s mental state.

---

## Milestone 4 — Adaptive compute and targeted refinement

### Goal

Exploit self-hosting by spending extra compute where it materially improves review certainty.

### Preserve baseline first

Keep current deep per-move Stockfish review as the minimum initial quality. Add refinement on top.

### Refinement triggers

Use explicit rules to nominate positions such as:

- large evaluation swing;
- newly allowed or lost forced mate;
- potential Brilliant/Great/Miss ambiguity;
- narrow only-move situations;
- uncertain tactical cause;
- candidate scores close enough that classification may change;
- strong Maia/Stockfish disagreement;
- very low human likelihood for the objective best move;
- possible turning point;
- defensive position with one critical resource;
- current report has weak explanatory evidence despite high severity.

### Refinement actions

Depending on the question, spend compute on targeted work rather than one universal deeper search:

- deeper Stockfish;
- greater MultiPV;
- restricted-root comparisons;
- specific defensive-resource verification;
- longer tactical witness line;
- additional Maia evidence across nearby rating bands only when useful;
- comparison of played vs plausible-human alternatives.

### Budgeting

Add host configuration for refinement budgets. Respect shared hosting and cancellation. A host with spare CPU can allow larger budgets; a modest host can disable or cap refinement without losing baseline review.

### Persistence

Persist:

- refinement question/trigger;
- evidence produced;
- config/model/engine identity;
- completion state.

Restart/cancel must reuse completed refinement work.

### Acceptance criteria

- Baseline review quality is unchanged when refinement is disabled.
- Refinement improves at least selected known ambiguous fixtures.
- No infinite self-triggering analysis loop.
- Resource use is bounded and documented.

---

## Milestone 5 — Rich semantic review-event taxonomy

### Goal

Describe what happened in chess terms richer than a single badge.

### Candidate semantic events

Derive only events that evidence can support. Examples include:

- `allowed_forced_mate`;
- `missed_forced_mate`;
- `decisive_swing`;
- `only_good_move`;
- `difficult_only_move`;
- `strong_defensive_resource`;
- `sound_sacrifice`;
- `capitalized_on_error`;
- `failed_to_capitalize`;
- `restored_equality`;
- `recovered_winning_chances`;
- `successful_conversion`;
- `lost_winning_advantage`;
- `repeated_motif`;
- `opening_departure`;
- `engine_human_disagreement`;
- `rare_strong_move`;
- `natural_but_bad_move`;
- `time_pressure_error` where clock evidence exists.

Do not turn every minor observation into a permanent enum. Prefer composable structured facts when that scales better.

### Clock context

Parse clock annotations from the stored PGN when actually present and valid. Preserve per-ply clock facts such as:

- time remaining after/before the move where derivable;
- time spent where derivable from consecutive clock values and increment/time-control data;
- time-trouble band;
- unusually fast move with substantial time remaining;
- long think followed by an error.

Clock context never changes Stockfish objective evaluation. It changes coaching context only.

### Positive-move semantics

Spend as much care explaining strong moves as bad ones. Identify where evidence supports:

- only move;
- best defense;
- conversion;
- counterattack;
- simplification;
- tactical resource;
- sound sacrifice;
- punishment of opponent mistake;
- difficult/rare good find.

### Acceptance criteria

Every exposed semantic event is traceable to concrete stored evidence and has tests demonstrating both positive and negative cases.

---

## Milestone 6 — Deterministic positional understanding

### Goal

Reduce the current tactical-vs-positional explanation imbalance without inventing strategic stories.

### Approach

Add positional facts incrementally, with explicit evidence definitions and abstention. Candidate areas include:

- king safety;
- loose/undefended pieces;
- development;
- piece activity/mobility;
- trapped/bad pieces;
- weak squares/outposts when supportable;
- passed pawns;
- isolated/backward pawns when supportable;
- space;
- open files/diagonals;
- favorable/unfavorable exchanges;
- pawn breaks;
- clearly beneficial simplification/conversion motifs.

Do not create a generic “positional reason generator” that converts eval change into plausible-sounding prose.

### Validation

- Add focused fixtures for each supported positional fact.
- Include abstention fixtures that look superficially similar but do not satisfy evidence.
- Keep evidence IDs/auditability consistent with Fieldwork’s classifier philosophy.

### Acceptance criteria

Quiet positional moves can receive more useful factual explanation in supported cases, while unsupported cases remain neutral.

---

## Milestone 7 — Whole-game context graph / story model

### Goal

Allow later coaching to refer truthfully to earlier events and identify the game’s actual narrative.

### Model

Build a deterministic game-context representation over completed/available review facts. It should link related events rather than rely on chat-style memory.

Examples:

```text
mistake → opponent did not punish → player recovered
opponent mistake → player capitalized
opponent mistake → player missed opportunity
king-safety concession → persistent weakness → later tactical collapse
motif occurrence A → motif occurrence B
advantage gained → maintained → converted
winning advantage → erosion → decisive loss
losing position → defensive resource → equality restored
```

### Required capabilities

- identify candidate turning points;
- identify biggest swing with proper caveats;
- identify repeated supported motifs within the game;
- identify recovery after an error;
- identify missed punishment;
- identify sustained conversion/erosion rather than treating each ply independently;
- link later problems to earlier concrete causes only when evidence supports the relationship;
- distinguish the player’s actions from the opponent’s actions.

### Stability

The graph/story must be deterministic for the same saved evidence version. If later refinement changes evidence, version/recompute explicitly rather than silently mixing generations.

### Acceptance criteria

Tests cover multi-ply stories, including false-positive prevention. Dialogue still remains neutral at this stage.

---

## Milestone 8 — Conservative cross-game personalization

### Goal

Use data Fieldwork already owns to make coaching personal without overclaiming.

### Existing evidence to leverage

Fieldwork already aggregates weakness evidence across independent games and tracks provisional vs supported recurrence.

Use that existing standard instead of calling one repeated-looking mistake a “habit.”

### Possible facts

Where sample size/evidence supports them:

- this motif has appeared across multiple independent games;
- this weakness is currently provisional vs established;
- recent practice retention is improving/needs practice;
- the user has reached the same opening/position before;
- the user commonly chooses a particular move in that known position;
- a supported weakness is recurring in recent games.

### Explicitly defer

Do **not** claim this milestone proves SRS training transferred to over-the-board/game performance. Building a valid “did training work?” longitudinal model is a future project.

Prepare contracts so such a project can later consume provenance from training events and subsequent games.

### Acceptance criteria

Cross-game statements require independent-game evidence and never leak another account’s data.

---

## Milestone 9 — Semantic game narrative and review summary

### Goal

Turn structured evidence into a concise factual story of the game before adding character style.

### Narrative outputs

Where supported, produce semantic slots for:

- opening story / recognized line and departure point;
- biggest turning point;
- best find;
- hardest strong move;
- biggest missed opportunity;
- strongest defensive resource;
- important recovery;
- repeated issue;
- conversion or collapse sequence;
- game conclusion;
- one or two evidence-backed takeaways.

### Review-complete experience

When review analysis finishes, the UI should not merely remove the progress bar. Add a restrained completion moment:

- coach completion reaction;
- short game summary;
- direct links/jumps to the 2–4 most important plies;
- no gamified confetti unless it genuinely fits the selected coach later.

The original per-ply review remains fully navigable.

### Determinism and persistence

Persist or deterministically derive the summary from versioned evidence so refresh/restart does not rewrite history unpredictably.

### Acceptance criteria

The same completed game yields a stable summary, and every summary claim links to supporting plies/evidence internally.

---

## Milestone 10 — Shared intelligent neutral dialogue

### Goal

Build excellent coaching language **before** personalities.

### Architecture

Replace the concept of “backend gives one opaque coach string” with a layered contract.

A recommended shape is:

```text
Review facts
  → ReviewInsight / semantic event
  → neutral DialogueIntent
  → coach-specific renderer (later)
  → CoachUtterance
```

The exact names may differ.

During migration, preserve existing API compatibility where useful; do not break saved reviews unnecessarily merely to rename a field.

### Neutral dialogue must understand

- move quality;
- exact severity;
- tactical/positional cause;
- objective alternative;
- human difficulty;
- naturalness of played move;
- only-move status;
- recovery;
- turning-point role;
- earlier linked events;
- repeated motifs;
- clock context;
- opening context, while preserving the existing rule that `Book` means recognized theory rather than objectively good chess;
- game conclusion;
- cross-game supported weaknesses;
- Show Why/explanation mode;
- variation exploration;
- review completion;
- uncertainty/abstention.

### Relational explanations

Prefer comparisons that teach why the alternative matters:

> “Your move defended the pawn, but Nf6 did the same job while attacking the bishop.”

rather than only:

> “Best: Nf6.”

Only make such relational claims when evidence actually establishes both sides of the comparison.

### Positive feedback

Do not spend all explanatory richness on mistakes. Strong moves should say *why* they were strong when evidence exists.

### Stable variation

Use a stable seed/hash based on factual identity, such as appropriate parts of:

- game/position identity;
- ply/variation path;
- event type;
- evidence version;
- later coach ID.

Do not let React renders or process restarts pick random sentences.

### CoachUtterance contract

Design now for future voice without implementing TTS. Useful fields may include:

- visible text;
- optional speech text;
- semantic expression/reaction;
- factual intensity/severity, reusable by animation and later speech delivery;
- priority;
- whether future auto-speech would be appropriate;
- whether future speech could be interrupted;
- stable utterance identity.

Do not introduce provider-specific TTS fields.

### UI limits

Respect the existing compact coach bubble. Ordinary lines should be concise. Longer game-summary text belongs in an expandable/appropriate surface rather than forcing every bubble to scroll excessively.

### Acceptance criteria

Before personality work starts, the default neutral renderer must already feel substantially smarter than the baseline coach across real game reviews. Switching coach preference at this stage must not require or trigger chess reanalysis; the neutral facts/intent remain reusable.

---

## Milestone 11 — Review-intelligence developer laboratory

### Goal

Make the reasoning inspectable so future tuning does not become guesswork.

### Requirement

Create development-only diagnostics that cannot accidentally become a normal production feature.

Reuse the philosophy of the standalone coach studio: rich developer inspection should not clutter the product.

### For a position, expose enough to inspect

- Stockfish candidates/scores/analysis identity;
- current label and reason;
- tactical/positional evidence;
- Maia model identity and conditioning;
- human move ranking/probability where available;
- difficulty components/result;
- semantic events;
- clock context;
- earlier/later linked events;
- turning-point/narrative role;
- cross-game evidence used;
- neutral dialogue intent;
- selected template/variant and deterministic seed;
- final rendered utterance once personality exists.

### Production isolation

Choose the safest implementation based on current architecture: separate dev entry point, explicit development-only route, CLI/fixture viewer, or a combination. The important requirements are inspectability and exclusion from ordinary production UX/bundles/endpoints unless explicitly intended.

### Acceptance criteria

A developer can explain *why* a given line appeared without reading multiple database tables manually.

---

## Milestone 12 — Personality architecture

### Goal

Make every coach stylistically distinct while keeping chess reasoning centralized.

### Character source of truth

Use the current coach registry/catalogue at implementation time. Never maintain a second manually synchronized list of coach IDs.

### Personality definition

Each coach may define traits such as:

- warmth;
- verbosity;
- directness;
- emotional intensity;
- humor;
- teaching style;
- tolerance for jargon;
- celebration style;
- correction style;
- question frequency;
- preferred sentence rhythm;
- degree of dramatic reaction;
- how often it foregrounds human difficulty;
- characteristic vocabulary.

Prefer a small meaningful trait system plus curated writing over an elaborate generative grammar.

### Hard boundary

The personality renderer receives a validated `DialogueIntent`/semantic context. It must not call Stockfish, Maia, database weakness queries, or tactical detectors.

### Future voice

Personality may provide future delivery metadata, but no TTS provider or audio implementation belongs here.

### Acceptance criteria

Adding a future coach requires registering its character/personality definition, not editing central chess logic or giant switch statements. Switching coaches changes rendered wording/reaction delivery immediately from the same saved review intelligence and triggers no engine/model analysis.

---

## Milestone 13 — Full-cast character bibles and dialogue corpus

### Goal

Make the selectable cast recognizable from language alone.

### Character bibles

Write a concise internal character bible for every currently registered selectable coach. Base it on the existing visual/name/animation identity and preserve continuity with the art.

The current baseline suggests directions such as:

- Storyteller — warm, expressive, narrative;
- Club host — sociable, welcoming, club-table analysis;
- Endgame expert — measured, economical, calm, precise;
- Creative partner — exploratory and collaborative;
- Club captain — assured and motivating;
- Quiet analyst — restrained, observant, thoughtful;
- Bright spark — fast, energetic, tactically delighted;
- Golden braid — easygoing and warmly encouraging;
- Library tabby — cozy curiosity;
- Midnight tactician — controlled, sharp, dry confidence;
- Curious calico — playful investigation;
- Velvet night — quiet, watchful understatement;
- Sunny companion — openly delighted encouragement;
- Gentle professor — patient, slow reassurance;
- Pocket captain — oversized confidence and energy in a small body;
- Border collie — intense focus on patterns and the next task.

These are historical baseline identities, not a fixed enumeration. Add equally deliberate bibles for any coaches that exist by implementation time.

### Writing coverage

Provide substantial, curated variation for major intents including:

- brilliant;
- great;
- best/good;
- book/opening departure;
- inaccuracy;
- mistake;
- blunder;
- missed opportunity;
- difficult defense;
- only move;
- winning/losing/draw conclusions;
- encouraging retry;
- recovery;
- explanation mode;
- turning point;
- repeated motif;
- time trouble;
- review complete;
- variation exploration.

Do not mechanically require identical line counts for every coach, but major high-frequency states need enough high-quality variants to avoid immediate repetition.

### Animal writing rule

Animal personalities come from temperament, not nonstop species puns. Rare species-flavored jokes are fine. Replacing every verb with “paw” is not.

### Quality rules

Avoid:

- generic AI-assistant phrasing;
- therapy-speak;
- condescension;
- insulting the player;
- constant praise;
- meme spam;
- excessive exclamation marks;
- repetitive catchphrases;
- unsupported certainty;
- pretending to know the user’s thoughts;
- bloated lines that overwhelm the review UI.

### Corpus quality tooling

Add deterministic corpus checks appropriate to the chosen implementation, including coverage of required intents/fallbacks, unresolved placeholders, duplicate or near-identical normalized lines where practical, and UI-length outliers. Snapshot every sentence only where that adds value; prefer semantic tests that allow writing improvements without needless fixture churn.

Extend the developer intelligence lab so a developer can preview the same intent/facts across every registered coach, making personality collisions and repetitive writing obvious.

### Blind identity test

As a manual quality criterion, sample multiple lines from each coach without displaying its portrait/name. The styles should be distinguishable often enough to justify having separate personalities.

### Acceptance criteria

Every currently selectable coach has a complete character bible and can render every required dialogue intent through safe fallbacks.

---

## Milestone 14 — End-to-end validation and polish

### Goal

Prove the entire stack works as one system rather than a collection of individually passing modules.

### Review corpus

Exercise a varied corpus including:

- multiple Elo bands;
- short tactical games;
- quiet positional games;
- games with no major errors;
- games with large swings;
- mate transitions;
- only-move defenses;
- human-vs-engine disagreement;
- repeated motifs;
- opening departure;
- time trouble when clock data exists;
- winning conversions;
- failed conversions;
- recoveries;
- draws;
- interactive variations;
- SRS failure/retry/recovery/explanation.

### Inspect every layer

Check:

- Stockfish evidence remains objective and unchanged by personality;
- Maia evidence is typed correctly;
- difficulty descriptions match evidence;
- adaptive refinement is bounded;
- context links are truthful;
- summaries identify genuinely important moments;
- neutral dialogue is useful;
- every coach personality remains factual;
- mobile bubble/layout behavior;
- reduced-motion behavior;
- account isolation;
- stale async results;
- cancellation/restart;
- cache invalidation;
- Docker fresh install;
- model pre-cache/offline restart;
- CPU/RAM footprint;
- shared-host contention;
- no accidental network model calls after setup;
- production builds exclude developer-only lab surfaces as intended.

### Final cleanup

- remove dead spike code;
- remove temporary benchmark outputs from tracked files unless intentionally documented;
- consolidate duplicated dialogue logic;
- update README/product/configuration/review/coach/testing/verification docs;
- update NOTICE/provenance for added dependencies/models;
- run the complete backend/frontend/account/development-studio/new-lab suites;
- record actual verification results rather than aspirational claims;
- leave a clean working tree;
- commit final polish.

### Acceptance criteria

All completion criteria in Section 10 are satisfied, full relevant verification has been run and recorded accurately, temporary progress/checklist artifacts have been removed, and the repository is left in a clean actionable state.

---

# 5. Cross-cutting data and API guidance

## 5.1 Version everything derived

Version at least:

- Maia adapter/results;
- difficulty model;
- semantic-event derivation;
- positional evidence rules;
- game-context/narrative derivation;
- dialogue-intent schema;
- personality/corpus schema where persistence makes it relevant.

Changing derived logic should not make old cached rows indistinguishable from current ones.

## 5.2 Prefer evidence references over duplicated truth

When possible, semantic facts should reference the underlying analysis/evidence IDs rather than copy enough information to drift independently.

## 5.3 Preserve saved-review readability

Schema/API migrations must keep already-reviewed games readable. If new intelligence is missing for an old report, show a safe fallback and allow explicit enrichment/reanalysis rather than crashing or fabricating fields.

## 5.4 Account ownership

Human-model results that depend only on immutable chess position/history/model/rating may be safely shareable internally only if their cache identity contains all relevant inputs and no private account metadata leaks through the API. Cross-game personalization is account-owned and must never use another account’s weakness/history data.

## 5.5 Interactive variations

Do not allow expensive new human/context analysis to create uncontrolled latency every time a user drags a piece. Use debouncing, caching, lower-cost evidence, or explicit refinement as appropriate. The UI must remain usable when Maia is unavailable/busy.

---

# 6. Testing strategy

Tests should be layered so ordinary development is not held hostage by a huge neural-model download.

## 6.1 Fast deterministic tests

Use injected/fake Maia evidence to cover:

- contracts;
- cache keys;
- difficulty logic;
- semantic events;
- context graph;
- summaries;
- dialogue intent;
- personality rendering;
- deterministic variants;
- fallbacks;
- account isolation.

## 6.2 Native Maia integration tests

Mark a bounded suite requiring an actual cached Maia model. These tests should explicitly skip with a clear reason when the model is unavailable, analogous to current native Stockfish tests.

Do not report full Maia integration coverage when they skipped.

## 6.3 Browser tests

Cover real end-to-end behavior with stable fixtures, including:

- smart game-review dialogue;
- Show Why;
- review completion summary;
- coach switching;
- multiple personalities;
- SRS cold-state non-leakage;
- retry/recovery;
- reduced motion;
- mobile layout.

## 6.4 Performance/regression benchmarks

Keep benchmarks separate from correctness tests. Record enough environment metadata to make results meaningful.

---

# 7. Configuration principles

Do not expose dozens of inscrutable settings merely because Maia and adaptive compute have knobs.

Host configuration should favor a few meaningful options, such as:

- human-model enabled/disabled;
- model preset;
- model/cache path;
- device selection or auto/CPU baseline;
- human-model concurrency limit;
- refinement enabled/disabled;
- refinement budget/intensity.

Keep developer/tuning controls out of ordinary Settings UI unless they are genuinely user-facing choices.

The selected **coach personality** remains an account preference; infrastructure/model settings remain host concerns.

---

# 8. Explicitly deferred work

These ideas remain valuable but are outside this project unless implementation uncovers a tiny prerequisite:

### Voice/TTS

Future-ready contract only. No audio generation, provider integration, voice cloning, streaming speech, or voice settings in this project.

### Syzygy/tablebases

High-value future deterministic endgame work, but independent enough for a dedicated project.

### Multi-move graded training sequences

Useful training expansion, but not required to build review intelligence.

### Persistent named analysis branches / position bookmarks

Good polish, not foundational here.

### Full longitudinal training-transfer measurement

Eventually link training exposures to later independent game behavior and ask whether the player actually improved. This requires careful causal/provenance design and must not be smuggled into a weakness trend metric.

### Personal FSRS parameter optimization

Unrelated.

### LLM-generated coaching

Not required. This design is intentionally capable of producing rich local coaching without reintroducing a model API/runtime.

---

# 9. Concrete blocker policy for autonomous implementation

The implementation agent should continue through milestones autonomously. It should **not** stop merely because a decision is nontrivial.

## 9.1 Not blockers

The following are normal engineering work and do not justify asking the owner to intervene:

- deciding between reasonable internal class/module names;
- choosing a schema shape that preserves the documented semantics;
- selecting 5M vs a larger default after benchmarking;
- ordinary dependency/version conflicts that can be resolved safely;
- missing GPU support when CPU works;
- slow tests;
- failing tests caused by the new implementation;
- refactoring required to keep architecture clean;
- deciding exact thresholds after empirical calibration;
- writing/revising character dialogue;
- discovering that one speculative semantic event is not supportable—drop/abstain/document it;
- unrelated pre-existing working-tree changes that can be preserved and excluded from commits;
- needing more time or compute;
- a current milestone being larger than expected.

## 9.2 Concrete blockers that may require owner attention

Stop only when progress genuinely depends on an external decision or unavailable prerequisite, for example:

- upstream Maia terms/model terms conflict with the repository’s documented licensing in a way that cannot be resolved by correct attribution/configuration and requires a rights/product decision;
- no supported Maia integration can run on the project’s required baseline platform/Python environment and every reasonable fallback would materially change project requirements;
- required model files cannot be legally/technically obtained or cached after exhausting supported upstream paths;
- current repository state contains contradictory owner decisions that materially change the product goal and cannot be reconciled from living docs/history;
- a required migration would destroy/irreversibly transform user data and multiple materially different product choices exist;
- a security/privacy problem requires deciding whether a feature should exist at all;
- completing the next milestone would require credentials, private data, paid access, hardware, or an external service only the owner can supply;
- a third-party upstream bug makes the required behavior impossible and there is no reasonable local workaround without changing the promised semantics.

Before stopping:

1. verify the blocker with concrete evidence;
2. try reasonable safe alternatives;
3. commit all completed, verified work that is independent of the blocker;
4. leave the working tree clean where possible;
5. report exactly what is blocked, evidence, options, tradeoffs, and a recommended choice.

Do not use “I want confirmation” as a blocker.

---

# 10. Completion definition

This project is complete only when:

- Maia/human modeling is integrated or a documented concrete blocker made it impossible;
- human difficulty/naturalness is structured and calibrated conservatively;
- targeted adaptive refinement exists without lowering baseline review quality;
- richer semantic review events exist;
- supported positional explanations are improved;
- whole-game context can truthfully reference prior events;
- conservative cross-game personalization works;
- completed games receive a factual narrative/summary;
- shared neutral dialogue is materially smarter than the baseline;
- developer diagnostics make the decision chain inspectable;
- every currently registered selectable coach has a distinct personality contract and curated dialogue coverage;
- personality cannot alter chess truth;
- SRS cold-review secrecy remains intact;
- model/network/resource failure degrades safely;
- self-hosting and small-community resource bounds are documented;
- full relevant validation passes or skips are accurately disclosed;
- living docs reflect reality;
- all completed milestones are committed;
- the final working tree is clean aside from owner/pre-existing unrelated work.

The standard is not merely “the feature works.” The finished system should make Fieldwork feel like a coach that understands the **objective chess**, the **human difficulty**, and the **story of the game**, then communicates that understanding through whichever character the user chose.
