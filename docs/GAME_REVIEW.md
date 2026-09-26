# Full-game review

Game review complements cold practice. It reviews both colors and arbitrary legal
variations without creating Decisions, exercises, weakness evidence or FSRS recalls.
The existing training policy is unchanged.

## Using the workspace

Each game opens at `/games/<id>`. Browser Back returns to the previous page and
Forward reopens the review. You can bookmark a game or open its library link in
another tab. Selecting a move records `?ply=<half-move>` in the same history entry,
so refreshing or returning from another screen restores that position. **All games**
opens the library, retaining its page when the game was opened from a later page.
Normal arrow keys move through the game; Alt+Left/Right remain browser shortcuts.

Open **Games** and choose an imported game. Its review starts automatically; an
unfinished review resumes when reopened, and a completed review reuses saved
results. Merely browsing the library or syncing games does not start analysis.
**Pause review** stays paused while the game remains open. If starting or analysis
fails, **Retry review** lets you retry explicitly without an automatic retry loop.
The coach and timeline fill as analysis finishes. Select a move, use the arrow keys/buttons,
or select **Next mistake**. **Show why** overlays arrows and tactical square
highlights on the current board without moving pieces, changing the selected
move, requesting more analysis, or creating a variation. **Hide why** or Escape
clears those cues. The best alternative remains visible in the coach footer.
Only the played position and immediate reply supply visual cues; later engine
continuations are not projected onto the current board.

Move any legal piece to start a variation. Undo and choose a different move to fork
it; the variations list keeps both lines while this game remains open. **Game**
in the board navigation restores the original branch point. Escape does the same
when explanation cues are already hidden. Variations are not saved across leaving
the game or reloading. Engine failures leave legal board exploration available.
Late engine responses cannot replace coaching for a different selected position.
The sidebar orders coaching, compact notation and variations, evaluation, then
review tools. The evaluation graph spans the available panel width, with 12px
move dots and a 24px selected dot. Its padding keeps edge dots visible. The coach
keeps its label, message area, and action row in stable slots; longer explanations
scroll inside the bubble. Analysis details and training controls are grouped
under **Review tools & details**. On phones the coach appears directly below the
board controls, with full-size touch targets and normal page scrolling.

## Analysis and persistence

The Games API lists imported PGNs and replays their actual starting position.
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

Only Blunder severity depends on the selected rating. The same rating setting is
used for both players. It changes presentation, never evaluations or tactical facts.
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

Priority: Blunder, Miss, Mistake, Inaccuracy, Brilliant, Great, Best, Good. The
coach can explain a missed opportunity even when the primary label is Blunder.
Thresholds are explicit initial policy, not calibrated human performance estimates.

## Coach evidence

The coach uses shared pinned Lichess predicates and Fieldwork causal witnesses.
Positive moves inspect the mover's line; concessions inspect the opponent's reply.
Before/after witnesses can identify an unanswered attack, abandoned defender or
unfavorable exchange. Motif buttons carry exact frame indices and square roles.
Best-move playback has its own evidence, never borrowed from the played move.

An observed motif is not automatically proof of inevitable material loss. Existing
line-qualified language is retained. Unknown positional reasons get neutral feedback
and an engine continuation rather than an invented pin, fork or strategic claim.
There is no LLM, voice service, rating-sensitive engine evaluation, or accuracy score.

Public definitions consulted during planning:
[Chess.com Great/Brilliant](https://www.chess.com/article/view/how-to-play-a-brilliant-move),
[classification](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc).
