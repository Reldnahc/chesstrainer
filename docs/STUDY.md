# Study

Study is the learning destination. Its modes keep separate meanings:

| Mode | Answer authority | Saved history | Scheduling |
|---|---|---|---|
| Due: game decisions | Saved Fieldwork policy and verified Stockfish alternatives | Review sessions and attempts | Existing FSRS |
| Due: opening decisions | Union of active selected study continuations | Existing Review plus immutable opening-answer snapshot | Existing FSRS, only for current eligible material |
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
The Study home cards lead to Due, Openings and Puzzles. The main navigation's
Study link returns to that overview; subpages do not repeat a section selector.

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
New lesson feedback or steps reset the explanation's scroll position without
remounting the coach or moving keyboard focus.

The `/study/openings` library links course chapters and recent resumable sessions.
`/study/openings/courses/:id?revision=…` pins the chapter list, and
`/study/openings/sessions/:id` resumes the exact private player state.

### Included Italian course

The bundled `italian-foundations` course (`2026-09-v1`) teaches White through three
chapters: develop and castle, prepare the center, and meet the Two Knights. Its
25 authored steps include a returnable opponent alternative, three contrasting
historical game passages and independent rehearsal. Three short designated lines
are available for optional enrollment; viewing or completing a chapter never
adds them to Due automatically.

Mason–Lasker, Steinitz–von Bardeleben and Pollock–Schiffers (Hastings 1895) provide
complete game context. Their scores come from the public-domain original
tournament book; Fieldwork's explanations are original. These games illustrate
choices, not a claim that every move was best. Source differences and exact
endpoints are recorded in [Italian course sources](ITALIAN_COURSE_SOURCES.md).
The library loads locally without downloads or engine jobs. New material must
use a new revision rather than changing a saved course's meaning.

## Opening study and recall

Catalogue records come from the already bundled, pinned CC0 Lichess opening
catalogue. They are named lines, not coverage of every opponent response or an
engine recommendation. Preview shows the complete continuation and decision
counts for either side. Authored courses may designate additional repertoire
lines; illustrative games and arbitrary branches cannot be enrolled. Both sources
normalize to the same full legal line, starting FEN and versioned identity. A
study pins that content and color instead of following future provider updates.

Enrollment creates `source="opening"` exercises only for the chosen side's
decisions. One account/position/orientation has one opening card, even if several
selected lines reach it through transpositions. Its accepted answers are the
union of active contributions. Dedicated line rehearsal accepts only that line's
continuation and never schedules; it reuses the lesson player. The archived
`source="repertoire"` domain stays excluded.

Due deliberately shows opening names and “Play your studied move.” Multiple
contributing names describe the combined study context, not a single forced line.
Answers, future continuations and tactical hints stay hidden until feedback. A
different legal move is outside the chosen study; that is not an objective chess
mistake. No Stockfish search can turn it into a successful repertoire recall.
Game-derived cold recalls keep their existing stricter no-source-context rule.

Each opening recall snapshots its accepted answers, contributing source metadata
and a monotonic authority revision. Submit, reveal and explanation use that
snapshot. An answer change or deactivation invalidates old scheduling authority,
even if the same answer set is restored later. Direct resume can finish the old
attempt, but explicitly reports that it is saved without updating the current
schedule. No scheduler call, new Review row, card/count/due/retirement write is
allowed for a stale attempt. A valid first-failure Review already recorded before
a content change stays intact; retries never record it again. Stale unfinished
sessions do not displace current material in the automatic Due queue.

Content changes are not memory outcomes. Adding an answer preserves an active
card's schedule. Removing an answer while the card stays active makes a future
due date due now without changing review/lapse counts. Disabling the last
contributor preserves the saved card, history and retirement. Restore compares
with the last active answers, so unchanged material keeps its schedule and
retirement. Changed retired material becomes eligible and due now, with a guard
against startup retiring it again from its old interval. A fresh valid recall
then returns it to ordinary retirement policy. Content-policy changes are audited
separately from FSRS reviews.

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
