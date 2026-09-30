# King's Gambit course sources

`kings-gambit-foundations`, revision `2026-09-v3`, is an original Fieldwork
course for White. The chapters teach a bounded selection, not a complete
repertoire or a promise that the gambit gives White an advantage. Explanations,
prompts, feedback and position annotations are original. Sources informed the
choice of lines; their prose has not been copied into the lessons.

## Curriculum and research decisions

| Chapter | Recall line | Teaching purpose |
|---|---|---|
| A pawn for active play | `1.e4 e5 2.f4 exf4 3.Nf3 d5 4.exd5 Nf6 5.Bb5+ c6 6.dxc6 Nxc6 7.d4 Bd6 8.O-O O-O 9.Nbd2 Bg4 10.c3` | Develop with check, answer a counterattack, then carry out the central-support plan while recognizing the relative pin. Material is equal, but Black has active play. |
| Challenge the pawn chain | `1.e4 e5 2.f4 exf4 3.Nf3 g5 4.h4 g4 5.Ne5 Nf6 6.Bc4 d5 7.exd5 Bd6 8.d4 Nh5 9.O-O` | Follow the opponent's threats: defend Ne5 before castling. Explain the defended f4-pawn and the possible knight jump to g3. |
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

This is still a bounded foundation. Fischer (`3...d6`), Cunningham (`3...Be7`)
and other accepted defenses are not silently covered by these scripts. A
complete repertoire would require their own researched choices; listing their
names or reusing the g5 line would not supply that teaching. No new chapter has
been added merely to match another course's length.

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
  are forced. Return to the branch and play `8.d4` first.
- **The tempting e5-pawn:** after `2...Bc5`, the comparison is
  `3.fxe5? Qh4+ 4.Ke2 Qxe4#`. `Ke2` is explicitly only one losing reply.
  `4.g3 Qxe4+` instead illustrates the king/rook fork explained in the text.
  Exeter's [introductory King's Gambit lesson](https://exeterchessclub.org.uk/content/ideas-behind-kings-gambit)
  also teaches the queen-check hazard.
- **Falkbeer move-order recognition:** after `2...d5 3.exd5`, the optional
  `...exf4 4.Nf3 Nf6` comparison reaches the Modern Defense board. It keeps its
  actual move history; the position is not substituted with another history.
- **Falkbeer exchange sequence:** after `9.Be3`, one optional continuation is
  `9...Nxc3 10.Bxc5 Qxe2+ 11.Bxe2 Nxe2 12.Kxe2`. White answers an attack on the
  queen with a counterattack, then meets the checking exchange. Both queens
  and two minor pieces per side are removed; White has one extra pawn and has
  lost castling rights. It is explicitly one possible resolution, not a
  forced continuation or part of the new recall line.

Ian Simpson's [original Falkbeer analysis](https://www.ianchessgambits.com/kings-gambit-falkbeer-counter-gambit.html)
informs the immediate d3 challenge and the Nf3/Qe2 coordination. Exeter's
[annotated Bronstein–Tal game](https://www.exeterchessclub.org.uk/content/variations-kings-gambit)
follows the selected development through `9.Be3`. Fieldwork's comparison then
uses the independently checked `10...Qxe2+`, rather than importing the game's
`10...Nxe2`. These are original teaching explanations of legal board facts,
not copied source annotations. The historical full-game library is unchanged.
The classical `3...e4` is a named alternative Black may choose, not a claim that
it is stronger than transposing to the Modern Defense with `3...exf4`.

Each chapter ends in independent rehearsal. Historical games and comparison
branches never automatically schedule their moves for recall.

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
