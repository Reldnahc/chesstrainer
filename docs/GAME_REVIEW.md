# Full-game review

Full-game and variation reports can carry [human move evidence](HUMAN_MODELS.md)
independently of their Stockfish findings. Opening an already reviewed game checks
for missing/outdated human evidence when the model is ready; compatible baseline
reports are reused. Progress polling publishes refreshed rows in game order and
keeps the board usable throughout. Maia availability never changes move grades.

Game review complements cold practice. It reviews both colors and arbitrary legal
variations without creating Decisions, exercises, weakness evidence or FSRS recalls.
The existing training policy is unchanged.

Completed reviews also derive supported [game relationships](GAME_CONTEXT.md),
[owned history](CROSS_GAME_CONTEXT.md) for individual move explanations.
The coach can connect a recovery to an
earlier error or identify a repeated supported motif; incomplete or inconsistent
evidence causes abstention. Human difficulty is a model-informed description,
never a calibrated percentage of players or a replacement for move quality.
Changing the selected coach rephrases the same facts without rerunning analysis.

## Using the workspace

Pages and the site header use the full available width through 1440 CSS pixels,
covering laptops, tablets and phones. Larger desktops share a centered 80% width.
The review sidebar absorbs the narrower layout; the chessboard retains the same
size it had at full page width. Where necessary, the container expands beyond 80%
to fit the board and usable controls, never beyond the viewport. SRS and game
review use this same sizing policy through `ReviewWorkspace`.

Each game opens at `/games/<id>`. Browser Back returns to the previous page and
Forward reopens the review. You can bookmark a game or open its library link in
another tab. Selecting a move records `?ply=<half-move>` in the same history entry,
so refreshing or returning from another screen restores that position. **All games**
opens the library, retaining its page when the game was opened from a later page.
Normal arrow keys move through the game; Alt+Left/Right remain browser shortcuts.

Open **Games** and choose an imported game. Its review starts automatically; an
unfinished review resumes when reopened, and a completed review reuses saved
results. Merely browsing the library or syncing games does not start analysis.
The history uses compact rows with White and Black on separate lines, piece-color
markers and their recorded ratings. Results and completed accuracy line up with
those players. Won/Lost/Draw reflects the learner side selected on import. Each
row also shows time control, move count and date; the whole row is a normal game
link supporting keyboard activation, browser Back and opening another tab.
Unreviewed, active, paused and failed reviews show Review, Queued/Reviewing, Resume
or Retry in the accuracy column. Mobile keeps the player/result/accuracy columns
and moves the remaining metadata underneath. Missing ratings are omitted; unknown
metrics use dashes. Dates use the recorded date, falling back to
the saved UTC timestamp when the PGN date is unknown.

**Pause review** stays paused while the game remains open. If starting or analysis
fails, **Retry review** lets you retry explicitly without an automatic retry loop.
The coach and timeline fill as analysis finishes. Select a move, use the arrow keys/buttons,
or select **Next mistake**. **Show why** overlays arrows and tactical square
highlights on the current board without moving pieces, changing the selected
move, requesting more analysis, or creating a variation. **Hide why** or Escape
clears those cues. The action row and best alternative sit below the speech bubble.
The compact coach shows the move and rating together, with a prominent signed
evaluation in the opposite corner. Scores always use White's perspective, even
in a variation or after flipping the board: positive favors White, negative favors
Black, and signed `M` values denote forced mate. Pending evaluations show a dash.
Only the played position and immediate reply supply visual cues; later engine
continuations are not projected onto the current board.

