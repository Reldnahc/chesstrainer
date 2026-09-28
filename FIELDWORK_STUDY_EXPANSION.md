# Fieldwork Study Expansion
## Opening SRS, Generic Puzzles, and Puzzles From Your Games

**Status:** Design draft  
**Scope:** Product and implementation plan  
**Primary goal:** Add proactive study without weakening Fieldwork's existing evidence, review, and scheduling boundaries.

---

## 1. Product direction

Fieldwork currently learns primarily from the player's own games:

> saved games → verified analysis → meaningful mistakes → scheduled recall → weakness evidence

This expansion adds a second path:

> chosen material → deliberate study/practice

The two paths should meet where that is useful, but they must not be conflated.

### New product concepts

1. **Opening SRS**
   - The player explicitly chooses an opening or variation to study.
   - Fieldwork converts the player's own-side decisions from that line into normal FSRS cards.
   - Those cards enter the existing scheduled-recall queue inside Study alongside mistake-derived cards.
   - The purpose is repertoire recall, not objective engine grading.

2. **Generic puzzles**
   - Multi-move tactical puzzles not tied to the player's games.
   - They use the normal Fieldwork board and coach presentation, but they are not SRS.
   - They maintain puzzle history/statistics separately from Review.

3. **Puzzles from your games**
   - Fieldwork identifies suitable tactical moments from the player's saved games and turns them into real multi-move puzzles.
   - These are not copies of mistake SRS cards.
   - The player must calculate and play through a continuation, not merely find one move.
   - Solving them does not alter FSRS state or weakness evidence.

---

## 2. Navigation and information architecture

Make **Study** the single top-level destination for active learning.

Proposed navigation:

**Study · Games · Weaknesses · Settings**

There is no separate top-level Review or Import destination.

`Study` contains three primary sections:

- **Due** — scheduled FSRS recalls from game mistakes and opening study
- **Openings** — choose and manage repertoire material
- **Puzzles** — generic puzzles and puzzles generated from saved games

Suggested routes:

- `/study`
- `/study/due`
- `/study/openings`
- `/study/puzzles`
- `/study/puzzles/generic`
- `/study/puzzles/games`

`/study` should act as the learning home. It can surface the most relevant next action without hiding the distinct learning modes, for example:

- due recalls;
- opening-study status;
- continue a puzzle session;
- start generic puzzles;
- practice puzzles from saved games.

The product model is:

- **Study** = everything the player actively does to improve.
- **Games** = saved-game library, provider sync/add-game entry points, analysis and full-game review.
- **Weaknesses** = evidence-backed recurring issues and focused practice entry points.
- **Settings** = account, coach, motion, model and host/user preferences.

Removing the separate Review destination does **not** mean renaming or deleting the existing backend Review/FSRS domain model. In the product, that machinery is surfaced as **Study → Due**.

Removing the separate Import destination also does not remove game ingestion. Provider sync, account connection and manual PGN/game addition belong with the Games library rather than occupying a permanent top-level destination.

### Study landing page

`/study` should be useful on its own rather than acting as an extra menu.

A compact first version can show:

- **Due now** — scheduled recall count and a prominent **Start studying** action;
- **Openings** — active studies, cards currently learning, and **Manage openings**;
- **Generic puzzles** — start a puzzle session;
- **From your games** — available/generated puzzle count and practice action;
- an unfinished Study session when one exists.

The landing page can emphasize the most relevant next action, but it must not collapse the modes into one learning statistic. Scheduled recall, opening selection and puzzle practice remain distinct.

---

# Part I — Opening SRS

## 3. Opening SRS product behavior

The basic interaction should be:

1. Open **Study → Openings**.
2. Search or browse the bundled opening catalogue.
3. Open a named line and preview its moves.
4. Choose **Study as White** or **Study as Black**.
5. Select **Add to study**.
6. Fieldwork creates/reuses recall cards for every position in that line where the chosen color is to move.
7. Those cards immediately become part of **Study → Due**, alongside mistake-derived recalls.

Example:

> Study Caro-Kann: Advance Variation as Black

If the line contains:

`1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6`

the Black study contributes cards for the positions before:

- `...c6`
- `...d5`
- `...Bf5`
- `...e6`

The opponent's moves provide the board state. The user recalls only their own move.

### V1 should use one-move recall

Opening SRS should initially test:

> "What is my repertoire move in this position?"

