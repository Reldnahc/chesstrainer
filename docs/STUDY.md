# Study

Study is the learning destination. Its modes keep separate meanings:

| Mode | Answer authority | Saved history | Scheduling |
|---|---|---|---|
| Due: game decisions | Saved Fieldwork policy and verified Stockfish alternatives | Review sessions and attempts | Existing FSRS |
| Puzzles | Versioned provider solution | Puzzle sessions and attempts | None |
| Guided lessons and rehearsal | Authored course revision / selected line | Lesson progress and commands | None |

The shared `Board`, `ReviewWorkspace` and `ReviewCoach` own presentation. Python
supplies legal moves and accepted continuations. Motion never decides whether a
move succeeded or advances a saved session. On phones the coach and its actions
remain above the board. Each active experience has a bookmarkable session URL.

## Navigation compatibility

`/study` is the learning home; `/study/due` exposes the existing recall domain.
`/review`, root exercise links and focused Weakness links resolve to Due through
history replacement. Legacy `unit` links are stripped, not revived. Imports stay
in Settings and saved game analysis stays in Games.

## Puzzle boundary

`backend/trainer/puzzles` owns validated `line-v1` definitions and a small provider
protocol. Providers return locally available definitions visible to the bound
account. No network acquisition runs when opening or solving a puzzle. Production
starts without a puzzle collection; generic packs and game-derived generation are
separate future work. Tests inject their fixtures into the application explicitly.

A definition pins its initial FEN, learner color, complete solution, source,
version and attribution. Every move must belong to python-chess's legal move set;
null moves are not valid content. A solution starts and ends with a learner
decision. Game-derived definitions additionally require two learner decisions.
This validates replay, not the pedagogical quality or uniqueness of a future
provider's puzzle. Future acquisition/generation must apply the stricter creation
gates in the [approved specification](../FIELDWORK_STUDY_EXPANSION.md).

Starting a puzzle stores an immutable private snapshot. A move command includes a
request ID and expected session revision. A successful learner move and its known
opponent response commit atomically. A wrong legal move records an attempt without
advancing; the eventual solve remains failed-then-solved. Reveal is terminal.
Retrying an identical command returns its original response; conflicting reuse or
a stale revision returns 409. A client with an ambiguous/lost response reloads
committed state before another write.

Active HTTP responses contain only current legal moves, committed history and
permitted feedback. Completion unlocks solution, themes, rating and attribution.
The browser animates response frames but GET/resume has no pending automatic
reply. Definitions can be removed or revised without changing an existing solve.
Puzzle history does not create exercises, engine searches, ordinary Review rows,
FSRS changes or weakness evidence.

Library statistics use lightweight account-scoped aggregates. Resume lists contain
at most the twenty most recently updated unfinished sessions; direct links to
older sessions remain valid. No puzzle rating or practice count is described as
mastery or evidence of transfer into games.

## Guided lessons

`backend/trainer/study_lessons` owns `course-v1` content. Course providers expose
immutable revisions with attribution, chapters, explicitly designated repertoire
lines and source games. Production content is separate from injected test
providers. The new domain never reads or writes the archived Course/Lesson rows.

The six step kinds are explanation, demonstration, decision, branch, game excerpt
and independent rehearsal. Content validation replays every move, checks legal
history at graph edges and requires explicit targets for each accepted decision
alternative. A branch retains its exact anchor and has an explicit return action.
Excerpts can open the entire source game's known history and return to the same
lesson context. Only excerpts and rehearsals can intentionally establish a new
position/history; ordinary step transitions cannot silently replace the board.

Each lesson session pins the complete course revision and its content hash. A
provider cannot silently replace a saved revision, and saved sessions still work
after that provider disappears. Mutations use request IDs, expected revisions and
the account mutation lock. Duplicate commands return their original response;
stale writes return 409. Session navigation, branch anchors and source-game cursors
are persistent. Back/replay never erases assistance/failure flags or first
completion time. Chapter progress records viewing, attempts and completion, not
mastery. None of these actions writes ordinary Review, FSRS or weakness evidence.

Rehearsal responses withhold future moves, answers and annotations. Decisions may
offer authored guidance; a wrong move stays on the same decision. Show move is
explicit assistance. Accepted moves and automatic replies commit together before
browser playback starts. `useStudyPlayback` shares presentation timing between
puzzles and lessons, while each mode keeps its own server state machine. Still
mode changes presentation only. Annotations belong to the displayed position and
are suppressed during intermediate animation frames.

The `/study/openings` library links course chapters and recent resumable sessions.
`/study/openings/courses/:id?revision=…` pins the chapter list, and
`/study/openings/sessions/:id` resumes the exact private player state.

## Verification

`backend/tests/test_puzzles.py` covers both colors and special moves, malformed
definitions, cold data, durable replay, duplicate and stale commands, concurrent
tabs, account reads/writes and preservation of existing learning records.
`frontend/tests/study-puzzles.spec.ts` exercises the production player through the
test-only fixture provider on desktop and mobile. It covers retries, playback,
reload, Still/device motion, promotion, coach changes and late-response cleanup.

`test_study_lessons.py` validates content graphs, player transitions, ownership,
idempotency and persistence. `test_lesson_journey.py` and `study-lessons.spec.ts`
exercise one connected chapter across all six step types, including Back, branch
reload/return, full-game context, hints/reveal and independent rehearsal.

The production registry must never import test fixture providers or enable
development content through an environment switch.