Move any legal piece to start a variation. Undo and choose a different move to fork
it; the variations list keeps both lines while this game remains open. A prominent
purple **Return to game** button beside **Show why** in the coach's action row
restores the original branch point without adding another row above the controls.
Stepping backward to that point also exits the variation. The **First move** (`<<`)
control always selects ply 1 of the original game, even from a variation; the
previous-move control can still reach the initial position. Escape returns to the
game when explanation cues are already hidden. Variations are not saved across leaving
the game or reloading. Engine failures leave legal board exploration available.
Late engine responses cannot replace coaching for a different selected position.
The sidebar orders coaching, a tabbed review panel, then evaluation. **Moves** is
the default tab, with notation and variations; **Move quality** swaps in the
accuracy and rating counts within the same panel. Switching tabs preserves the
selected position and panel height. Arrow keys/Home/End navigate the focused tabs
without stepping the board. Review progress and pause/resume controls remain
available in either tab. The panel has a 240px minimum height on desktop and a
344px fixed height on phones; long content scrolls inside the active tab. The
desktop page and board stay in place, with sidebar scrolling available on short
viewports. Phones retain normal page scrolling. The compact evaluation plot is
120px tall. The inset quality table uses sticky player usernames as column headings
and centers their counts; truncated names retain the full username and color in a tooltip.
The evaluation graph uses a white
area below the score and a dark area above it, with a clear zero line and signed
pawn labels. It starts at ±4 and expands symmetrically to the next whole pawn
whenever a finite score exceeds the range (for example, +7.30 gives ±8, and −9.80
gives ±10). The range uses all analyzed game positions and the starting evaluation,
so navigating or flipping the board cannot change it. New analysis can expand it.
Forced mates sit at the appropriate edge without inflating the numeric axis;
the selected position's exact signed score, including `M`, appears above the graph.
Unanalyzed gaps remain unfilled. The graph always describes the original game,
while the coach follows the current position, including an explored variation.

Brilliant, Great, Best, Inaccuracy, Mistake, Miss and Blunder have colored markers;
Good and Book stay quiet unless selected or focused. Markers scale with graph
width and ply count up to 12px; the selected marker stays 24px across. Padding keeps
edge markers visible. There is no legend or separate range slider. Previous/next
buttons occupy fixed left and right slots around a centered move label, so changes
in move number or notation cannot shift them.
Click or tap a dot, or anywhere along the graph, to return to that ply in the
original game. Arrow keys navigate reviewed dots when a dot is focused; Home/End
select the first/last reviewed move. The graph's buttons also navigate every ply,
including positions still being reviewed. The coach keeps its label, message area, and action
row in stable slots; longer explanations scroll inside the bubble. The desktop
bubble and illustrated coach share a 116px height; narrow layouts use a 136px
bubble with a smaller portrait. Actions stay outside the bubble in both review modes.
On learner moves, a compact **Maia** insight sits beside Show why when saved human
evidence supports one. Natural mistakes, hard finds, unusual strong moves, natural
best choices and difficult defenses get plain-language labels. Tap the insight for
the selected coach's explanation and source/domain uncertainty. It uses existing
evidence, stays visible even when the bubble prioritizes tactics or opening text,
and closes when changing positions. It adds no dashboard or analysis request.
Objective labels and evaluations remain independent of this estimate.
Best-move markers use a centered SVG star
on the board, in coaching, and in notation.
On phones the coach appears directly below the
board controls, with full-size touch targets and normal page scrolling. Mobile
navigation buttons share the available row width. The move counter reserves space
for three-digit steps and totals, keeping the controls still as those numbers grow.

## Analysis and persistence

The Games API lists imported PGNs and replays their actual starting position.
Library items include player ratings/colors, result, readable PGN time control,
move count (played plies divided by two, rounded up), date/UTC timestamp, review
status and completed Lichess accuracy. Missing metadata stays unknown. The page
loads game/job metadata together and projects only saved score fields in one batch
for completed reviews, rather than loading tactical reports per game. Browsing the
library does not start Stockfish or fetch remote profiles.
Starting a review queues a `game_review` job. Each completed ply is saved separately;
cancel/retry and startup recovery reuse completed reports. The engine cache retains
full game history, binary identity and search configuration. Saved reports remain
readable without Stockfish. Interactive variations use a separate, serialized native
engine request so they do not occupy the recall engine. Variations are legal-replayed
from the selected game ply, preserving history, castling, promotion and en passant.

