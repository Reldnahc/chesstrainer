# Fieldwork Study Expansion
## Lesson Framework, Opening Recall, and Puzzle Framework

**Status:** Design draft  
**Scope:** Product and implementation plan  
**Primary goal:** Add proactive study without weakening Fieldwork's existing evidence, review, and scheduling boundaries.

### Agreed delivery boundary

Build reusable lesson and puzzle infrastructure first, using small deterministic
fixtures for development and testing. Do not populate production with unfinished
courses or generate a large opening library. After the frameworks are working,
build one carefully sourced **Italian Game** course to validate and refine the
lesson experience. The learner side and exact chapters will be chosen during
that content pass.

Opening recall reuses FSRS; guided lessons, dedicated line rehearsal and puzzles
do not update FSRS or weakness evidence. Game-derived puzzle generation and bulk
generic puzzle-pack acquisition are later work, not this framework sprint.
Their sections below describe future requirements, not current deliverables.

---

## 1. Product direction

Fieldwork currently learns primarily from the player's own games:

> saved games → verified analysis → meaningful mistakes → scheduled recall → weakness evidence

This expansion adds a second path:

> chosen material → deliberate study/practice

The two paths should meet where that is useful, but they must not be conflated.

### New product concepts

1. **Guided opening lessons**
   - Teach how positions arise, opening plans, opponent alternatives and game examples.
   - Separate demonstration, guided decisions and independent line rehearsal.
   - Persist chapter progress without treating completion as retention or mastery.

2. **Opening SRS**
   - The player explicitly chooses an opening or variation to study.
   - Fieldwork converts the player's own-side decisions from that line into normal FSRS cards.
   - Those cards enter the existing scheduled-recall queue inside Study alongside mistake-derived cards.
   - The purpose is repertoire recall, not objective engine grading.

3. **Generic puzzles — framework now, production content later**
   - Multi-move tactical puzzles not tied to the player's games.
   - They use the normal Fieldwork board and coach presentation, but they are not SRS.
   - They maintain puzzle history/statistics separately from Review.

4. **Puzzles from your games — future generation phase**
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
- **Openings** — guided lessons, dedicated line practice, and repertoire management
- **Puzzles** — common player infrastructure; production sources follow later

Suggested routes:

- `/study`
- `/study/due`
- `/study/openings`
- `/study/puzzles`
- `/study/puzzles/generic` — when production content is available
- `/study/puzzles/games` — deferred with generation

`/study` should act as the learning home. It can surface the most relevant next action without hiding the distinct learning modes, for example:

- due recalls;
- opening-study status;
- continue a puzzle session;
- start generic puzzles;
- practice puzzles from saved games.

The product model is:

- **Study** = everything the player actively does to improve.
- **Games** = saved-game library, compact Update games action, analysis and full-game review.
- **Weaknesses** = evidence-backed recurring issues and focused practice entry points.
- **Settings** = account, provider connections, PGN/provider import tools, coach, motion, model and host/user preferences.

Removing the separate Review destination does **not** mean renaming or deleting the existing backend Review/FSRS domain model. In the product, that machinery is surfaced as **Study → Due**.

Import already lives in Settings. Preserve that placement, with only the compact
**Update games** action in Games. Preserve `/review` bookmarks, exercise deep
links and Weaknesses focused-practice links when introducing Study, including
normal browser Back/Forward behavior.

### Study landing page

`/study` should be useful on its own rather than acting as an extra menu.

A compact first version can show:

- **Due now** — scheduled recall count and a prominent **Start studying** action;
- **Openings** — active studies, cards currently learning, and **Manage openings**;
- **Puzzles** — practice when installed content is available;
- **From your games** — later, when generation is implemented;
- an unfinished Study session when one exists.

The landing page can emphasize the most relevant next action, but it must not collapse the modes into one learning statistic. Scheduled recall, opening selection and puzzle practice remain distinct.

---

# Part I — Opening SRS

Lessons teach, dedicated practice rehearses, and Due tests retention. The lesson
framework is specified in Part I-A below; it must not be reduced to a catalogue
preview followed by immediate testing of unfamiliar positions.

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

Do not make Opening SRS itself a multi-move puzzle system. Keep scheduled recall
focused on single decisions; lessons own guided line learning and puzzles own
tactical continuation solving.