Do not make Opening SRS itself a multi-move puzzle system. The existing Review/FSRS machinery is already very good at cold single-decision recall, and puzzles will own continuation solving.

Continuation/branch drills can be added later if they prove useful.

---

## 4. Opening answer authority

Opening cards must have a different grading authority from game-derived cards.

### Game-derived Review card

Authority:

> Stockfish + Fieldwork move policy

A sound unlisted alternative can be verified and accepted.

### Opening Study card

Authority:

> The player's selected opening study

The question is not:

> "Is this move objectively good?"

It is:

> "Is this one of the moves I chose to learn here?"

Therefore:

- accepted moves come only from active selected study lines;
- no Stockfish fallback should convert an out-of-repertoire move into a successful recall;
- a legal move not in the selected study is a failed recall;
- after the attempt, Fieldwork may say that the move was simply not the studied continuation;
- it must not imply that the move is objectively bad unless separate engine evidence exists.

This keeps opening recall conceptually honest.

---

## 5. Do not revive archived Repertoire

Fieldwork already contains historical `Repertoire` rows and `source="repertoire"` exercises. Those are deliberately tombstoned and excluded from active Review.

Opening Study should be a **new feature and a new exercise source**.

Recommended:

`Exercise.source = "opening"`

Do not reactivate the old `repertoire` source or restore the old Repertoire product routes.

Reasons:

- old Repertoire has explicit archival/compatibility semantics;
- Review currently filters that source deliberately;
- historical schedules and attempts must remain untouched;
- the old UI was removed for product reasons;
- Opening Study has different product requirements, lifecycle rules, and source provenance.

Historical Repertoire remains historical.

---

## 6. Opening catalogue source

V1 should reuse the existing bundled Lichess opening catalogue already used for local Book recognition.

Study UI should support:

- search by opening name;
- search/filter by ECO;
- line preview;
- White/Black study choice;
- showing whether the line is already active;
- removing/disabling a selected line.

The catalogue version must be retained with the study so later catalogue updates cannot silently rewrite what a user originally selected.

### Later, not V1

The same domain can later support:

- custom opening PGN import;
- Lichess Study import;
- manually edited repertoire trees;
- lines learned from favorite positions;
- account sync to an external repertoire source.

V1 does not need those to establish the architecture.

---

## 7. Transpositions and overlapping studies

Opening lines will frequently share positions.

Fieldwork should not create duplicate SRS cards merely because the same position was reached through two selected lines.

Use the legal-play position key already used elsewhere in Fieldwork.

For the same user, orientation, and position:

- one active opening exercise exists;
- multiple opening studies may contribute accepted moves to it;
- the accepted answer set is the union of active study continuations.

Example:

Study A and Study B both reach the same position.

Study A contributes:

`Nf3`

Study B contributes:

`Nc3`

If both lines are active, both moves are accepted repertoire recalls.

This is preferable to making the user review the exact same board twice.

---

## 8. Proposed opening data model

Names are illustrative.

### `opening_studies`

Account-owned.

Fields:

- `id`
- `user_id`
- `source` — initially `lichess_catalogue`
- `source_version`
- `source_key`
- `name`
- `eco`
- `color`
- `active`
- `created_at`

This represents the user's decision:

> "I want to study this line as this color."

### `opening_study_moves`

Account-owned contribution records.

Fields:

- `study_id`
- `exercise_id`
- `position_key`
- `fen`
- `ply`
- `move_uci`
- `move_san`
- `ordinal`

Unique enough to prevent duplicate contributions from the same study.

### Existing `Exercise`

Opening cards use:

- `source = "opening"`
- `decision_id = NULL`
- `repertoire_id = NULL`
- stable opening-position identity
- normal orientation
- policy describing curated opening-study authority

Recommended stable identity:

```text
digest({
  source: "opening",
  position: position_key,
  orientation: "white" | "black"
})
```

The identity should **not** include the opening name or selected line. Otherwise transpositions create duplicate cards and switching lines destroys useful review history.

### Existing `ExerciseAnswer`

The answer set is rebuilt from active `opening_study_moves` that point at the exercise.

### Existing `SRSState`

Reuse unchanged.

Opening recall should use the same existing Review/FSRS mechanics:

- FSRS implementation;
- first-failure semantics;
- timing;
- retry behavior;
- reveal behavior;
- retirement policy;
- restart persistence.