Reviews analyze independent moves concurrently using `STOCKFISH_WORKERS`, capped
by `ENGINE_SLOTS`. Account mode also shares its host-wide engine pool with all other
requests. At most one move per review worker is in flight or queued. Results commit
in game order, attaching the preceding position's score before labels are exposed;
this preserves Great-move comparisons. Pause stops adding work and saves the active
batch before settling. Resume reuses committed moves, and failures close workers.
Search depth, time, node limits and classification rules are unchanged. With the
default of one worker, analysis stays serial; increasing workers permits parallel
positions, while increasing threads assigns more CPU threads to each position.

The browser polls `/api/games/<id>/review?after=<last-received-ply>` every 750 ms
while running, with at most one progress request in flight. Responses contain only
new display reports and job status, leaving the board and exploration state intact.
Full witness lines remain available from the game detail endpoint. Original-game
positions already covered by the running review do not start duplicate interactive
searches. The initial board reuses the first report's pre-move evaluation; manually
played variations still receive their own analysis immediately.

Both players use the configured deep search limits with two principal variations.
Moves outside those candidates receive a restricted-root search. Reports retain
engine/version/depth, typed mate/centipawn scores, evidence IDs, candidate lines,
motif witnesses and sacrifice-acceptance tests. A report is a finite engine analysis,
not mathematical proof. These labels are Fieldwork rules, not Chess.com's algorithm.

## Labels, version game-review-1

Only Blunder severity depends on rating. Each move uses its moving player's PGN
rating; the review rating is a fallback when that player's rating is missing.
It changes presentation, never evaluations or tactical facts.
It defaults to 1000 and is stored with the review; changing it reuses engine evidence.

- Best: engine top choice or at most 10 cp loss.
- Good: less than 50 cp loss.
- Inaccuracy: 50–99 cp loss.
- Mistake: at least 100 cp loss below the Blunder threshold, absent a verified Miss.
- Blunder: newly allowed forced mate, a transition from at least -50 cp to -200 cp
  or worse, or at least 300 cp loss below rating 1200 / 200 cp otherwise. Decisive
  pawn losses therefore remain Blunders at low ratings. Already-lost mate positions
  are not treated as newly allowed mate.
- Miss: lost forced mate or a concrete missed gain supported by a settled comparison
  and a tactical witness. Severe losses still take precedence as Blunder.
- Great: at most 20 cp loss and more than one legal move, plus either the strongest
  alternative loses at least 150 cp / drops a mate outcome while the played move
  retains at least -50 cp; or successful exploitation of the preceding opponent
  error (previous position between -150 and +150 becomes at least +200, or previous
  position at most -200 becomes at least -50). Previous scores use the position
  before the opponent's move, normalized to the current mover. The same rules
  apply in variations. A sole legal move is not Great.
- Brilliant: a sound move below 50 cp loss with a tactical witness or winning mate,
  a non-pawn sacrifice at an immediate net material cost, and an explicit native
  acceptance test leaving at least -50 cp. The unrestricted played line must also
  retain at least -50 cp, and the strongest alternative must be below +300 cp. At most
  two legal non-pawn capture candidates are probed. Ordinary equal trades do not
  qualify. Recognition is deliberately conservative and can miss sacrifices.

Book takes precedence when the actual position and move appear in the bundled
[Lichess opening catalogue](../backend/trainer/_vendor/lichess_openings/README.md).
This is recognition, independent of engine quality or Elo: named unsound lines,
including the Bongcloud and Fool's Mate, also qualify. All moves along a
catalogue line are eligible, not just its final named position. Matching includes
side to move, castling rights and legal en-passant rights while ignoring move
counters, so transpositions work. A move outside the indexed continuations keeps
its normal rating; a PGN opening name never makes later moves Book automatically.