Guided lessons and dedicated line rehearsal own continuation/branch interaction;
the scheduled card remains a single-decision task.

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

## 6. Opening study sources

V1 supports two sources through the same opening-study domain:

- **Catalogue line:** reuse the bundled Lichess opening catalogue already used
  for local Book recognition.
- **Course line:** use an explicitly designated repertoire line from an immutable
  authored course revision. It need not also exist in the opening catalogue.

Both sources normalize to an initial FEN, a complete legal move sequence including
both colors, a name, optional ECO, study color and versioned source identity.
The same enrollment, answer-union, eligibility and scheduling rules apply to both.
This does not add general PGN import or a second scheduler.

Study UI should support:

- search by opening name;
- search/filter by ECO;
- line preview;
- White/Black study choice;
- showing whether the line is already active;
- removing/disabling a selected line.

Retain the selected content as well as its source key/version; later catalogue or
course updates must not silently rewrite a study. Course identity includes the
course ID, course revision and stable repertoire-line ID. Repeated enrollment of
the same source revision/line/color reuses the account's study.

Only course lines explicitly marked as repertoire material may be enrolled.
Demonstration games, opponent mistakes, counterexamples and arbitrary playback
branches are not automatically study targets. A course may teach many positions
while offering only a few designated lines for recall.

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

This union applies to mixed scheduled Due reviews. Dedicated practice of Study A
expects Study A's continuation, not Study B's move, and does not update FSRS.
An unexpected legal move is described as outside the practiced line, not
objectively bad without separate evidence.

This is preferable to making the user review the exact same board twice.

---

## 8. Proposed opening data model

Names are illustrative.

### `opening_studies`

Account-owned.

Fields:

- `id`
- `user_id`
- `source` — `lichess_catalogue` or `course_line`
- `source_version` — catalogue version or immutable course revision
- `source_key` — catalogue record key or course ID plus repertoire-line ID
- `initial_fen`
- immutable selected move sequence (including both colors), with content revision
- `name`
- `eco` — optional
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

Reuse the scheduler and stored learning history. Apply the explicit content-change
and eligibility rules below rather than assuming every existing lifecycle guard
can remain unchanged.

Opening recall should use the same existing Review/FSRS mechanics:

- FSRS implementation;
- first-failure semantics;
- timing;
- retry behavior;
- reveal behavior;
- retirement history, with explicit content-change reactivation;
- restart persistence.

Do not create a second scheduler.

---

## 9. Opening study lifecycle

### Adding a study

1. Resolve and validate the selected catalogue or designated course line at its saved revision.
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

Retired cards with a changed answer set reactivate due now; unchanged retired
cards remain retired. Record the content revision that caused reactivation so
startup reconciliation cannot retire the card again based on its old interval.
This retired-card rule takes precedence over the answer-added scheduling rule.

Disabling the final contributor is an eligibility change, not a new learning
target. When restoring an inactive card, compare its restored answers with its
last active answer set, not the empty inactive projection. Restoring unchanged
material preserves its schedule and retirement; changed material follows the
content-change rules above.

### Attempts spanning a content change

Each opening recall session snapshots its accepted-answer revision, answers and
contributing study provenance before the first attempt. Use a monotonic revision
that changes when the accepted answers change; changing them and later restoring
the same set must not make an old session current again. A title-only edit does
not change answer authority or invalidate a recall.

Deactivation also invalidates prior sessions for scheduling even if the same
material is restored later; this session guard does not itself reset a card's
schedule or retirement.

An edit or deactivation in another tab does not change that session's grading or
historical feedback. The learner may resume, finish or reveal against its saved
answers. Before recording an FSRS recall, atomically check that the answer revision
is still current and the card is eligible and active.

If the revision changed or the card became inactive, save the attempt and session
outcome with an explicit non-scheduling reason, but do not call FSRS, create a new
ordinary Review row, or change the serialized card, due date, review/lapse counts
or retirement. The current card keeps the content-change schedule. Feedback must
say that the attempt was saved without updating the current review schedule.

If a first failure had already recorded a recall before the content changed,
preserve that valid historical review and its effects; later retries/reveal must
not schedule again or undo it. New sessions and automatic queue entries use the
current eligible content. Old sessions are directly resumable for feedback but
must not displace current material in the Due queue. Apply this rule consistently
to submit, reveal and reload, with no effect on ordinary unchanged game recalls.