Do not create a second scheduler.

---

## 9. Opening study lifecycle

### Adding a study

1. Parse/validate the selected catalogue line.
2. Walk every position.
3. For positions where the selected color is to move:
   - create or reuse the stable opening exercise;
   - add the study's move contribution;
   - ensure the exercise has SRS state;
   - make it eligible.
4. Rebuild the accepted-answer union.
5. Commit atomically.

### Disabling/removing a study

Do not delete learning history.

1. Mark the study inactive.
2. Remove its contributions from the active answer projection.
3. If another active study still uses the exercise:
   - keep the exercise active;
   - rebuild accepted answers.
4. If no active study uses the exercise:
   - set its SRS state ineligible;
   - preserve FSRS card, due date, reviews, lapses, attempts, and retirement history.

Re-adding the study should restore the previous learning history.

### Changed answer sets

Content edits are not memory outcomes.

They must never increment reviews or lapses.

Recommended behavior:

- **answer added:** preserve current schedule;
- **answer removed while card remains active:** preserve history but make the card due now if it was scheduled later;
- **inactive card reactivated:** preserve history and make it eligible;
- if a previously retired card's study content materially changes, reactivate it and make it due now rather than pretending the changed target is already mastered.

Any such rescheduling should be explicitly recorded as a content-change policy, not an FSRS review.

---

## 10. Opening cards in Study → Due

The **Due** queue inside Study should remain mixed.

A due opening card and a due game-derived card are both genuine recall tasks.

Cold opening cards should preserve the existing no-hint rule:

- no opening name;
- no ECO;
- no answer;
- no source label;
- no engine score;
- no tactical theme.

After the attempt or reveal, feedback may show:

- opening name;
- ECO;
- selected study line(s);
- expected move(s);
- optional short continuation preview.

This makes the cold review actually test recognition rather than letting the label answer half the question.

### Optional queue filters

Later or in V1 if cheap:

- All due
- Game mistakes
- Openings

The default should remain **All due**.

The user should not need a second product destination called Review. Scheduled recall is simply the **Due** mode inside Study.

---

## 11. Coach behavior for Opening SRS

Opening cards should use the same selected coach and the same shared review workspace surfaced through Study → Due.

Before an attempt:

- coach provides no opening hint.

After success:

- coach may identify the line;
- coach may say that the move matches the user's study;
- coach may show a compact continuation.

After failure:

- coach should distinguish:
  - "not the move in your study"
  - from "bad move"

Do not make an objective chess claim from repertoire membership alone.

Examples of supported concepts:

- "That's the move in your Caro-Kann study."
- "Your selected line uses 4...Bf5 here."
- "That move is legal, but it isn't in the line you're studying."

The personality layer may change wording but not the answer authority.

---

# Part II — Puzzle System

## 12. Puzzles are not scheduled Review cards

This is the most important puzzle boundary.

Generic puzzles and game-derived puzzles must not:

- create `SRSState`;
- create ordinary `Review` rows;
- modify mistake-card due dates;
- change weakness retention statistics;
- count as evidence that a weakness has disappeared;
- affect opening recall;
- trigger SRS retirement.

A puzzle solve is **practice**, not blind scheduled recall.

This is conceptually similar to the existing separation between focused Weakness practice and scheduled Review, but puzzles need their own multi-step session model rather than being forced through `ReviewSession`.

---

## 13. Shared puzzle contract

Generic puzzles and game-derived puzzles should use the same solving engine and frontend.

A normalized puzzle definition should contain roughly:

```text
PuzzleDefinition
- id
- source
- initial_fen
- orientation
- solution
- themes
- difficulty/rating (optional)
- provenance
```

`solution` is a multi-ply line or a versioned solution graph.

The frontend must not care whether the puzzle came from:

- a generic puzzle pack;
- one of the user's games.

Source-specific metadata is revealed only where appropriate.

---

## 14. Puzzle solving flow

1. Puzzle loads at its starting position.
2. Solver makes a legal move.
3. Fieldwork grades that solver move.
4. If correct:
   - animate the move;
   - automatically play the verified opponent response;
   - return control to the solver if another solver move remains.
5. Continue until solved.
6. If incorrect:
   - save the failed attempt;
   - keep the puzzle unsolved;
   - allow retry.
7. **Reveal solution** ends the solve as revealed and plays the verified line.

A puzzle is successful only when the player reaches the end of the required continuation.

