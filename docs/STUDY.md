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
recall and active opening-line counts separately. The Puzzles card's count is
installed puzzles not yet solved, and its description gives how many distinct
installed puzzles have been solved at least once (a solve after a mistake counts;
a reveal or a repeat solve does not add one). Opening counts reflect enrolled
active lines, including zero; merely viewing a lesson does not increase them.

## Puzzle boundary

`backend/trainer/puzzles` owns validated `line-v1` definitions and a small provider
protocol. Providers return locally available definitions visible to the bound
account. No network acquisition runs when opening or solving a puzzle. Production
serves hash-pinned local packs (below) and puzzles mined from the account's own
games ([Puzzles from your games](#puzzles-from-your-games)). Tests inject their
fixtures into the application explicitly, and `PUZZLE_STARTER_PACK=false` keeps
the library to the account's own puzzles.

### Puzzle packs

`packs.py` reads the public Lichess puzzle layout: the CSV FEN precedes the
opponent's setup move, token 1 of Moves is that setup move and the remaining
tokens are the solver's line. Each row becomes a learner-to-move definition
keyed by its PuzzleId, with the pack version, Lichess themes and rating, and an
attribution link to the puzzle. `manifest.json` pins the CSV by SHA-256 and
records how the rows were chosen. A pack with a changed file, bad row, duplicate
or wrong count is refused whole; definitions validate once per process and
session start uses an indexed lookup.

The bundled starter pack (`starter_pack/`, CC0, 972 puzzles) is weighted toward
lower ratings with solver lines of at most nine plies; its README records the
sampling. `scripts/build_puzzle_pack.py` rebuilds or enlarges a pack from a
downloaded dataset under a new version. `PUZZLE_PACK_PATH` adds a larger
installed pack, verified at startup. Saved solves keep their own snapshots across
pack revisions. Lichess themes and ratings are external labels; Fieldwork makes
no claim about a puzzle's pedagogical value.

#### Engine verification

`scripts/verify_puzzle_pack.py` is the evidence that a pack's solutions hold up
under Fieldwork's own engine, not only Lichess's generator and votes. For every
solver decision it runs bounded native Stockfish at one root and limit, as the
review pipeline does, and requires that the solution scores within 50 cp of the
engine's best move, that every other move is at least 100 cp worse (a second
mate of equal or shorter length fails, a slower one is a warning), and that the
line ends at least 150 cp ahead or in mate. Opponent replies are not graded.
Results stream to ignored `data/puzzle-verification/<run>/results.jsonl` with
`report.json` and `report.md`; `--resume` continues an interrupted run,
`--record` writes the summary, engine, depth, thresholds and failed IDs into
`manifest.json`, and `--prune` removes failed rows and re-pins the CSV.

The 2026-10-v1 starter pack was verified whole with Stockfish 18 at depth 18:
972 of 1,000 passed. The 28 removed puzzles were not wrong but ambiguous for
this player, which accepts only the pinned line: 27 had a second mate in one
(for example either rook capturing, or a rook underpromotion beside the queen
promotion), and one had an alternative within 4 cp. Lichess accepts any mate in
one there; Fieldwork's `line-v1` definitions do not yet carry accepted
alternatives, so those puzzles are excluded rather than mis-graded. Passing
means engine agreement at that depth, not pedagogical value.

### Puzzles from your games

`puzzles/generation.py` mines each analyzed game once per generator version
(`games-v1`) for missed mates and missed wins. Candidates come from evidence the
analysis job already saved: a training decision, or a full-game review move on a
ply the training pipeline never judged, where the learner was to move, the best
move was a forced mate the learner did not play, or the best move kept at least
+150 cp and the learner gave up at least 150 cp. Defensive resources are not
mined yet. Nothing is searched when a page opens.

For each candidate the line builder asks Stockfish for two lines at the learner's
root (`PUZZLE_GENERATION_DEPTH` 18, at most `PUZZLE_GENERATION_TIME` seconds per
search, through the shared engine cache). The best move is kept only if it is
unique by the pack verifier's margins in `puzzles/verification.py`: at least
100 cp better than the second line, or a mate with no equal or faster rival mate.
The opponent then plays the engine's best defence, not the move played in the
game. The line continues until the next learner move is no longer unique or the
position is mate, and is cut after the last learner move. It needs at least two
learner decisions, at most `PUZZLE_GENERATION_MAX_PLIES` plies (9, so five learner
moves), and must end in mate or at least +150 cp with the opponent to move. A
line that would need a sixth unique learner move abstains as `too_long` rather
than being cut mid-attack. A forced first move, a one-move tactic, an ambiguous
root or a thin payoff abstains, and a position
already serving a ready puzzle for the account abstains as a duplicate.

Kept lines become `source="games"` definitions keyed `game_id:ply`, with the
vendored Lichess tagger's motifs plus Lichess-style goal (`mate` and `mateInN`
only when the kept line ends in checkmate, otherwise `advantage`/`crushing`, so a
forced mate cut short by an ambiguous move is a crushing win), length
and phase themes, no rating, and provenance
naming the matchup, date, move number and the move actually played. Each row in
`game_puzzles` records its status, abstention reason, root and verification
analysis IDs, engine, depth and thresholds; `game_puzzle_searches` records one
search per game and version, including games where nothing qualified. The
account-bound `GamePuzzleProvider` serves ready rows of the current version, so
ownership filtering hides other accounts' puzzles and existing sessions keep
their snapshots when a later generator version supersedes a row.