The catalogue provides named lines, not complete coverage of every opponent
response. Show the actual continuation and study-position count before adding a
line. Progress describes positions practiced or retained; recalling one accepted
move does not establish mastery of every contributing variation.

---

## 10. Opening cards in Study → Due

The **Due** queue inside Study should remain mixed.

A due opening card and a due game-derived card are both genuine recall tasks.

Opening recall tests the studied move, not whether the learner can identify an
unlabeled opening. Show the opening name in both dedicated opening study and the
mixed Due queue, with the prompt **"Play your studied move."** Dedicated practice
also shows the selected variation and study color and accepts that line's moves
only. Mixed Due uses the combined active answers at a shared position, snapshotted
when its recall session starts. Its context must not imply that only one
contributing study's move is accepted. Dedicated practice does not update FSRS.

Before the attempt, keep expected moves, future continuations, engine scores and
tactical hints hidden. The opening label is intentional study context, not an
answer leak. Game-derived recall and puzzles retain their existing no-hint rules.

After the attempt or reveal, feedback may show:

- opening name;
- ECO;
- selected study line(s);
- expected move(s);
- optional short continuation preview.

An unlabeled mixed opening drill may be considered later; it is not required for
V1 and must not dictate the normal opening-study experience.

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

- coach may name the opening and ask the learner to play their studied move;
- coach must not reveal the expected move, continuation or tactical hints.

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

# Part I-A — Guided Lesson Framework

## Teaching experience

Lessons teach how an opening develops and what the learner is trying to achieve.
The board carries the explanation; avoid long blocks of prose. Opening identity,
selected variation and learner color are visible. Hints are appropriate during
guided learning and are withdrawn during independent rehearsal.

A course contains short chapters organized around questions: how we reach a
position, our plan, what changes after another opponent response, and how the
opening develops in actual games. A chapter can start from the initial position
and walk into its target position rather than presenting an unexplained FEN.

Use one active branch at a time with a clear return to its main-line anchor.
Illustrative games should teach different ideas, not repeat the same lesson.
Support annotated excerpts with a walkthrough of how the position arose, plus
optional full-game playback. Learners need not step through irrelevant moves to
reach an explanation.

## Versioned course contract

Author structured lesson files initially; a graphical course editor is deferred.
Define a small versioned contract with stable course/chapter/step IDs, content
revision, title, learner color, ordered chapters, source attribution and explicit
line references. Validate all FENs, moves, branches and references through
python-chess. Do not introduce another board or legality implementation.

Supported step types:

- **Explanation:** concise supported teaching text and optional board annotations.
- **Demonstration:** play a legal move or short sequence with explanation.
- **Learner decision:** explicit accepted moves, hint/reveal behavior and feedback.
- **Branch:** explore a named alternative and return to a defined anchor.
- **Game excerpt:** replay an annotated passage with access to its source game.
- **Rehearsal:** play the selected line independently, with opponent replies.

Every accepted move must have a defined next step or explicit terminal outcome;
an accepted alternative cannot fall through to a continuation for another move.
Validate that transitions start from their actual resulting positions. A branch
return restores its anchor's board/history and lesson context, not merely a step
index. Keep these rules in the lesson player; presentation animation must not
decide which chess state or lesson step is authoritative.

Step authority must be explicit. "Play this lesson's move" grades against authored
content; it must not masquerade as "find any good move." Unexpected legal moves
receive line-specific feedback, not invented engine judgments. Lesson facts and
authored explanations remain independent of coach selection; personality only
changes supported presentation.

## Player and persistence

Reuse the shared review workspace, board interaction, promotion controls, coach
and motion preferences. On mobile the coach and its buttons stay above the board.
Keep one short explanation or question visible, with Back, Continue and Show move
when appropriate. Chapter navigation must not expose answers during rehearsal.

Save account-owned progress, course revision, chapter/step, active branch and
rehearsal position so leaving or reloading restores the exact logical state.
Moving backward or replaying a demonstration must not create extra completions.
Resume cannot double-play an automatic opponent move. Store completed content
revision; updates must not silently reinterpret old progress. Preserve the old
revision for an active session or explicitly offer starting the updated chapter.