### Minimum "real puzzle" shape

For game-derived puzzles, require at least:

```text
solver move → opponent reply → solver move
```

That means at least two decisions by the learner.

A one-move tactic belongs in normal Review, not the new game-puzzle mode.

---

## 15. Puzzle sessions and history

Add puzzle-specific history rather than reusing Review records.

Illustrative tables:

### `puzzle_sessions`

Account-owned.

- `id`
- `puzzle_source`
- `puzzle_key`
- `definition_version`
- `started_at`
- `completed_at`
- `failed`
- `revealed`
- `current_step`
- `first_response_ms`
- `snapshot`

### `puzzle_attempts`

Account-owned.

- `id`
- `session_id`
- `step`
- `uci`
- `grade`
- `elapsed_ms`
- `created_at`

A completed puzzle can later support statistics such as:

- solved;
- solved cleanly;
- failed then solved;
- revealed;
- time spent;
- themes;
- source.

Those statistics are descriptive puzzle history only.

No mastery probability needs to be invented.

---

# Part III — Generic Puzzles

## 16. Generic puzzle source

Use a provider boundary.

V1 should use a **local Lichess-compatible puzzle pack** because:

- Fieldwork already has Lichess puzzle parsing/tagging work;
- the official puzzle dataset is suitable source material;
- it provides ratings and themes;
- solving can remain local once the pack is installed.

Do not make production depend directly on the existing developer benchmark harness. Reuse parsing/normalization logic where appropriate, but give the product its own stable provider interface.

### Installation strategy

Avoid silently downloading a huge database during normal startup.

Recommended:

- Fieldwork can ship with a small starter pack, **or**
- Settings/Study offers an explicit **Install puzzle pack** action.

After installation:

- solving is offline;
- the installed pack has a version/hash;
- no network request is required per puzzle.

The exact pack size can be decided during implementation.

---

## 17. Generic puzzle selection

V1 filters:

- mixed;
- rating range/difficulty;
- theme;
- unseen only / include previous failures.

Do not overbuild an Elo system immediately.

A simple queue can:

1. prefer unseen puzzles;
2. target a configurable rating band near the player's target rating;
3. avoid recently seen puzzle IDs;
4. optionally retry previously failed puzzles when the user explicitly chooses that mode.

This is not spaced repetition.

No "due" concept is required.

---

## 18. Generic puzzle grading

For provider-authored puzzles, the provider solution is the initial authority.

The production importer must:

- validate the initial position;
- legally replay every solution move;
- preserve promotion/castling/en-passant correctly;
- reject malformed puzzle records;
- normalize whose turn the solver controls.

### Alternative correct moves

V1 may use the provider's accepted line exactly.

However, Fieldwork should not architect itself into falsely rejecting alternatives forever.

The normalized contract should leave room for:

- multiple accepted solver moves at a node;
- future local Stockfish verification of unlisted alternatives;
- branch continuation after an accepted alternative.

That can be a later enhancement if it makes V1 too large.

---

## 19. Generic puzzle feedback

Before completion:

- do not reveal themes;
- do not reveal the solution;
- do not reveal engine evaluations.

After completion/reveal:

- show puzzle themes;
- show full line;
- show rating/difficulty if available;
- show source attribution;
- let the coach react to the solve.

The coach should not invent a game story for a generic puzzle.

---

# Part IV — Puzzles From Your Games

## 20. Purpose

Game-derived SRS currently asks:

> "At this position from one of my games, can I find an acceptable decision?"

A game-derived puzzle should ask:

> "Can I calculate and execute the tactical continuation that existed in my game?"

These must feel different.

A puzzle should not simply wrap an existing single-move exercise in a new screen.

---

## 21. Candidate puzzle types

V1 should prioritize positions where the learner **missed** a concrete tactical opportunity.

Examples:

- missed forced mate;
- missed material win;
- missed fork/skewer/pin sequence;
- failed to exploit an opponent blunder;
- missed tactical defensive resource where the continuation is concrete.

Later, optional game-puzzle categories can include:

- tactics the learner successfully found;
- opponent-perspective "punish my mistake" puzzles;
- defensive survival puzzles;
- selected/favorited positions converted into puzzles.

The first release should favor missed opportunities because they provide the clearest learning value and strongest evidence.

---

## 22. Game-puzzle generation gates

Do not turn every engine swing into a puzzle.

