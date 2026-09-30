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

Session-start controls retain the selected content and request ID after an
ambiguous network failure. Retrying the same action resumes the committed
lesson, rehearsal or puzzle rather than creating a duplicate or selecting a
different puzzle. An acknowledged start or a different target uses a new ID.

Answer comparisons use python-chess move identities, including equivalent
castling notation. Playback and answer views expose canonical UCI moves. Course
and opening source snapshots remain immutable; normalizing an opening answer's
spelling alone does not invalidate recalls or change retirement and due dates.

## Navigation compatibility

`/study` is the learning home; `/study/due` exposes the existing recall domain.
`/review`, root exercise links and focused Weakness links resolve to Due through
history replacement. Legacy `unit` links are stripped, not revived. Imports stay
in Settings and saved game analysis stays in Games.
The Study home cards lead to Due, Openings and Puzzles. The main navigation's
Study link returns to that overview; subpages do not repeat a section selector.
Overview cards place descriptions below their headings and show the scheduled
recall and active opening-line counts separately. Opening counts reflect enrolled
active lines, including zero; merely viewing a lesson does not increase them.

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
provider's puzzle. Future acquisition/generation must apply the stricter
[deferred-content requirements](#deferred-content-requirements) below.

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

Provider revisions must remain immutable. Whole-course fingerprint enforcement
starts when lesson progress exists; opening-only enrollment pins each selected
line. Before any lesson is started, reusing a revision for a changed course can
still admit a different newly selected line. Existing study and recall snapshots
remain unchanged. Enforcing whole-course identity at the first opening-only
enrollment is a remaining provider-validation hardening opportunity.

Rehearsal responses withhold future moves, answers and annotations. Decisions may
offer authored guidance; a wrong move stays on the same decision. Show move is
explicit assistance. Accepted moves and automatic replies commit together before
browser playback starts. Entering a rehearsal through a branch or a context-reset
transition also returns any automatic opening reply as playback; resuming the
saved session never replays it. `useStudyPlayback` shares playback behavior between
puzzles and lessons, while each mode keeps its own server state machine. Lessons
hold each move for 1.2 seconds so continuations are readable; puzzle replies keep
their 0.4-second cadence. Piece travel still takes 280 milliseconds. Still
mode changes presentation only. Full-game next/previous, restart and return
controls interrupt playback rather than waiting for its timer. The game title and
current position note stay visible throughout animation, without a temporary
demonstration prompt or a second explanation scroll reset. The game-view coach
keeps its expression and ongoing animation across seeks. Pending game controls
use `aria-disabled` without fading; native disabled styling is reserved for
actual game boundaries or errors. Commands remain serialized while requests
are pending; guided lesson controls still wait for
their continuation to finish. Annotations belong to the displayed position and
are suppressed during intermediate animation frames.
New lesson feedback or steps reset the explanation's scroll position without
remounting the coach or moving keyboard focus.

The `/study/openings` library links course chapters and recent resumable sessions.
`/study/openings/courses/:id?revision=…` pins the chapter list, and
`/study/openings/sessions/:id` resumes the exact private player state.

### Included courses

All three courses ship locally and use the same player, account progress and
explicit line-enrollment flow. They are focused repertoires: an authored answer
is a move chosen for that lesson, not a claim that every other legal move is bad.
Historical games illustrate plans and mistakes; their moves are not all
recommendations. No course starts an engine job or downloads material at runtime.

| Course | Side | Chapters | Source record |
|---|---|---|---|
| Italian Game · A quiet White repertoire | White | Recognize the setup; finish development and adapt to threats; carry out and reassess the central break | [Italian sources](ITALIAN_COURSE_SOURCES.md) |
| Italian Game · A practical Black repertoire | Black | Quiet development; choose a post-castling plan; meet c3/d4; respond to the Evans Gambit | [Black Italian sources](ITALIAN_BLACK_COURSE_SOURCES.md) |
| King's Gambit · Active play with White | White | Modern Defense; the ...g5 pawn chain; bishop-first refusal; the Falkbeer countergambit | [King’s Gambit sources](KINGS_GAMBIT_COURSE_SOURCES.md) |

The current revisions are `2026-09-v2` for `italian-foundations`, and
`2026-09-v3` for `italian-black-foundations` and `kings-gambit-foundations`.
Black decisions and rehearsal use Black orientation
and automatically play White’s intervening replies. All three course definitions
are cached as immutable source data and returned as independent copies. Shared
SAN authoring helpers produce the same validated content format. Existing saved
sessions, enrolled lines and their earlier revisions retain their own snapshots.

### Reviewing authored course quality

Legal histories and passing player tests establish that a course works, not that
it teaches good chess. Before publishing or revising a course:

- Choose chapter boundaries from the opening's actual decisions and learning
  prerequisites. There is no standard chapter count. Split when a new pawn
  structure, opponent plan or independently useful skill needs its own practice;
  condense repeated move orders into a comparison when they reach the same plan.
  Keep a connected tactical sequence together when splitting would hide its
  consequences. Record what each chapter teaches and why it is a separate unit
  in the course's source record.
- Check the actual chosen move orders against identified instructional sources.
  An old game's legal score does not establish that its opening choices remain
  good recommendations. Separate historical play from taught continuations.
- Investigate both sides of the scripted line. A reasonable learner move can look
  deceptively easy if the supplied opponent reply avoids the critical defense.
  Compare important alternatives with bounded native engine analysis, and record
  the engine/budget and uncertainty in the source record.
- Explain the purpose of decisions and important tempting mistakes. Use existing
  returnable demonstrations for counterexamples; do not put deliberate mistakes
  into the learner's required answers or recall lines.
- Give the learner a chance to apply the explanation. Purpose-based prompts may
  scaffold a decision; explicit destinations belong in hints where practical.
  A longer line or more prose is not evidence of better teaching. Later rehearsal
  may begin at an already established position while retaining its complete legal
  history. Optional Due enrollment still uses the complete source line and the
  existing position-based deduplication; anchoring rehearsal does not change it.
- End a line with a concrete plan grounded in that position: remaining development,
  king safety, central breaks and the opponent's resources. Avoid promising an
  advantage from development or an attack merely because the opening is a gambit.
- Check that historical excerpts teach a transferable idea and clearly identify
  where they differ from the repertoire. Keep their factual scores, original
  teaching prose and source attribution distinct.
- Bump the course revision when content changes. Saved sessions and enrolled lines
  retain their original snapshots; a new revision must not rewrite a learner's
  old progress or scheduled answers.

The September 2026 second review corrected substantive gaps in both new courses;
their source records document the research, decisions and remaining boundaries.

#### White Italian course

The original pilot's repeated Two Knights setup is now a returnable comparison
within the introduction. The later chapters connect development to bishop
management and recapture choices, then actually play d4 and respond to Black's
central resources. Short optional comparisons distinguish a premature break
from a prepared one and require responding to a bishop threat rather than
blindly repeating the setup. Later rehearsal starts from an established position,
retaining its full legal history. Only designated lines are available for optional
enrollment; viewing or completing a chapter never adds them to Due automatically.

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
Course-line links preserve the course's learner side in the URL, so Black course
previews default to Black even after reload. The existing side selector still
allows choosing either side before enrollment.

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

## Deferred content requirements

The lesson/opening/puzzle framework sprint is complete. Production puzzle packs,
game-derived generation and additional courses are separate future work. The
following requirements preserve the owner's decisions from the completed plan;
they do not authorize implementing that work during maintenance.

### Generic puzzle packs

Use an explicitly installed local, versioned and hash-pinned Lichess-compatible
pack. Acquisition may offer a small starter pack or an install action, but normal
startup must not silently download a large dataset and solving must work offline.
The product provider boundary stays independent of the developer benchmark
harness. Validate initial positions and every solution move, including special
moves, and preserve source attribution. Provider solutions are the answer
authority; future accepted alternatives require explicit continuation support.

Later selection can prefer unseen puzzles within a requested difficulty band,
avoid recent repeats and offer theme filters and a separate Retry failed mode.
This is deliberate practice, without FSRS due dates or an implied mastery score.

### Puzzles from saved games

Prioritize missed concrete tactical opportunities from the learner's perspective.
Do not turn every evaluation swing or single-move recall into a puzzle. All of
these creation gates must pass:

1. The learner is to move and has more than one legal move.
2. Saved evidence supports a missed mate, meaningful material gain, tactical
   mechanism or concrete defensive resource.
3. The solution includes at least two learner decisions, with legal opponent
   replies between them; python-chess validates the entire history.
4. Every scored learner decision has a clear intended move. Represent supported
   alternatives with valid continuations or reject the ambiguous candidate.
5. Verify defenses and the settled tactical endpoint against the exact solution.
   A saved principal variation or shortened review playback alone does not prove
   uniqueness, forced replies or the claimed payoff.
6. Pin source game/ply, engine and tactical evidence references, generator version
   and definition identity so the result is reproducible and explainable.

Abstain when any gate lacks support. Stockfish and saved evidence own generated
solutions; neither the coach nor the UI invents a continuation. The model must
allow future solution graphs with multiple accepted solver moves.

Generation should be explicit, bounded, persisted, cancellable, resumable and
cacheable, rather than rerunning when the player opens a page. Updated engine or
generator evidence creates or supersedes a definition version; it never rewrites
completed puzzle history or active snapshots.

A future queue should prefer unseen recent missed opportunities, deduplicate legal
positions, avoid consecutive puzzles from one game when alternatives exist, and
offer explicit retries of failures. Source matchup/date, original move, exact
game/ply link, themes, payoff and full solution unlock only after completion or
reveal. Cold play must not expose future solution length or other tactical hints.
Puzzle practice never updates FSRS, ordinary recall history or weakness evidence,
and does not prove that training transferred into later games.

### Other deferred study work

Additional opening courses, arbitrary opening PGN/Lichess Study imports, repertoire
tree editing, favorite-position lines, external source synchronization, graphical
course authoring and broader practice modes require separate product work. Existing
catalogue browsing and the Italian pilot are not authorization to generate a large
course collection. Preserve the shared board/coach and the distinct source,
scheduling and historical-snapshot authorities when extending these features.