Progress means viewed, attempted or completed content, not mastery. Guided work
and rehearsal create no Review rows, SRS changes or weakness evidence. Adding a
designated repertoire line to scheduled study is an explicit action using the
shared opening-study domain and its `course_line` source. Persist its immutable
move sequence and source revision. Completing a lesson or viewing an example
game does not automatically enroll its moves.

## Framework first; Italian Game afterward

Develop every step type with small deterministic fixtures. Fixtures are test/dev
content and must not appear as unfinished production courses. Production handles
an empty course library honestly until the first course is installed.

The subsequent Italian Game course should cover introduction, a guided main
continuation, meaningful opponent alternatives, several illustrative games, and
independent rehearsal. Choose the actual learner side and chapter content during
that pass. Do not generate other opening courses in this sprint.

The existing opening catalogue provides move sequences, not a teaching curriculum
or annotated game collection. Record provenance and verify reuse permissions for
course sources; write or use permitted explanations and validate their chess
claims. Resource availability alone is not permission to copy annotations.

## Required verification

- Legal replay and stable branch return points for every step type.
- Correct/incorrect decisions, hints, reveal, rehearsal and promotion.
- Exact account-isolated resume, including reload during automatic playback.
- Content revision changes and preserved historical completion.
- No FSRS/Review/weakness side effects from lessons or dedicated rehearsal.
- Explicit line enrollment and correct dedicated-versus-mixed answer authority.
- Shared desktop/mobile layout, motion preferences and coach switching.
- Empty production library and exclusion of development fixtures.

The lesson-player checkpoint is completed in Phase 2. Line-enrollment integration
is verified in Phase 3 after the opening-study domain is available.

### Connected framework acceptance chapter

Before declaring the lesson framework complete, exercise one short development
chapter that connects explanation → demonstration → learner decision → alternative
branch → return → game excerpt → independent rehearsal. Keep it as a small
test/dev fixture, not an early production course.

Automated coverage and manual walkthroughs must exercise Back, Show move/reveal,
reload and coach switching across this sequence, including reload during automatic
playback and while inside the branch. Check exact board/history and step restoration,
defined continuation for every accepted move, stable branch return, no duplicate
completion and no FSRS/Review/weakness effects. Test the combined flow on desktop
and mobile; isolated step-type tests alone do not complete this checkpoint.

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

A wrong move leaves the learner at the same decision, preserving earlier correct
steps. Retrying successfully records "failed then solved," never a clean solve.
Keep solution authority on the server; active-session responses expose only the
current position and permitted feedback, not future answers. Duplicate requests,
simultaneous tabs and reloads during opponent playback must not advance twice.
Resume restores committed chess state; animation is only its presentation.

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

**Later content integration.** This sprint builds and tests the provider boundary
and normalized player with fixtures. Bulk packs, acquisition UI and a production
puzzle catalogue are not framework deliverables.

## 16. Generic puzzle source

Use a provider boundary.

The future generic-puzzle release should use a **local Lichess-compatible puzzle pack** because:

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

The exact pack size can be decided during that future content-integration work.

---

## 17. Generic puzzle selection

Future generic-puzzle release filters:

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

The future generic-puzzle release may use the provider's accepted line exactly.

However, Fieldwork should not architect itself into falsely rejecting alternatives forever.

The normalized contract should leave room for:

- multiple accepted solver moves at a node;
- future local Stockfish verification of unlisted alternatives;
- branch continuation after an accepted alternative.

That can follow the initial generic-puzzle content integration; it is not part of
the current framework sprint.

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

**Deferred in full.** Do not implement candidate discovery, puzzle generation or
generation jobs in this sprint. Retain the following requirements for later work;
the current framework only leaves a clean source interface for saved definitions.

## 20. Purpose

Game-derived SRS currently asks:

> "At this position from one of my games, can I find an acceptable decision?"

A game-derived puzzle should ask:

> "Can I calculate and execute the tactical continuation that existed in my game?"

These must feel different.

A puzzle should not simply wrap an existing single-move exercise in a new screen.

---

## 21. Candidate puzzle types

The future game-puzzle release should prioritize positions where the learner
**missed** a concrete tactical opportunity.

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

