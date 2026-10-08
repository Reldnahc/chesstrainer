# King's Gambit course sources

`kings-gambit-foundations`, revision `2026-10-v5`, is an original Fieldwork
course for White. The chapters teach a bounded selection, not a complete
repertoire or a promise that the gambit gives White an advantage. Explanations,
prompts, feedback and position annotations are original. Sources informed the
choice of lines; their prose has not been copied into the lessons.

## Curriculum and research decisions

| Chapter | Recall line | Teaching purpose |
|---|---|---|
| A pawn for active play | `1.e4 e5 2.f4 exf4 3.Nf3 d5 4.exd5 Nf6 5.Bb5+ c6 6.dxc6 Nxc6 7.d4 Bd6 8.O-O O-O 9.Nbd2 Bg4 10.c3` | Develop with check, answer a counterattack, then carry out the central-support plan while recognizing the relative pin. Material is equal, but Black has active play. |
| Challenge the pawn chain | `1.e4 e5 2.f4 exf4 3.Nf3 g5 4.h4 g4 5.Ne5 Nf6 6.Bc4 d5 7.exd5 Bd6 8.d4 Nh5 9.O-O` | Follow the opponent's threats: defend Ne5 before castling. Explain the defended f4-pawn and the possible knight jump to g3. |
| Meet Black's other replies | `1.e4 e5 2.f4 exf4 3.Nf3 Nc6 4.d4 d6 5.Bxf4 Bg4 6.Be2` | One plan for the common replies the other chapters skip: cover h4, take the center with d4, win back f4 with the c1-bishop. Side trips cover 2...Nc6, 3...d6, 3...Nf6, 3...Be7 and 4...d5. |
| Build a center against Bc5 | `1.e4 e5 2.f4 Bc5 3.Nf3 d6 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb6 7.Nc3` | Cover h4, prepare the central break, and preserve the d4-pawn's role in blocking the bishop's diagonal to g1. |
| Meet the Falkbeer countergambit | From `1.e4 e5 2.f4 d5`: `3.exd5 e4 4.d3 Nf6 5.dxe4 Nxe4 6.Nf3 Bc5 7.Qe2 Bf5 8.Nc3 Qe7 9.Be3` | Remove the e4 wedge before Nf3, use the open e-file, then recognize how intervening pieces change the pin. |


### Chapter-boundary review

The chapter count follows the positions' learning demands, not a quota:

- **Modern Defense — retain, complete its plan.** The bishop check, central
  counterattack and castling sequence form one connected development problem.
  The old ending said to prepare c3 but never asked the learner to do it. The
  continuation `9...Bg4 10.c3` now realizes that plan while showing Black's
  relative pin on Nf3. It does not justify a separate chapter for one pawn move.
- **Pawn chain — retain.** `h4`, the attacked knight, `...d5` and defending Ne5
  before castling are successive consequences of the same position. Splitting
  at `...Bd6` would separate the threat from its answer. The optional premature
  castling example and Rosanes contrast support that objective; they remain
  optional illustrations, not new recall obligations.
- **Bc5 refusal — condense.** The queen-check hazard and the prepared c3/d4
  center belong together. The unrelated Falkbeer excursion has been removed
  from this chapter, and two arrivals have become one. Its five guided
  decisions now follow a single pawn structure.
- **Falkbeer — separate and complete.** `...e4` prevents the normal immediate
  Nf3 development, and clearing it gives Black piece activity on the open
  e-file. The former two-decision optional branch stopped before addressing
  that activity. The new chapter develops through Qe2, Nc3 and Be3, has its
  own rehearsal, and shows why a changing pin requires reassessment. Recall
  starts after `2...d5`, with the full game history preserved, rather than
  adding repeated initial e4/f4 decisions.