One lazy, thread-safe, process-local index serves saved reviews, incremental
updates and interactive variations. Recognition uses the recorded pre-move FEN
and actual move, so older saved reviews gain Book labels without rewriting their
reports, running Stockfish again or migrating the database. Reports expose
`opening` (catalogue version, optional name and ECO code) and `engine_label`;
the primary `label` and coach text use Book. Tactical arrows retain the engine's
perspective, and every underlying evaluation still contributes to accuracy.
The catalogue and license ship with Python packages, Docker and source downloads;
there is no runtime network lookup.

Otherwise priority is Blunder, Miss, Mistake, Inaccuracy, Brilliant, Great, Best, Good. The
coach can explain a missed opportunity even when the primary label is Blunder.
Thresholds are explicit initial policy, not calibrated human performance estimates.

## Coach evidence

`ReviewWorkspace` renders both game review and SRS, including their board slots,
viewport sizing, responsive columns, header and sidebar. One sizing calculation
and stylesheet control both screens; a browser regression checks matching board,
heading and coach geometry across desktop and phone widths.

The coach illustration and stable speech-bubble slots are shared with SRS and its
explanation playback through `ReviewCoach`. `MoveBadge`/`MoveSymbol`, the common
`Board`, `reviewMotion.ts` and `review-presentation.css` own the feedback icons,
colors, piece transitions and reduced-motion behavior for both review modes.
SRS keeps its own acceptance semantics and only shows chess feedback after an
attempt or reveal; sharing presentation does not run full-game grading in SRS.

The coach uses shared pinned Lichess predicates and Fieldwork causal witnesses.
Positive moves inspect the mover's line; concessions inspect the opponent's reply.
Before/after witnesses can identify an unanswered attack, abandoned defender or
unfavorable exchange. Motif buttons carry exact frame indices and square roles.
Best-move playback has its own evidence, never borrowed from the played move.

An observed motif is not automatically proof of inevitable material loss. Existing
line-qualified language is retained. Unknown positional reasons get neutral feedback
and an engine continuation rather than an invented pin, fork or strategic claim.
There is no LLM, voice service, or rating-sensitive engine evaluation. Completed
reviews expose [Lichess accuracy scores](GAME_ACCURACY.md) through the game APIs,
calculated from saved evaluations without further engine searches.
Each player's accuracy appears beside their name when the full review finishes.
The same scores lead the White/Black move-quality table, above the nine rating
counts including Book. Both locations use one accuracy readout with matching
rounding, pending/unavailable states and explanations.
The readouts reserve space while reviewing and remain unchanged during variations.
Board readouts follow their players when flipped; the table keeps its White/Black
columns. Accuracy has no Elo adjustment.

Public definitions consulted during planning:
[Chess.com Great/Brilliant](https://www.chess.com/article/view/how-to-play-a-brilliant-move),
[classification](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc).

## Additional investigation

After every baseline move is saved, a bounded optional investigation phase uses
the same grading/evidence rules with deeper and selectively wider Stockfish
searches. Baseline facts remain immutable; effective reports, accuracy and
incremental revisions use compatible adopted evidence. See
[REVIEW_REFINEMENT.md](REVIEW_REFINEMENT.md) for selection, budgets and provenance.

Review/variation responses include versioned semantic `intelligence`: objective
transitions, critical resources, sacrifice/tactic witnesses, honest human-policy
contrasts and valid mainline clock/opening observations. These facts feed the
[shared dialogue layer](COACH_DIALOGUE.md) without changing badges based on human or clock data.
See [REVIEW_EVENTS.md](REVIEW_EVENTS.md). A good restricted-root alternative now
also disproves an only-good-move Great claim; all comparisons remain Stockfish facts.
## Structured game context

Reviewed games now expose versioned relationships between supported moments,
including missed punishment, recovery, repeated motifs, sustained advantages and
gradual erosion. They use the same effective evidence generation as move reports
and accuracy. See [GAME_CONTEXT.md](GAME_CONTEXT.md) for gates and caveats.

Review stays move-by-move. There is no game story, critical-moment summary or
ranked takeaway surface. Completion leaves the selected position and coach alone;
move quality, accuracy and normal move navigation remain available.