That future release should favor missed opportunities because they provide the
clearest learning value and strongest evidence.

---

## 22. Game-puzzle generation gates

Do not turn every engine swing into a puzzle.

A game position is eligible only when all required evidence gates pass.

Recommended gates:

1. **Learner to move**
   - the initial game-puzzle release keeps orientation with the learner.

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

7. **Clear intended move at every learner decision**
   - strictly verify every scored move, not just the first;
   - reject ambiguous candidates unless supported alternative continuations are explicitly represented;
   - a saved principal variation alone does not prove later moves are uniquely appropriate.

8. **Settled endpoint**
   - do not generate a puzzle whose claimed tactical payoff exists only in an unfinished/noisy tail.
   - independently validate defenses and the endpoint against the exact solution; do not copy shortened review playback frames as proof.

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

The future game-puzzle release can begin with a verified principal continuation
if generation gates are strict enough.

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

## Game puzzle generation — deferred, not part of this sprint

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
| Guided lesson / dedicated line rehearsal | Versioned authored lesson / selected line | No | No | Not required |
| Focused Weakness practice | Existing exercise authority | No | No | Existing behavior |
| Generic puzzle | Puzzle provider / validated solution | No | No | Later optional alternative verification |
| Game-derived puzzle | Saved Stockfish/evidence-backed solution | No | No | Optional bounded branch verification |

This matrix should remain explicit in code and documentation.

---

# Part VIII — Testing Requirements

## 31. Opening tests

Backend:

- catalogue and designated course-line validation through the shared study domain;
- course-line enrollment works without a matching catalogue entry and pins its revision/content;
- repeated source revision/line/color enrollment reuses the account's study;
- example games, counterexamples and undesignated branches cannot be enrolled as course repertoire lines;
- White-only and Black-only card creation;
- transpositions merge into one exercise;
- multiple active studies union their accepted moves;
- dedicated practice uses only its selected line and never updates FSRS;
- mixed Due snapshots the combined active answer set and displays context consistent with it;
- disabling one study removes only its contribution;
- disabling the final contributor makes the card ineligible;
- re-enabling preserves prior FSRS history;
- disabling/restoring unchanged material preserves its schedule and retirement, while pre-deactivation sessions remain non-scheduling;
- stale sessions retain their original grading/feedback but cannot update the current FSRS card, due date, counts or retirement;
- changing answers back does not revalidate a stale session; title-only edits do not invalidate a current one;
- a first-failure recall recorded before a content change remains intact, with no second recall on retry/reveal;
- submit/reveal versus content changes is atomic, and stale sessions cannot displace current Due material;
- archived `source="repertoire"` remains excluded and untouched;
- out-of-study legal moves fail without Stockfish fallback;
- opening cards enter the normal Study → Due queue;
- opening name and studied-move prompt appear before attempts in dedicated study and mixed Due;
- expected answers, future continuations and tactical hints remain hidden before feedback;
- game-derived cold recall retains its existing no-hint behavior;
- account isolation;
- restart persistence;
- promotion/castling/en-passant where applicable.

Browser:

- browse/search catalogue;
- add study;
- explicitly enroll a designated lesson line and verify its provenance in Due;
- see card in Study → Due;
- fail/retry/reveal;
- correct answer;
- visible opening context and post-answer continuation metadata;
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

## 33. Game-puzzle tests — future generation phase

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
- multiple sound first moves and ambiguous later learner decisions.

---

# Part IX — Implementation Order

## Phase 1 — Study navigation and puzzle framework

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

Introduce minimal Study navigation, preserve existing review links, and expose
honest empty states. Include the source interface, versioned definitions and
account-isolated resume; do not install bulk packs or generate puzzles.

---

## Phase 2 — Lesson framework

Build the structured lesson player described in Part I-A using development
fixtures, not a production opening collection.

Deliver:

- course/chapter/step schema and legal-content validation;
- explanations, demonstrations, learner decisions and branch return;
- annotated game excerpts and full-game playback;
- independent line rehearsal;
- account-owned progress, exact resume and content revisions;
- shared coach/board presentation with no learning-statistic side effects;
- the connected acceptance chapter passes automated and manual desktop/mobile checks.

---

## Phase 3 — Opening SRS

