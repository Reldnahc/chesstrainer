# King's Gambit course sources

`kings-gambit-foundations`, revision `2026-09-v2`, is an original Fieldwork
course for White. The three chapters teach a bounded selection, not a complete
repertoire or a promise that the gambit gives White an advantage. Explanations,
prompts, feedback and position annotations are original. Sources informed the
choice of lines; their prose has not been copied into the lessons.

## Curriculum and research decisions

| Chapter | Recall line | Teaching purpose |
|---|---|---|
| A pawn for active play | `1.e4 e5 2.f4 exf4 3.Nf3 d5 4.exd5 Nf6 5.Bb5+ c6 6.dxc6 Nxc6 7.d4 Bd6 8.O-O O-O 9.Nbd2` | Develop with check, answer a counterattack, then support the center. Material is equal, but Black has active play. |
| Challenge the pawn chain | `1.e4 e5 2.f4 exf4 3.Nf3 g5 4.h4 g4 5.Ne5 Nf6 6.Bc4 d5 7.exd5 Bd6 8.d4 Nh5 9.O-O` | Follow the opponent's threats: defend Ne5 before castling. Explain the defended f4-pawn and the possible knight jump to g3. |
| When Black declines | `1.e4 e5 2.f4 Bc5 3.Nf3 d6 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb6 7.Nc3` | Cover h4, prepare the central break, and preserve the d4-pawn's role in blocking the bishop's diagonal to g1. |

The Modern Defense uses an established bishop-check line instead of the first
draft's `5.d4 Nxd5 6.Bc4 Nb6` script. Ian Simpson's [original Modern Defense
analysis](https://www.ianchessgambits.com/kings-gambit-modern-defence.html)
discusses the stronger `...Be6` resource against that draft and the `Bb5+` setup.
It also identifies the `Nbd2`/`c3` plan. Exeter Chess Club's [annotated game
collection](https://www.exeterchessclub.org.uk/content/variations-kings-gambit)
includes Kinlay–Nunn, London 1977, following the selected line through `9.Nbd2`.
This course stops at a useful development plan rather than implying a forced
attack or equal engine evaluation.

John Shaw's [*The King's Gambit* publisher sample](https://www.newinchess.com/media/wysiwyg/product_pdf/7093.pdf)
and Steve Giddins's [*The Most Exciting Chess Games Ever* publisher sample](https://www.newinchess.com/media/wysiwyg/product_pdf/9024.pdf),
pp. 172–174, motivated a closer review of the pawn-chain chapter. The original
`6.d4 d6 7.Nd3 Nxe4 8.Bxf4 Be7` script avoided Black's more challenging central
play. Revision 2 develops `Bc4` and meets `...d5`/`...Bd6`. The move order makes
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
- **Falkbeer:** `2...d5 3.exd5 e4 4.d3 Nf6 5.dxe4 Nxe4` is a returnable
  comparison, with a next-development explanation. It is not a fourth recall
  line.

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
tests cover concrete attacks, pawn counts, the two counterexamples and the final
Rosanes mating geometry. Native Stockfish checks evaluate the prescribed choices
and stronger opponent resources separately from the historical illustrations.
Player tests cover branch return, withheld rehearsal answers, historical-game
exploration and optional enrollment. No network access or live engine analysis
is needed to load a lesson.
The [teaching-quality verification record](VERIFICATION.md#opening-course-teaching-quality-review--september-30-2026)
records the deeper Stockfish authoring budgets, results and limits.