Revision v5 adds the chapter for Black's other common replies; see
[Common replies and revision v5](#october-2026-common-replies-and-revision-v5).
It is still a bounded foundation, not a complete repertoire. Rarer second and
third moves, and deeper alternatives inside each chapter, are not covered.

The Modern Defense uses an established bishop-check line instead of the first
draft's `5.d4 Nxd5 6.Bc4 Nb6` script. Ian Simpson's [original Modern Defense
analysis](https://www.ianchessgambits.com/kings-gambit-modern-defence.html)
discusses the stronger `...Be6` resource against that draft and the `Bb5+` setup.
It also identifies the `Nbd2`/`c3` plan. Exeter Chess Club's [annotated game
collection](https://www.exeterchessclub.org.uk/content/variations-kings-gambit)
includes Kinlay–Nunn, London 1977, following the selected line through `9.Nbd2`.
The added `...Bg4` / `c3` position makes the support plan concrete, while the
remaining undeveloped bishop and queen explain why this is not a completed
attack or a promise of equal engine evaluation.

John Shaw's [*The King's Gambit* publisher sample](https://www.newinchess.com/media/wysiwyg/product_pdf/7093.pdf)
and Steve Giddins's [*The Most Exciting Chess Games Ever* publisher sample](https://www.newinchess.com/media/wysiwyg/product_pdf/9024.pdf),
pp. 172–174, motivated a closer review of the pawn-chain chapter. The original
`6.d4 d6 7.Nd3 Nxe4 8.Bxf4 Be7` script avoided Black's more challenging central
play. The reviewed line develops `Bc4` and meets `...d5`/`...Bd6`. The move order makes
the lesson concrete: `8.d4` defends Ne5 before `9.O-O`.

We do not repeat an older claim that `6.d4` is objectively refuted. The deeper
Stockfish audit found it close to `6.Bc4`; the revision improves the teaching
sequence and opponent resistance rather than declaring every alternative wrong.
The selected `9.O-O` is also a study choice; `9.Nc3` appears in the literature.

## Short comparisons

- **Premature castling:** after `7...Bd6`, the demonstration follows
  `8.O-O? Bxe5 9.Re1 Qe7 10.d4 Bxd4+`. White has lost a knight and pawn.
  The particular follow-up is illustrative, not a claim that all White replies
  are forced. Return to the branch and play `8.d4` first. `8.O-O` is the
  [Rice Gambit](https://en.wikipedia.org/wiki/King%27s_Gambit,_Rice_Gambit),
  whose main line continues `10.c3` rather than `10.d4`. Stockfish 17.1 rates
  `10.c3` about −1.9 and `10.d4` about −3.8 for White. The gambit has been
  abandoned in serious play, so the summary names it without teaching it.
- **The tempting e5-pawn:** after `2...Bc5`, the comparison is
  `3.fxe5? Qh4+ 4.Ke2 Qxe4#`. `Ke2` is explicitly only one losing reply.
  `4.g3 Qxe4+` instead illustrates the king/rook fork explained in the text.
  Exeter's [introductory King's Gambit lesson](https://exeterchessclub.org.uk/content/ideas-behind-kings-gambit)
  also teaches the queen-check hazard.
- **Falkbeer move-order recognition:** after `2...d5 3.exd5`, the side trip
  `3...exf4 4.Nf3 Nf6 5.Bb5+` reaches the Modern Defense board and asks for the
  same bishop check. It keeps its actual move history; the position is not
  substituted with another history.
- **Falkbeer exchange sequence:** after `9.Be3`, the side trip
  `9...Nxc3 10.Bxc5 Qxe2+ 11.Bxe2 Nxe2 12.Kxe2` asks the learner for each
  White move. White answers an attack on the queen with a counterattack, then
  meets the checking exchange. `10.bxc3` instead loses the e3-bishop, which the
  c5-bishop and e7-queen both attack. Both queens and two minor pieces per side
  are removed; White has one extra pawn and has lost castling rights.

Ian Simpson's [original Falkbeer analysis](https://www.ianchessgambits.com/kings-gambit-falkbeer-counter-gambit.html)
informs the immediate d3 challenge and the Nf3/Qe2 coordination. Exeter's
[annotated Bronstein–Tal game](https://www.exeterchessclub.org.uk/content/variations-kings-gambit)
follows the selected development through `9.Be3`. Fieldwork's comparison then
uses the independently checked `10...Qxe2+`, rather than importing the game's
`10...Nxe2`. These are original teaching explanations of legal board facts,
not copied source annotations. The historical full-game library is unchanged.
The classical `3...e4` is a named alternative Black may choose, not a claim that
it is stronger than transposing to the Modern Defense with `3...exf4`.

Each chapter ends in independent rehearsal. Historical games and side trips
never automatically schedule their moves for recall. Since v5, each side trip
that shows a common opponent reply has its own optional recall line. The two
mistake demonstrations, premature castling and `3.fxe5?`, have none: their
White moves are what not to play.

## Historical scores

| Game | Score source | Included score | Lesson excerpt |
|---|---|---|---|
| Rosanes–Anderssen, Breslau 1863 | [Giddins publisher sample, pp. 172–174](https://www.newinchess.com/media/wysiwyg/product_pdf/9024.pdf#page=17) | 46 plies, through `23...Re1#`, Black win | After `8...Nh5` through `13...Ng3`, plies 16–26 |
| Morphy–Bornemann, blindfold game | [*The Blue Book of Chess* (1910), p. 183](https://www.gutenberg.org/files/16377/16377-h/16377-h.htm#Pg_183); PGN 67 | 61 plies, through `31.cxd7+`, Black resigns | After `3...d6` through `11.O-O-O`, plies 6–21 |

Rosanes–Anderssen replaces the earlier Anderssen–Kipping illustration. It reaches
the position studied in chapter two and then takes a different ninth move,
showing why taking material does not replace developing and protecting the king.
Only the factual historical score is reused from the modern book. Its copyrighted
annotations are not reproduced, and the book is not labeled public domain.
Fieldwork's notes independently identify the undeveloped pieces, attack on h1,
and the final discovered bishop check with White's queen pinned on f1.

Morphy's game is a contrasting use of `c3`, with `...Bg4` and queenside castling
rather than the chapter's line. The source's move table and PGN appendix were
cross-checked. Neither gives a date or venue; the lesson does not invent one.
The annotation at ply 35 points to the later `18.cxd4`, connecting the preparation
to its eventual use. The source records resignation after check, not checkmate.
The [Gutenberg catalogue](https://www.gutenberg.org/ebooks/16377) identifies this
1910 book as public domain in the United States.

## October 2026 chess check and revision v4

The
[October 2026 chess check](VERIFICATION.md#opening-course-chess-check--october-8-2026)
rechecked every taught move, shown reply, comparison and rehearsal line with
Stockfish 17.1 at depth 22. No taught move is a mistake. `2.f4` itself scores
about −0.7 for White, which is normal for this gambit, and `5.Bb5+`, `6.Bc4` and
`7.d4` trail the engine's first choice by 0.3–0.5. Rosanes–Anderssen matches
[Edward Winter's score](https://chesshistory.com/winter/extra/rosanesanderssen.html).
Revision v4 corrects six explanations without changing any move:

- **Bc5 refusal, `7.Nc3`:** nothing else defends e4 against the f6-knight, so
  Nc3 is its only defender, not “another” one.
- **Modern Defense, `7...Bd6`:** the bishop defends f4 but cannot reach h2;
  Black's own f4-pawn blocks it.
- **Pawn chain, `5.Ne5`:** the rejected alternative is the Allgaier Gambit,
  `5.Ng5 h6 6.Nxf7`, which gives the knight up on f7, not g5.
- **Premature castling:** `9.Re1` pins the bishop to the king, `9...Qe7` defends
  it and shields the king, and `10...Bxd4+` escapes with check. The summary now
  names the Rice Gambit and its usual `10.c3`.
- **After `9.O-O`:** counting attackers suggests `Bxf4` wins a pawn, but after
  `9...O-O 10.Bxf4` Black ignores the bishop and plays `10...Qxh4` with a strong
  attack (about −2.9 for White). `Rxf4` lets the h5-knight take the rook. The
  text now says both.

Morphy–Bornemann was not rechecked, because the cited Blue Book pages could not
be opened during the check. chessgames.com lists the game as 32 moves, so its
score may continue one move beyond `31.cxd7+`.

## October 2026 common replies and revision v5

After the chess check, Maia-3 (the human-move model Fieldwork uses in game
review) estimated how often 1200- and 1600-rated players choose each reply.
These are model estimates, not counted games: the Lichess opening explorer now
requires a login. By Black's third move only about 11% (1200) and 21% (1600) of
games were still in a line v4 taught, and `2...Nc6` alone was about a quarter
of Black's replies to `2.f4`. Revision v5 adds the most common replies.

Every taught White move, in chapters, side trips and recall lines, was checked
with Stockfish 17.1 at depth 20 to 22. Each new one is the engine's first choice
or within 0.2 pawns of it. Scores are pawns from White's side; the accepted
gambit is about half a pawn better for Black, so negative scores are normal.
Black's shown replies are the most common in Maia's estimate unless noted.

| Black's reply (Maia 1200 / 1600) | Taught White moves | Stockfish | Notes in the lesson |
|---|---|---|---|
| `2...Nc6` (25% / 24%) | `3.Nf3 d6 4.Bc4` | +0.3 | `4...Bg4 5.h3`; `4...exf4 5.d4` (+0.1) |
| `3...Nc6` (26% / 20%), chapter main line | `4.d4 d6 5.Bxf4 Bg4 6.Be2` | +0.3, then +1.2 | `4...Nf6 5.e5`, `4...g5 5.d5`, `4...Bb4+ 5.c3`, `5...Nf6 6.Nc3` |
| `3...Nc6 4.d4 d5` (27% / 31%) | `5.exd5 Qxd5 6.Nc3 Qe6+ 7.Be2` | +1.6 | Black's best is `6...Bb4`; `7.Bd3` (+0.7) |
| `3...d6` (11% / 16%) | `4.Bc4 h6 5.d4 g5 6.h4` | −0.5 | `6...g4 7.Ng1` (+0.3; other knight moves about −1); `4...Bg4 5.d4` |
| `3...Nf6` (19% / 9%) | `4.Nc3 Bb4 5.e5 Bxc3 6.dxc3` | +1.4 to +1.7 | `6.bxc3` is +0.8; `6...Qe7` pins e5, then `7.Be2` |
| `3...Be7` (– / 11%) | `4.Bc4 Bh4+ 5.Kf1 d6 6.d4` | about 0.0 | `5.g3` is −0.7; `5...Nf6? 6.Nxh4` (+2.9) |
| `3...Bc5`, `3...Bd6` (3% to 7%) | `4.d4` | +1.1 to +1.3 | feedback note only |
| `3...d5 4.exd5 Qxd5` (88% / 77%) | `5.Nc3 Qe6+ 6.Be2 Nf6 7.O-O` | +0.8 | `5...Qd8` or `5...Qa5 6.d4` |
| `2...d5 3.exd5 Qxd5` (45% / 29%) | `4.Nc3 Qe6 5.fxe5 Qxe5+ 6.Be2 Bg4 7.d4` | +0.9 | `7.Nf3? Bxf3 8.gxf3` is −1.2: the e2-bishop is pinned |
| `3...e4 4.d3 Qxd5` (36% / 27%) | `5.Nc3 Bb4 6.Bd2 Bxc3 7.Bxc3` | +0.5 | |
| `3...e4 4.d3 exd3` (15% / 20%) | `5.Bxd3 Qxd5 6.Nc3` | +0.8 | `5.Qxd3` is as good; `6...Qxg2? 7.Be4` traps the queen (+3.9) |

The Fischer line keeps Stockfish's main line `4...h6` rather than the more common
`4...Bg4`, because it shows the h4 challenge from the pawn-chain chapter; `4...Bg4`
is a note. In the Falkbeer, the existing `3...exf4` and `9...Nxc3` comparisons
became side trips with decisions and their own recall lines. The Modern Defense
and Falkbeer chapters each gained their queen-recapture side trips; the bishop's
check `5.Bb5+` in the transposition trip trails Stockfish's `5.c4` by about 0.2,
as in the Modern Defense chapter itself.

Recall lines for side trips start where their chapter's main line starts. A
test checks that the course's lessons and recall lines give the same answer
wherever they reach the same position, because Recall accepts every enrolled
line's move there.

## Verification

The course validator checks full move histories, connected steps, branch
anchors, source excerpts and rehearsal lines with python-chess. Focused content
tests cover concrete attacks, pawn counts, counterexamples, Falkbeer pin changes,
the anchored rehearsal, transposition histories and final Rosanes mating geometry.
Native Stockfish checks evaluate the prescribed choices
and stronger opponent resources separately from the historical illustrations.
Player tests cover branch return, withheld rehearsal answers, historical-game
exploration and optional enrollment. No network access or live engine analysis
is needed to load a lesson.
The [teaching-quality review](VERIFICATION.md#opening-course-teaching-quality-review--september-30-2026)
records the earlier source and engine audit. The
[curriculum restructuring record](VERIFICATION.md#opening-curriculum-restructuring--september-30-2026)
records revision 3 authoring budgets, factual checks and player validation.