A game position is eligible only when all required evidence gates pass.

Recommended gates:

1. **Learner to move**
   - V1 puzzle orientation stays with the learner.

2. **Concrete missed opportunity**
   - missed mate, meaningful material gain, or supported tactical best line.

3. **Verified tactical evidence**
   - best line contains a supported tactical witness, mate sequence, or settled material outcome.

4. **Multi-move**
   - at least two learner decisions in the solution.

5. **Legal verified continuation**
   - every frame replays through python-chess.

6. **No trivial forced move**
   - exclude positions where the learner has only one legal move.

7. **Fair first move**
   - the intended move must be meaningfully stronger than ordinary alternatives, or the accepted first-move set must include all verified sound alternatives.

8. **Settled endpoint**
   - do not generate a puzzle whose claimed tactical payoff exists only in an unfinished/noisy tail.

9. **Versioned evidence**
   - generation records the source game, ply, engine evidence IDs, tactical/classification evidence IDs where relevant, and generator version.

If Fieldwork does not have enough evidence to build a fair puzzle, abstain.

That is better than generating more puzzles badly.

---

## 23. Game-puzzle solution authority

Stockfish remains the objective authority.

The generator should save:

- source position;
- expected first move(s);
- best-defense reply;
- later solver moves;
- endpoint evidence;
- analysis IDs;
- tactical witnesses where available.

The coach and UI consume this saved definition.

They do not regenerate "what the tactic probably was."

### Branching

Long term, game puzzles should support a solution graph rather than one brittle PV.

V1 can begin with a verified principal continuation if generation gates are strict enough.

The model should still leave room for multiple accepted solver moves at each solver node.

---

## 24. Generation lifecycle

Game puzzles should be generated from saved evidence, not every time the page opens.

Possible workflow:

- **Study → Puzzles → From your games**
- Fieldwork shows available/generated puzzle count.
- If analyzed games contain new eligible positions, user can choose **Find new puzzles**.
- A persistent job scans saved reports/evidence and performs only bounded extra Stockfish work when required.
- Generated puzzles are saved.

Generation should be resumable and versioned like other Fieldwork jobs.

### Evidence changes

If later refinement or engine-version changes invalidate a source:

- do not rewrite completed puzzle history;
- mark/supersede the old definition;
- create a new version if regenerated;
- old session snapshots remain explainable.

---

## 25. Proposed game-puzzle model

Illustrative:

### `game_puzzles`

Account-owned.

- `id`
- `game_id`
- `source_ply`
- `identity`
- `generator_version`
- `evidence_generation`
- `initial_fen`
- `orientation`
- `solution`
- `themes`
- `evidence`
- `status`
- `created_at`

Identity should include enough evidence/version information that a materially different generated puzzle does not silently reuse an incompatible definition.

Puzzle attempts reference the puzzle ID/version or preserve a definition snapshot.

---

## 26. From-your-games queue behavior

Default behavior:

- prefer unseen puzzles;
- prefer recent missed opportunities;
- avoid multiple puzzles from the same game back-to-back when alternatives exist;
- avoid identical legal positions;
- allow filters by theme;
- allow **Retry failed** separately.

Do not use FSRS due dates.

A user can solve twenty puzzles in a row if they want. That is deliberate practice, not a memory scheduler.

---

## 27. Link back to the original game

After finishing a game-derived puzzle, show:

- game matchup/date;
- move number/source position;
- what the player actually played;
- the puzzle continuation;
- a **View in game** action that opens the exact game/ply.

Do not reveal any of that before the solve if it would spoil the exercise.

This creates a useful loop:

> puzzle → "oh, that was from *that* game" → full review

---

# Part V — Shared UX

## 28. Reuse the Fieldwork board and coach

Do not build a second chessboard interaction stack.

Study Due, Opening SRS and Puzzles should reuse:

- `Board`;
- piece/interface motion preferences;
- promotion UI;
- legal-move interaction;
- coach portrait/expression system;
- responsive board sizing;
- reduced-motion behavior;
- shared move animation primitives.

The solving state machine can differ, but presentation should feel like Fieldwork.

---

## 29. Coach behavior in puzzles

The coach matters to the experience and should be present throughout puzzle solving.

### Before first move

No tactical hint.

Allowed:

- neutral encouragement;
- puzzle progress;
- source type only if it does not spoil the position.

### Correct intermediate move