Add Opening Study using the existing Review/FSRS infrastructure, surfaced as **Study → Due** rather than a separate Review destination.

Deliver:

- opening catalogue browser;
- add/remove study;
- shared/transposed opening cards;
- curated grading;
- normal Study → Due integration;
- visible opening context and post-answer continuation metadata;
- explicit catalogue/course-line enrollment and dedicated-practice answer scope;
- answer snapshots, stale-session scheduling isolation and content-change lifecycle tests.

This phase must explicitly leave archived Repertoire untouched.

---

## Phase 4 — First Italian Game course

After both frameworks work, author one carefully sourced course. Use it to refine
the lesson player at real UI sizes rather than generating a broad opening library.

Deliver:

- introduction and guided main continuation;
- meaningful opponent alternatives;
- several illustrative game passages with distinct teaching purposes;
- independent rehearsal and optional line enrollment into Due;
- verified chess content, attribution and reuse permissions.

---

## Phase 5 — Integration and release quality

Verify the frameworks and Italian course together:

- accurate Study counts and distinct lesson/practice/retention progress;
- desktop/mobile, motion settings, navigation and coach consistency;
- account isolation, reload/resume, duplicate requests and content updates;
- migration/install behavior, automated coverage and manual walkthroughs;
- living documentation and coherent verified commits.

## Later work — not part of this sprint

Production generic puzzle-pack acquisition, game-derived puzzle generation and
its jobs, additional opening courses, favorites and broader practice modes remain
separate follow-ups. Future puzzle creation must meet the strict gates in Part IV.

---

# Part X — Explicit Non-Goals for V1

Do not let these features expand uncontrollably.

Not required for the first implementation:

- game-derived puzzle creation or generation jobs;
- bulk generic puzzle acquisition;
- mass production of opening courses beyond the Italian Game pilot;
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

Only eligible, current scheduled recall inside **Study → Due** advances the FSRS
memory model. Enrollment and documented eligibility/content-change policies may
manage a card's schedule without counting as a recall or a lapse.

Puzzle solving, guided lessons and dedicated rehearsal never advance FSRS or
change review schedules.

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

Do not reveal expected moves, tactical hints or future solutions before feedback
is allowed. Game-derived recall and puzzles also hide answer-revealing source
context. Opening recall deliberately shows the opening name and studied-move
prompt: the task is remembering the repertoire move, not identifying the opening.

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
Study → Openings ──────────→ learn lessons, rehearse lines, choose recall material
   ↓
Study → Due ──────────────→ retain that repertoire with FSRS

TACTICAL PRACTICE
   ↓
Study → Puzzles
   ├─ Generic (later content) → practice broad calculation/patterns
   └─ From your games (later) → calculate concrete opportunities you encountered
```

All of them can share the same board, coach, interaction polish, and local-first philosophy.

They should **not** share learning claims they have not earned.

---

# Decision record — September 28, 2026

The earlier review notes are now incorporated into the main specification.

- Opening identity remains visible; actual recall answers stay hidden until feedback.
- Dedicated variation practice uses that variation's answers and does not update FSRS.
- Mixed Due uses the union of active study answers at a shared position.
- Lessons teach positions in context, with branches and illustrative games; they are
  a substantial framework deliverable, not a catalogue preview.
- Build lesson and puzzle infrastructure with development fixtures first, then one
  Italian Game course. Do not generate a large opening collection.
- Puzzle generation is explicitly deferred. Future creation must verify clear
  intended moves at every learner decision, defensive replies and the endpoint.
- Opening content and active-attempt answers are versioned. Deactivation preserves
  history; content changes have explicit scheduling rules distinct from reviews.
- Catalogue and designated course lines share enrollment; example games are not
  implicitly repertoire material.
- Outdated recall sessions preserve feedback/history without changing the current
  card's FSRS state. Already-recorded valid recalls are not erased.
- Lesson framework completion requires a connected acceptance chapter, not only
  isolated demonstrations of each step type.
- Imports remain in Settings; Games retains its compact Update games action.
- Standard retry, resume and concurrency behavior is an engineering requirement,
  not a separate product decision for the owner.

Remaining content decisions: the Italian course's learner side, precise chapters,
example games and permitted source material will be selected during its content
pass. The framework must not assume these choices in advance.
