# King's Gambit course sources

`kings-gambit-foundations`, revision `2026-09-v1`, is an original Fieldwork course
for White. Its explanations, prompts, feedback and position annotations are new
writing. The three short repertoire lines are authored study choices, not a
claim to cover every defense or to equal Stockfish's first choice. In particular,
the course never promises full compensation for the gambit pawn.

## Curriculum

- **A pawn for active play:** `1.e4 e5 2.f4 exf4 3.Nf3 d5 4.exd5 Nf6 5.d4
  Nxd5 6.Bc4 Nb6 7.Bb3 Nc6 8.O-O`. Answer Black's central break, notice the attack
  on the bishop, develop and castle. White is still a pawn down.
- **Challenge the pawn chain:** `1.e4 e5 2.f4 exf4 3.Nf3 g5 4.h4 g4 5.Ne5 Nf6
  6.d4 d6 7.Nd3 Nxe4 8.Bxf4 Be7 9.g3`. Distinguish the pawn attacks, develop
  while removing f4, and count the pawn Black took on e4. The bishop on f1 still
  needs to move before kingside castling; g3 supports h4 and prepares Bg2 rather
  than ignoring Black's potential Bxh4+.
- **When Black declines:** `1.e4 e5 2.f4 Bc5 3.Nf3 d6 4.c3 Nf6 5.d4 exd4
  6.cxd4 Bb6 7.Nc3`. Support and establish the center. An optional returnable
  Falkbeer comparison follows `2...d5 3.exd5 e4 4.d3 Nf6 5.dxe4 Nxe4`; it is
  illustrative, not a fourth enrollable line.

Each chapter ends in independent rehearsal. Historical scores are separate from
the three designated lines; viewing them never schedules their moves for recall.

## Historical scores

Source: *The Blue Book of Chess* (1910), [Project Gutenberg ebook 16377](https://www.gutenberg.org/ebooks/16377),
whose catalogue identifies the book as public domain in the United States. The
[complete text](https://www.gutenberg.org/files/16377/16377-h/16377-h.htm) includes
the original descriptive move tables and a PGN appendix. Both were inspected;
only the factual moves and attribution are reused, not the book's assessments.
No network access or analysis is required to load these bundled scores.

| Source game | Locator | Included score | Lesson excerpt |
|---|---|---|---|
| Anderssen–Kipping, Manchester Chess Meeting, 1857 | [p. 165, illustrative game I](https://www.gutenberg.org/files/16377/16377-h/16377-h.htm#Pg_165); PGN 60 | 47 plies, through `24.Rxf6`, White win by resignation | After `5.Ne5` through `11.O-O`, plies 9–21 |
| Morphy–Bornemann, blindfold game | [p. 183, illustrative game I](https://www.gutenberg.org/files/16377/16377-h/16377-h.htm#Pg_183); PGN 67 | 61 plies, through `31.cxd7+`, Black resigns | After `3...d6` through `11.O-O-O`, plies 6–21 |

Anderssen's game follows `5...h5`, not the `5...Nf6` defense in the chosen line.
The book places it under an Allgaier heading, but its score uses `5.Ne5`, not
`5.Ng5`; the course does not repeat that misleading classification. The original
descriptive table's last entry says `K. takes B.`. That move is impossible from
the legal position. The appendix supplies `24.Rxf6`, which the complete history
validates: the f1-rook takes the bishop on f6. We preserve the 47-ply endpoint
and do not append a hypothetical checkmate.

Morphy's game is explicitly described as blindfold. The source table and PGN
appendix do not specify its date or venue, so the lesson does not invent either.
The full-game annotation at ply 35 points to the later `18.cxd4`, beyond the
short opening excerpt, to connect c3 preparation with its eventual use. The
score ends in check, not checkmate; the stated resignation is from the source.

## Verification

The existing course validator checks every move, connected step history, branch
anchor, excerpt boundary and rehearsal line with python-chess. The focused
`test_kings_gambit_claims.py` checks the actual attacks, pawn counts, castling
setup, source-game blockers and recorded endpoints behind the teaching prose.
The shared new-course tests exercise the production player and optional opening
enrollment; the native content audit checks the authored choices for objective
blunders without making engine-first moves the answer authority.
