# Full-game review

Full-game and variation reports can carry [human move evidence](REVIEW_INTELLIGENCE.md#human-move-evidence)
independently of their Stockfish findings. Opening an already reviewed game checks
for missing/outdated human evidence when the model is ready; compatible baseline
reports are reused. Progress polling publishes refreshed rows in game order and
keeps the board usable throughout. Maia availability never changes move grades.

Game review complements cold practice. It reviews both colors and arbitrary legal
variations without creating Decisions, exercises, weakness evidence or FSRS recalls.

Completed reviews also derive supported [game relationships](REVIEW_INTELLIGENCE.md#game-context-and-supported-relationships),
[owned history](REVIEW_INTELLIGENCE.md#cross-game-context) for individual move explanations.
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
The desktop sidebar ends at the board controls' bottom edge, using the rendered
board column height even when available width limits the board's size.

**Settings → Animations → Piece & interface motion** controls piece movement,
board feedback and interface transitions across all review screens. It follows
the browser by default; saved Animated/Still choices override the browser and
remain independent of coach motion.

Each game opens at `/games/<id>`. Browser Back returns to the previous page and
Forward reopens the review. You can bookmark a game or open its library link in
another tab. Selecting a move records `?ply=<half-move>` in the same history entry,
so refreshing or returning from another screen restores that position. The header's
**Games** tab opens the library, retaining its page when the game was opened from
a later page; the board controls carry no separate library link. The sidebar starts directly with the coach;
player names remain beside the board without a repeated matchup/date heading.
When the PGN records `[%clk]` annotations, each player bar shows that side's
remaining time at the selected move, starting from the TimeControl header's
initial time; the side to move has the highlighted (running) clock. A variation
keeps the clocks from where it left the game. Games without clock annotations
show no clocks.
Normal arrow keys move through the game, as do A/D; Up/Down and Home/End jump to
its start and last move (a variation's start inside one), like the playback
buttons, and X flips the board, as on Chess.com. Alt+Left/Right remain browser
shortcuts. Right-click marks a square (Shift green, Ctrl yellow, Alt blue) and
right-drag draws an arrow; a left click on the board clears them.

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
clears those cues. Outside Show why, the opponent's strongest reply to the
selected move is drawn as one faded blue arrow, and the same reply appears as
**Reply** under **Best** beside the coach portrait. A pin the selected move
makes (a piece, never a pawn, pinned to its king or to something worth more
than the pinning piece; either side's pieces) is drawn as a faded red arrow from the pinning piece (the nearest piece beyond the pinned one, never another slider further along the line) through the
pinned piece to the piece behind it, with or without Show why. A pin kept from
an earlier move is not drawn again. The board cues' `pins` list carries these
from `review_cues.py`. The action row sits below the speech bubble.
The export icon beside **Next mistake** opens one dialog: the saved PGN to copy
or download, the FEN of the position on the board, and a GIF of
the whole game from the board's side, one move a second, made in the browser.
`GET /api/games/{id}/export` supplies the PGN and every mainline position.
The compact coach shows the move and rating together, with a prominent signed
evaluation in the opposite corner. Scores always use White's perspective, even
in a variation or after flipping the board: positive favors White, negative favors
Black, and signed `M` values denote forced mate. Pending evaluations show a dash.
The board's narrow evaluation bar shows a horizontal score rounded to one decimal;
the coach and game graph retain two decimals. Mate distances keep their `M` notation.
Only the played position and immediate reply supply visual cues; later engine
continuations are not projected onto the current board.

Move any legal piece to start a variation. Undo and choose a different move to fork
it; the variations list keeps both lines while this game remains open. A prominent
purple **Return to game** button beside **Show why** in the coach's action row
restores the original branch point without adding another row above the controls.
Game review and SRS share the same action sizing: buttons grow with the row up to
half its width, allowing for the gap, with a 40px height at every width. A single action
keeps that half-width when Return to game appears beside it. The best move sits
directly beneath the coach portrait, with its notation kept on one line even in
compact panels. The human insight sits inside the coach bubble, so neither
readout can squeeze the buttons.
Stepping backward to that point also exits the variation. In a variation the `<<`
control is **Start of variation**: it exits to the original-game position where the
variation began. On the original game it is **Start of game**, selecting the initial
position (ply 0), and it is disabled when already there. Escape returns to the
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
120px tall. Move quality compares the players on opposite sides, with their names,
piece colors and prominent accuracy scores above each count column. Colored move
quality labels sit between the counts, with zero counts subdued. Rows fill the
available panel height, and text/icons scale with its width and height. Short panels
retain readable minimum sizes and scroll when necessary. Player headings stay
visible while scrolling; truncated names retain the full username and color in a tooltip.
The review's completion status sits below the comparison.
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
original game. Drag across the graph with a mouse, touch or pen to scrub through
positions: the cursor, board and coaching follow each new ply while held. Dragging
past either end stops at the first/last position; release or cancellation ends the
gesture. Vertical swipes still scroll the page on phones.
Arrow keys navigate reviewed dots when a dot is focused; Home/End
select the first/last reviewed move. The graph has no separate move/navigation
footer; use scrubbing or the main game controls to reach any ply, including positions
still being reviewed. The coach keeps its label, message area, and action
row in stable slots; longer explanations scroll inside the bubble. The desktop
bubble and illustrated coach share a 136px height; narrow layouts use a 156px
bubble with a smaller portrait. Actions stay outside the bubble in both review modes.
On learner moves, a compact **Maia** insight sits at the bottom-right inside the
existing fixed-height coach bubble when saved human evidence supports one. Best
remains beneath the portrait; neither insight adds a row below the action buttons.
The link sits in a short row tucked into the bubble's bottom padding. Every review
bubble keeps the same compact 28px title row, so that space is reserved whether or
not Maia appears; longer coaching text scrolls above the link.
Natural mistakes, hard finds, unusual strong moves, natural
best choices and difficult defenses get plain-language labels. Tap the insight for
the selected coach's reaction to the highest-priority insight, a short explanation
of what that label means for the played/best move and how human predictions differ
from engine strength, one short uncertainty note, and an About Maia link. The popover
has no voice control; the move's one coach playback already covers Maia. It uses existing
evidence, stays visible even when the bubble prioritizes tactics or opening text,
and closes when changing positions. It adds no dashboard or analysis request.
Objective labels and evaluations remain independent of this estimate.
Best-move markers use a centered SVG star
on the board, in coaching, and in notation.
On phones the coach appears directly below the
board controls, with normal page scrolling. The board controls put **Flip board**
first and the mute button last, either side of the move buttons; on phones all six
share the available row width. The move list and evaluation graph lose their card
border on phones, with a divider above the graph. The move counter reserves space
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
Parallelism does not change search depth, time, node limits or classification rules. With the
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

- Best: engine top choice, an equally immediate checkmate, or a different move
  exactly as strong: the same mate distance, or the same centipawn score. A merely
  nearly equal score is not Best. When a played move's
  restricted-root search scores it above the reported best, presentation treats it
  as the best move found (best move, best line and grade), without rewriting the
  saved report.
- Good: less than 50 cp loss without qualifying for a higher label. Keeping a
  forced win but taking longer to mate is Good, never Best, Great, or Brilliant.
- Inaccuracy: 50–99 cp loss, or, in a position lost to mate either way, a move that
  is mated sooner than the best defence.
- A mate on one side of a comparison only is a mate transition (a Miss or an allowed
  mate) unless it is a long mate (four moves or more) and the other side is just as
  decisive in centipawns (+3.00 or better for a kept win, -3.00 or worse for an
  already lost position): at the same search depth one search can see such a mate
  and the other not. The move then counts as no loss. Insights, events and
  difficulty read the same comparison.
- Mistake: at least 100 cp loss below the Blunder threshold, absent a verified Miss.
- Blunder: newly allowed forced mate, a transition from at least -50 cp (or a
  forced win) to -200 cp or worse (or mated), or at least 300 cp loss below rating
  1200 / 200 cp otherwise. The review's events call the same transition decisive. Decisive
  pawn losses therefore remain Blunders at low ratings. Already-lost mate positions
  are not treated as newly allowed mate.
- Miss: lost forced mate, or a concrete missed gain supported by a settled
  comparison and a tactical witness that costs at least 100 cp; a smaller gap keeps
  its ordinary label. Retaining mate in two instead of mate in one is not a
  Miss. Severe losses still take precedence as Blunder.
- Great: at most 20 cp loss and more than one legal move, plus either the only
  good move (the strongest alternative actually loses: -1.50 or worse or mated, at
  least 150 cp / a mate outcome below the best move, while the played move retains
  at least -50 cp; the same rule the coach's only-move evidence uses); or
  successful exploitation of a preceding opponent error (the opponent's move was
  itself a Mistake or worse, and the previous position between -150 and +150 becomes
  at least +200, or previous position at most -200 becomes at least -50). Previous scores use the position
  before the opponent's move, normalized to the current mover. The same rules
  apply in variations. A sole legal move is not Great.
- Brilliant: a sound move below 50 cp loss with a current-mover tactical witness
  involving the played move, or a winning mate; a non-pawn sacrifice at an
  immediate net material cost; and an explicit native
  acceptance test leaving at least -50 cp. The unrestricted played line must also
  retain at least -50 cp, and the strongest alternative must be below +300 cp,
  unless the sacrifice forces mate and no searched alternative does (forcing
  mate is its own achievement, even from a winning position). At most
  two eligible legal non-pawn capture candidates are probed. Promoting and losing
  that pawn's new piece is not a non-pawn sacrifice. Ordinary equal trades do not
  qualify: if a legal immediate recapture restores the pre-move material balance,
  the detector abstains, even when the searched line delays that recapture. This
  material filter does not assert the recapture is tactically sound; recognition
  is deliberately conservative and can miss sacrifices. Later unrelated tactics
  cannot justify a Brilliant label for the current move.
  A forced move with only one legal option can never be Brilliant, including a
  forced king move; it does not trigger sacrifice-acceptance searches.

Saved sacrifice offers are revalidated before grading, practical assessment and
semantic events. Unsupported legacy offers are omitted from the display report
without modifying saved engine evidence or rerunning Stockfish. Labels are also
computed on read, so saved reviews pick up grading-rule changes on reload.

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
and actual move, so saved reviews gain Book labels without rewriting their
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
`Board`, `reviewMotion.ts`, `review-presentation.css` and `coach-presentation.css` own the feedback icons,
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
reviews expose [Lichess accuracy scores](#game-accuracy) through the game APIs,
calculated from saved evaluations without further engine searches.
Each player's accuracy appears beside their name when the full review finishes.
The same scores lead the White/Black move-quality table, above the nine rating
counts including Book. Both locations use one accuracy readout with matching
rounding, pending/unavailable states and explanations.
The readouts reserve space while reviewing and remain unchanged during variations.
Board readouts follow their players when flipped; the table keeps its White/Black
columns. Accuracy has no Elo adjustment.

Public reference definitions:
[Chess.com Great/Brilliant](https://www.chess.com/article/view/how-to-play-a-brilliant-move),
[classification](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc).

## Additional investigation

After every baseline move is saved, a bounded optional investigation phase uses
the same grading/evidence rules with deeper and selectively wider Stockfish
searches. Baseline facts remain immutable; effective reports, accuracy and
incremental revisions use compatible adopted evidence. See
[targeted review investigation](REVIEW_INTELLIGENCE.md#targeted-review-investigation) for selection, budgets and provenance.

Review/variation responses include versioned semantic `intelligence`: objective
transitions, critical resources, sacrifice/tactic witnesses, honest human-policy
contrasts and valid mainline clock/opening observations. These facts feed the
[shared dialogue layer](COACH_DIALOGUE.md) without changing badges based on human or clock data;
the dialogue layer does not turn clock observations into coach lines.
See [review events and clocks](REVIEW_INTELLIGENCE.md#semantic-review-events-and-clock-context). A good restricted-root alternative
also disproves an only-good-move Great claim; all comparisons remain Stockfish facts.
## Structured game context

Reviewed games expose versioned relationships between supported moments,
including missed punishment, recovery, repeated motifs, sustained advantages and
gradual erosion. They use the same effective evidence generation as move reports
and accuracy. See [game context](REVIEW_INTELLIGENCE.md#game-context-and-supported-relationships) for gates and caveats.

Review stays move-by-move. There is no game story, critical-moment summary or
ranked takeaway surface. Completion leaves the selected position and coach alone;
move quality, accuracy and normal move navigation remain available.

## Game accuracy

The game detail and review progress APIs expose a versioned accuracy score for each
player after a complete review. Fieldwork uses the published Lichess calculation;
there is no Elo input and move-label thresholds do not affect the score. Scores are
derived from saved reports, requiring no new Stockfish searches or database schema.

### Calculation and provenance

The Python port follows Lichess lila revision
`2e653ad1e2b9fad31b4a092394019ef8fafdedb8`, with its pinned scalachess 17.8.2 and
scalalib 11.8.8 helpers. Sources, local modifications and full AGPL/MIT licenses are
in [the port directory](../backend/trainer/_vendor/lichess_accuracy/README.md).

It converts White-perspective evaluations after successive plies into a winning-chance
proxy and scores each change from the moving player's perspective. The aggregation
combines a volatility-weighted mean with a harmonic mean. It preserves the upstream
uncertainty allowance, population deviation, window alignment and bounds, centipawn
saturation, and harmonic denominator floor. See
[Lichess's explanation](https://lichess.org/page/accuracy) and the pinned source.

Fieldwork uses Lichess's adjacent-position calculation directly. Standard games
use the reference initial value of +15 centipawns. For a custom starting FEN, use
the first saved report's best evaluation, normalized to White, instead of assuming
an ordinary starting position. Move ownership follows the actual starting color.
Typed mate outcomes saturate at the appropriate endpoint; delivered mate at zero
is distinct from being mated at zero.

The method is Lichess's, but Fieldwork supplies its own engine evaluations. Different
search settings or engine versions can therefore produce different numbers from a
separate review on lichess.org. These scores are not Chess.com's CAPS2 or an Elo
estimate.

### API and completeness

Both `GET /api/games/{id}` and `GET /api/games/{id}/review?after={ply}` return:

```json
{"accuracy": {"version": "lichess-2e653ad1-1", "white": 84.7, "black": 91.2}}
```

The numbers above illustrate the response shape. Full precision is returned.
`accuracy` is `null` until the job is completed and every original-game ply has a
valid evaluation. Missing, extra, or invalid reports do not produce partial scores.
Like the upstream game calculation, games where both sides have not moved receive
no score. The final incremental response includes accuracy even when its move list
is empty. Only completion requires loading all saved evaluations during polling.
The game's presentation (every rendered report and the game context) is built once
per review revision and reused by later polls and the game page until a report is
saved, adopted or refreshed (`presentation.presented_review`).

Already-completed reviews get scores when reopened, including when Stockfish is
unavailable. Ratings, branch exploration and board orientation cannot modify the
original-game scores. No aggregate is stored in a second table or database.

`GET /api/games` also supplies this summary for completed games on the requested
history page. It projects only the score fields for those games in one batched
query and uses the same calculation as the review endpoints. It never starts
analysis merely to fill the accuracy column.

### Display

Each player's name has an accuracy readout showing one decimal place, using stable
space that does not change board size when analysis finishes. An em dash has an
accessible explanation for incomplete or unavailable results. Accuracy belongs to
the original game even while the player explores a variation. Flipping the board
moves each score with its player.
The move-quality breakdown repeats these scores at the top of its White/Black
columns, using the same readout component and pending/unavailable explanations.
Book labels do not exempt moves from accuracy or substitute a perfect score;
recognized opening moves contribute their actual saved engine evaluations.
History rows show White and Black accuracy aligned with their player names.
Pending reviews show their review action or progress state in that column.

### Verification

Regression cases use the pinned upstream numerical examples and tolerances,
including decisive mistakes, repeated small losses and Black moving first. Further
tests cover saturation, uncertainty, the harmonic floor, both zero-mate outcomes,
color symmetry at window-size boundaries, custom FENs and incomplete evidence.
Native review tests verify equality between detail and incremental responses,
rating independence, paused reviews, and reopening saved results without an engine.
Browser checks cover completion through incremental polling, placeholders, rounding,
stable board/readout geometry, flipping, branching and reopening on desktop/mobile.