Generation runs in two places. When `PUZZLE_GENERATION` is true, each analysis
job mines a game right after its decisions commit, on the same engine. `POST
/api/puzzles/generate` queues one `puzzle_generation` job (deduplicated while
queued or running) that searches at most `PUZZLE_GENERATION_GAMES` unsearched
analyzed games, newest first, with the usual progress, cancel and retry
controls; a cancelled search keeps the candidates it judged and resumes later.
The library's `generation` block reports analyzed, searched and unsearched
games, puzzles, candidates, kept lines, the last search time and a running job.
The Puzzles page shows this under a From your games source tab with the backfill
action; the player shows only "From your games" until completion, then the
provenance line and a link to that move in the game review. Generation writes
no exercise, recall, FSRS or weakness evidence.

### Selection

`GET /api/puzzles/next` accepts a source, rating bounds, one theme, a goal
(`mate`, or `material` for everything else) and a mode. New mode chooses
randomly among matching puzzles the account has not started; once everything
has been seen it skips the twenty most recently started puzzles before allowing
repeats. Retry mode offers puzzles whose latest finished attempt was revealed or
failed-then-solved, until a later clean solve; an unfinished retry is resumed,
not re-offered. The puzzles page keeps the chosen difficulty band, goal, theme
and mode for the tab so Next puzzle continues the same practice. Rating bands
are a convenience over the pack's own ratings, never a learner rating; own-game
puzzles carry no rating, so the page offers the goal filter instead of a band
for that source and a band query never matches them. No selection writes FSRS,
recall history or weakness evidence.