Coach can react positively without revealing the next move.

### Incorrect move

Coach can say the move does not solve the puzzle and allow retry.

Avoid immediately explaining the tactic unless the user reveals or completes it.

### Completion

Now the coach may describe supported facts:

- tactic theme;
- mate;
- material consequence;
- relationship to the original game for game-derived puzzles;
- exact source move.

Personality remains downstream of puzzle truth.

A cute frog can celebrate the fork.

The frog cannot invent the fork.

---

## 30. Puzzle progress UI

A puzzle should clearly indicate:

- progress through the continuation;
- whether the current move belongs to the solver or is an automatic opponent response;
- retry/reveal controls;
- completion.

Do not show:

- hidden solution length if that would leak the tactic;
- future moves;
- tactical theme before completion.

Possible compact header:

> Puzzle 4 of 10

After completion:

> Solved · Fork · From your game

or

> Solved · Generic puzzle · 1450

---

# Part VI — API Sketch

Names are provisional.

## Openings

```text
GET    /api/openings/catalog
GET    /api/openings/catalog/{key}
GET    /api/opening-studies
POST   /api/opening-studies
DELETE /api/opening-studies/{id}
```

`DELETE` may logically deactivate rather than physically delete history.

Optional:

```text
POST /api/opening-studies/{id}/restore
```

## Puzzles

```text
GET  /api/puzzles/next
POST /api/puzzle-sessions
POST /api/puzzle-sessions/{id}/move
POST /api/puzzle-sessions/{id}/reveal
GET  /api/puzzle-sessions/{id}
GET  /api/puzzles/stats
```

Filters to `/api/puzzles/next` can include:

- `source=generic|games`
- `theme`
- `rating_min`
- `rating_max`
- `retry_failed`

## Game puzzle generation

```text
POST /api/game-puzzles/generate
GET  /api/game-puzzles/jobs/{id}
POST /api/game-puzzles/jobs/{id}/cancel
POST /api/game-puzzles/jobs/{id}/retry
```

Reuse the existing persistent-job infrastructure where practical rather than inventing another lifecycle.

---

# Part VII — Authority Matrix

| Feature | Answer / truth authority | Uses FSRS? | Changes Weaknesses? | May use Stockfish during solving? |
|---|---|---:|---:|---:|
| Game-derived Review | Stockfish + saved policy | Yes | Existing evidence only | Yes, for unknown legal alternatives |
| Opening SRS | User-selected study continuations | Yes | No | No |
| Focused Weakness practice | Existing exercise authority | No | No | Existing behavior |
| Generic puzzle | Puzzle provider / validated solution | No | No | Later optional alternative verification |
| Game-derived puzzle | Saved Stockfish/evidence-backed solution | No | No | Optional bounded branch verification |

This matrix should remain explicit in code and documentation.

---

# Part VIII — Testing Requirements

## 31. Opening tests

Backend:

- catalogue line validation;
- White-only and Black-only card creation;
- transpositions merge into one exercise;
- multiple active studies union their accepted moves;
- disabling one study removes only its contribution;
- disabling the final contributor makes the card ineligible;
- re-enabling preserves prior FSRS history;
- archived `source="repertoire"` remains excluded and untouched;
- out-of-study legal moves fail without Stockfish fallback;
- opening cards enter the normal Study → Due queue;
- cold queue leaks no opening name/source/answer;
- account isolation;
- restart persistence;
- promotion/castling/en-passant where applicable.

Browser:

- browse/search catalogue;
- add study;
- see card in Study → Due;
- fail/retry/reveal;
- correct answer;
- post-answer opening metadata;
- mobile layout;
- coach switching preserves chess state.

---

## 32. Generic puzzle tests

Backend:

- provider record normalization;
- legal replay;
- malformed records rejected;
- correct multi-step solve;
- wrong move then retry;
- reveal;
- attempt persistence;
- no Review row;
- no SRS mutation;
- no weakness mutation;
- account-owned puzzle history;
- restart/resume.

Browser:

- multi-move interaction;
- opponent auto-reply animation;
- promotion;
- wrong move;
- retry;
- reveal;
- completion;
- coach reactions;
- mobile.

---

## 33. Game-puzzle tests

Backend:

- source ownership;
- learner-to-move enforcement;
- candidate gate positive fixtures;
- abstention fixtures for every major gate;
- minimum two learner moves;
- legal PV replay;
- evidence IDs/version retained;
- duplicate source generation reuses compatible puzzle;
- changed evidence creates/supersedes rather than rewriting history;
- cancellation/retry/restart;
- no SRS/Review/Weakness mutation from solving;
- exact link back to source game/ply.

Include deterministic fixtures for:

- missed mate;
- missed fork;
- missed material sequence;
- quiet engine improvement that must **not** become a puzzle;
- one-legal-move position that must abstain;
- unresolved tactical tail that must abstain;
- multiple sound first moves.

---

# Part IX — Implementation Order

## Phase 1 — Puzzle solving foundation

Build the common multi-step puzzle session contract and UI first.

Why first:

- both puzzle sources depend on it;
- it establishes the difference between puzzle practice and Review;
- it prevents game-derived puzzle generation from dictating UI architecture.

Deliver:

- puzzle session/attempt persistence;
- generic `PuzzleDefinition`;
- board solve state machine;
- opponent auto replies;
- retry/reveal/completion;
- coach integration;
- zero SRS side effects.

Use small deterministic fixture puzzles initially.

---

## Phase 2 — Generic puzzles

Add the first real puzzle provider.

Deliver:

- local puzzle pack/provider;
- selection filters;
- unseen/retry history;
- themes revealed after completion;
- puzzle statistics;
- source/version attribution.

---

## Phase 3 — Opening SRS

Add Opening Study using the existing Review/FSRS infrastructure, surfaced as **Study → Due** rather than a separate Review destination.

Deliver:

- opening catalogue browser;
- add/remove study;
- shared/transposed opening cards;
- curated grading;
- normal Study → Due integration;
- post-answer opening metadata.

This phase must explicitly leave archived Repertoire untouched.

---

## Phase 4 — Puzzles from your games

Once the puzzle player is mature, add the harder generator.

Deliver:

- candidate discovery;
- strict evidence gates;
- persisted multi-move definitions;
- persistent generation job;
- from-your-games queue;
- original-game link after completion.

---

## Phase 5 — Polish

Potential polish once the three systems are stable:

- Study landing page counts;
- "10 puzzles" sessions;
- theme filters;
- opening study progress counts;
- review filters;
- favorite puzzle;
- favorite position → future puzzle action;
- game review action: **Practice this tactic** when a compatible saved/generated puzzle exists.

---

# Part X — Explicit Non-Goals for V1

Do not let these features expand uncontrollably.

Not required for the first implementation:

- a full Chessable-style course authoring system;
- opening explanations generated by an LLM;
- a second scheduling algorithm;
- puzzle Elo matchmaking;
- cloud puzzle sync;
- public puzzle leaderboards;
- user-created puzzle publishing;
- a full graphical repertoire tree editor;
- automatically claiming that puzzle performance improved real games;
- using puzzle solves as weakness-remediation evidence;
- resurrecting archived lessons/courses/repertoire;
- making every engine mistake into a puzzle;
- coach-generated chess facts.

---

# Part XI — Product Principles

These features should preserve the rules that already make Fieldwork coherent.

### 1. Scheduled recall means something specific

Only scheduled recall inside **Study → Due** changes FSRS.

Puzzles do not.

### 2. Practice is not evidence of transfer

Solving a fork puzzle does not prove the player stopped missing forks in games.

Actual game evidence remains the authority for recurring weakness claims.

### 3. Source truth stays explicit

- opening move truth comes from the selected study;
- generic puzzle truth comes from the validated puzzle definition;
- game-puzzle truth comes from saved engine/evidence;
- personality never becomes chess authority.

### 4. Abstention is valid

If Fieldwork cannot build a fair multi-move puzzle from a game position, it should generate nothing.

### 5. Cold exercises stay cold

Do not leak the opening name, tactical theme, source game, or future solution before the learner commits to a move.

### 6. Preserve history

Removing study material, changing puzzle generators, or updating evidence should not erase prior attempts.

### 7. One visual language

Study Due, Opening SRS, and Puzzles should all unmistakably feel like Fieldwork.

The cute coaches are part of that product identity, but they sit on top of the same evidence and authority boundaries as everything else.

---

# Final product loop

With these features, Fieldwork supports four distinct forms of improvement without pretending they are the same thing:

```text
YOUR GAMES
   ↓
Games ─────────────────────→ sync/add, inspect and understand what happened
   ↓
Study → Due ──────────────→ remember better decisions from your games
   ↓
Weaknesses ────────────────→ identify recurring supported problems

YOUR CHOSEN STUDY
   ↓
Study → Openings ──────────→ choose repertoire material
   ↓
Study → Due ──────────────→ retain that repertoire with FSRS

TACTICAL PRACTICE
   ↓
Study → Puzzles
   ├─ Generic ─────────────→ practice broad calculation/patterns
   └─ From your games ─────→ calculate concrete opportunities you actually encountered
```

All of them can share the same board, coach, interaction polish, and local-first philosophy.

They should **not** share learning claims they have not earned.

---

# Review notes — September 28, 2026

These notes record the review against the current application. They are proposed
clarifications for a later implementation pass; the draft above is preserved.
Implementation is deferred while other work takes priority.

The overall direction fits Fieldwork: reuse the existing scheduler and account
infrastructure for opening recall, keep puzzle history separate, and share the
board and coach presentation. Preserve the explicit answer authorities and the
choice to reject unsuitable puzzle candidates.

## 1. Make the recall task clear without revealing the answer

The mixed Due queue currently proposed hides the card type, although opening
cards require a studied move and game cards accept objectively sound alternatives.
The current review prompt, "Find a good move," would be misleading for opening
recall: an objectively good move can fail solely because it is outside the study.

Recommend a neutral task cue such as "Recall your studied move" for opening cards.
Continue hiding the opening name, ECO, expected moves and tactical hints. This
requires a deliberate exception to the draft's blanket prohibition on source cues.

## 2. Require puzzle fairness at every learner decision

Expand the "Fair first move" gate to cover every scored learner move. A saved
engine principal variation does not establish that its later moves are the only
correct choices. V1 can retain a linear solution: verify each learner decision and
reject ambiguous candidates unless their sound alternatives have supported
continuations. A full solution graph can remain deferred.

Validate defensive replies and the endpoint against the exact saved puzzle
solution. A quiet endpoint in a finite analysis line does not prove that all
defenses lose, and a review's playback frames can be shorter than its supporting
analysis. Do not simply copy those frames and a settled-outcome flag into a puzzle.

## 3. Preserve opening content and session grading versions

Persist the selected move sequence as well as the catalogue key/version. The
current Book index merges positions and moves; the catalogue browser needs the
underlying line records to retain their relationships.

Record the answer set and provenance used by each review session. Rebuilding the
active answer union after a study edit must not silently change the grading of an
already-open attempt or rewrite the explanation of historical attempts. Define
what happens when a study changes or is disabled in another tab during a session.

## 4. Specify deactivation and retirement lifecycle changes

Opening integration cannot reuse every lifecycle rule unchanged. Today,
unfinished-session queue queries do not enforce eligibility, and the direct review
guard checks retirement rather than eligibility. Disabling a study must have
explicit behavior for queueing, resuming, starting, submitting and revealing.

Current retirement is designed to be permanent. Reopening a retired card after
its study content changes needs an explicit content-change record and preserved
retirement history. Ensure startup reconciliation does not immediately retire it
again using the old interval. Content edits must not count as FSRS reviews or
lapses.

## 5. Describe opening coverage and progress honestly

The bundled catalogue supplies named lines, not a complete repertoire against
every opponent response. Preview the actual continuation and number of study
positions before adding a line.

Shared-position answer unions are useful, but recalling either accepted move
does not demonstrate mastery of both variations. Progress should describe the
positions practiced and retained, without implying that every contributing line
or the entire opening has been mastered.

## 6. Preserve the current import placement and existing links

The draft's placement of provider connections and imports in Games conflicts with
the owner's recent decision. Keep connections and PGN/provider import tools in
Settings, with the compact **Update games** action in Games.

When Review moves under Study, preserve existing `/review` bookmarks, exercise
deep links and Weaknesses focused-practice links, including normal browser
Back/Forward behavior.

## Implementation order and principal risk

Keep the proposed order: shared puzzle player, generic puzzles, Opening SRS, then
puzzles from the player's games. Introduce the minimal Study navigation with the
first phase; richer landing-page counts can follow later.

Game-derived puzzle generation is the hardest part: fair follow-up choices,
defensive replies and a defensible stopping point need independent validation.
Prefer fewer reliable puzzles over a larger collection that rejects sound moves
or ends before its claimed payoff is established.