A definition pins its initial FEN, learner color, complete solution, source,
version and attribution. Every move must belong to python-chess's legal move set;
null moves are not valid content. A solution starts and ends with a learner
decision. Game-derived definitions additionally require two learner decisions.
This validates replay, not the pedagogical quality or uniqueness of a provider's
puzzle; the own-game generator applies the stricter gates above, and any other
acquisition must apply the [deferred-content requirements](#deferred-content-requirements) below.

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

Library statistics use lightweight account-scoped aggregates, plus pack
attribution, rating range, theme counts split by source (length and provenance
tags excluded; a source tab lists only its own themes) and how many puzzles are ready to retry. Resume lists contain at most the twenty
most recently updated unfinished sessions with at least one committed move or
reveal; an untouched start is not listed. Direct links to older sessions remain
valid. No puzzle rating or practice count is described as mastery or evidence of
transfer into games.

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
position/history within one starting position. An explanation may also begin a
separate example from a different starting position (initial FEN); the board
changes without move playback, and Back returns to the previous example. Other
transitions, including branches, cannot silently replace the board.

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

All four courses ship locally and use the same player and account progress; the
three opening courses also share the explicit line-enrollment flow. The opening
courses are focused repertoires: an authored answer is a move chosen for that
lesson, not a claim that every other legal move is bad.
Historical games illustrate plans and mistakes; their moves are not all
recommendations. No course starts an engine job or downloads material at runtime.

| Course | Side | Chapters | Source record |
|---|---|---|---|
| Italian Game · A quiet White repertoire | White | Recognize the setup; finish development and adapt to threats; carry out and reassess the central break | [Italian sources](ITALIAN_COURSE_SOURCES.md) |
| Italian Game · A practical Black repertoire | Black | Quiet development; choose a post-castling plan; meet c3/d4; respond to the Evans Gambit | [Black Italian sources](ITALIAN_BLACK_COURSE_SOURCES.md) |
| King's Gambit · Active play with White | White | Modern Defense; the ...g5 pawn chain; bishop-first refusal; the Falkbeer countergambit | [King’s Gambit sources](KINGS_GAMBIT_COURSE_SOURCES.md) |
| Tactics · Six basic patterns | White | Forks; pins; skewers; discovered attacks and double check; removing a defender; back-rank checkmate | [Tactics sources](TACTICS_COURSE_SOURCES.md) |

`tactics-foundations` (revision `2026-10-v1`) teaches patterns rather than an
opening. Its examples start from separate positions, and it has no recall lines,
so it never adds anything to Due.

The current revisions are `2026-10-v3` for `italian-foundations`, and
`2026-10-v4` for `italian-black-foundations` and `kings-gambit-foundations`.
Black decisions and rehearsal use Black orientation
and automatically play White’s intervening replies. All four course definitions
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
The October 2026 chess check of all three courses rechecked every taught move
with Stockfish and the historical scores against published sources. It changed
no moves and corrected ten explanations; each source record lists its corrections.

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
`test_puzzle_packs.py` covers Lichess-layout conversion, refused packs, the
bundled starter pack, installed-pack startup verification and selection modes.
`test_puzzle_generation.py` covers the own-game generator: line building and
every abstention with scripted searches, candidate selection from saved scores,
once-per-game persistence, the account-bound provider, both job paths through a
fake engine, two-account privacy and one native Stockfish line.
`frontend/tests/study-puzzles.spec.ts` exercises the production player through the
test-only fixture providers on desktop and mobile. It covers retries, playback,
reload, Still/device motion, promotion, coach changes, late-response cleanup, and
the own-game source tab, cold heading and solved provenance link.

`test_study_lessons.py` validates content graphs, player transitions, ownership,
idempotency and persistence. `test_lesson_journey.py` and `study-lessons.spec.ts`
exercise one connected chapter across all six step types, including Back, branch
reload/return, full-game context, hints/reveal and independent rehearsal.

The production registry must never import test fixture providers or enable
development content through an environment switch.

## Deferred content requirements

The lesson/opening/puzzle framework sprint is complete and the generic pack
requirements below are implemented as described under [Puzzle packs](#puzzle-packs)
and [Selection](#selection). Game-derived generation of missed mates and wins is
implemented as described under [Puzzles from your games](#puzzles-from-your-games);
its remaining pieces and additional courses are separate future work. The
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

Selection prefers unseen puzzles within a requested difficulty band, avoids
recent repeats and offers theme filters and a separate Retry failed mode. This
is deliberate practice, without FSRS due dates or an implied mastery score. An
in-app install action for a larger pack is not implemented; installation is the
documented `PUZZLE_PACK_PATH` setting.

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

Generation is explicit, bounded, persisted, cancellable, resumable and cacheable,
never rerun when the player opens a page. Updated engine or generator evidence
creates or supersedes a definition version; it never rewrites completed puzzle
history or active snapshots. Source matchup/date, original move, exact game/ply
link, themes, payoff and full solution unlock only after completion or reveal.
Cold play must not expose future solution length or other tactical hints. Puzzle
practice never updates FSRS, ordinary recall history or weakness evidence, and
does not prove that training transferred into later games.

Still future work, in the order the prototype measurements suggest: defensive
puzzles with their own payoff rule (hold at -100 cp or better while rivals lose
at least 300 cp), accepted alternatives through a solution-graph format so an
ambiguous first move need not abstain, Maia's difficulty band where human
evidence exists, selection that avoids consecutive puzzles from one game, and a
regeneration command for engine upgrades.

### Other deferred study work

Additional opening courses, arbitrary opening PGN/Lichess Study imports, repertoire
tree editing, favorite-position lines, external source synchronization, graphical
course authoring and broader practice modes require separate product work. Existing
catalogue browsing and the Italian pilot are not authorization to generate a large
course collection. Preserve the shared board/coach and the distinct source,
scheduling and historical-snapshot authorities when extending these features.
