# Vienna Gambit course sources

`vienna-gambit`, revision `2026-10-v1`, is an original Fieldwork course for
White. It teaches a bounded selection of lines, not a complete repertoire or a
promise that the gambit gives White an advantage. Explanations, prompts,
feedback and position annotations are original. The course has no historical
game excerpts: no game score was verified well enough to include.

## Curriculum and research decisions

| Chapter | Recall line | Teaching purpose |
|---|---|---|
| The gambit accepted | `1.e4 e5 2.Nc3 Nf6 3.f4 exf4 4.e5 Ng8 5.Nf3 d6 6.d4 dxe5 7.Bb5+ c6 8.Bc4 exd4 9.Bxf4 dxc3 10.Bxf7+ Ke7 11.Qe2+ Kxf7 12.Ne5+ Kf6 13.Bg5+ Kxg5 14.Nf7+` | Punish the most common reply with a chain of checks that ends in a knight fork of king, queen and rook. Side trips: `4...Qe7`, `5...Nc6`, `6...Bg4`, `7...Bd7`, `10...Kxf7` and `12...Ke8`. |
| Black strikes with d5 | `… 3...d5 4.fxe5 Nxe4 5.Nf3 Nxc3 6.bxc3 Bg4 7.d4 Nc6 8.Bd3 Be7 9.O-O O-O 10.h3` | Take on e5, recapture toward the center and build a c3–d4–e5 pawn chain. Side trips: `5...Bg4`, `5...Bc5` and `6...Nc6`, which returns to the main line. |
| Black declines the gambit | `… 3...d6 4.Nf3 Nc6 5.d4 exd4 6.Nxd4 Nxd4 7.Qxd4 Be7 8.Be3 O-O 9.O-O-O` | Develop with an attack on e5, open the center and castle queenside. Side trips: `3...Nc6`, `4...Bg4` and `4...exf4`. |
| Black's other second moves | `1.e4 e5 2.Nc3 Nc6 3.Bc4 Nf6 4.d3 Bc5 5.Nf3 d6 6.O-O Bg4 7.h3` | Against `2...Nc6`, develop before pushing f4. Side trips: `2...Bc5` (Anderssen Defense), `3...Bc5` and `4...Bb4`. |

Every chapter ends with a rehearsal of its main line from the first move. Every
side trip has its own recall line, also starting from the first move and ending
on White's move. The lessons and recall lines give one answer in every position
they share; `test_course_recall_agreement.py` checks this.

## Opponent replies (Maia-3)

Maia-3, the human-move model Fieldwork uses in game review, estimated how often
1200- and 1600-rated players choose each Black move. These are model estimates,
not counted games. Black's moves
in the lessons are Maia's most common choice at that point, averaged over both
ratings, except where a chapter or side trip covers a less common reply on
purpose.

| Position | Black's replies (Maia 1200 / 1600) | Taught |
|---|---|---|
| After `2.Nc3` | `2...Nc6` 36% / 40%, `2...Nf6` 33% / 29%, `2...Bc5` 9% / 9% | chapters 1–3 follow `2...Nf6`; chapter 4 covers `2...Nc6` and `2...Bc5` |
| After `3.f4` | `3...exf4` 50% / 41%, `3...d6` 17% / 21%, `3...Nc6` 17% / 14%, `3...d5` 6% / 12% | all four |
| After `4.e5` | `4...Ng8` 55% / 56%, `4...Qe7` 23% / 37% | both |
| After `5.Nf3` | `5...d6` 33% / 39%, `5...Nc6` 27% / 19% | both |
| After `6.d4` | `6...dxe5` 68% / 72%, `6...Bg4` 13% / 15% | both |
| After `7.Bb5+` | `7...c6` 62% / 74%, `7...Bd7` 31% / 23% | both |
| After `10.Bxf7+` | `10...Ke7` 58% / 81%, `10...Kxf7` 42% / 19% | both |
| After `12.Ne5+` | `12...Kf6` 69% / 73%, `12...Ke8` 23% / 22% | both |
| After `3...d5 … 5.Nf3` | `5...Nxc3` 50% / 32%, `5...Bg4` 17% / 30%, `5...Bc5` 12% / 17% | all three |
| After `6.bxc3` | `6...Bg4` 33% / 37%, `6...Nc6` 31% / 22% | both |
| After `3...d6 4.Nf3` | `4...Nc6` 39% / 40%, `4...Bg4` 27% / 35%, `4...exf4` 18% / 10% | all three |
| After `2...Nc6 3.Bc4` | `3...Nf6` 51% / 45%, `3...Bc5` 22% / 30% | both |
| After `4.d3` | `4...Bc5` 37% / 39%, `4...Bb4` 23% / 22% | both |

## Engine check

Every White move in a lesson, side trip or recall line was checked with
Stockfish 18 at depth 20 on this PC. A script confirmed that every lesson move
lies on one of the 19 checked recall lines. Each taught move is the engine's
first choice or within 0.3 pawns of it, with one documented exception:

- **`3.f4`, the gambit move itself,** trails `3.Nf3` by about 0.4 at depth 20
  and 22 (about −0.2 for White against +0.2). As with `2.f4` in the King's
  Gambit, the move that defines the opening is kept.

`2.Nc3` trails `2.Nf3` by about 0.2, and `3.Bc4` against `2...Nc6` trails
`3.Nf3` by about 0.1. Against `2...Nc6`, `3.f4` is about 0.8 worse than the
best move, so the course develops first. In the `4...Qe7` side trip, `6.d4` is
the engine's first choice, up to about 0.45 ahead of
`6.Nf3` at depths 18 to 26 (sometimes nearly level), varying between runs.

Scores in pawns from White's side at the end of each line:

| Line | Final score | Notes |
|---|---|---|
| Accepted, `14.Nf7+` | about +10 | The knight then takes the queen or the rook. `15.Nxh8+` is Stockfish's choice after `14...Kg6`. |
| `10...Kxf7 11.Qxd8` | +7.8 | |
| `12...Ke8 13.Nxc6+ Qe7 14.Nxe7` | +5.5 | |
| `4...Qe7 … 9.dxc7+` | +7.8 | `9...Qxc7 10.Nxc7` wins the queen. |
| `5...Nc6 … 9.Bxf4` | +3.0 | |
| `3...d5` main line, `10.h3` | +2.2 | `10...Bh5` is Black's most common reply. |
| `3...d6` main line, `9.O-O-O` | +0.8 | |
| `2...Nc6` main line, `7.h3` | +0.2 to +0.4 | |
| `2...Bc5 … 8.Bg3` | +1.0 | |

## Names and codes

The [Wikipedia article on the Vienna Game](https://en.wikipedia.org/wiki/Vienna_Game)
and its sources give the names used here: the Vienna Gambit `2...Nf6 3.f4`,
`5.Nf3` as the traditional main move after `3...d5 4.fxe5 Nxe4`, `5.Qe2` against
`4...Qe7`, and the Anderssen Defense `2...Bc5`. The article advises Black not to
accept with `3...exf4` because of `4.e5`. It also notes that the name "Vienna Gambit"
traditionally applied to `2...Nc6 3.f4`, and that `2...Nf6` is Black's most common
reply; Maia rates `2...Nc6` slightly more common at club level.
Lichess's opening file names `2...Nf6 3.f4` "Vienna Game: Vienna Gambit" (C29)
([lichess-org/chess-openings](https://github.com/lichess-org/chess-openings/blob/master/c.tsv)).
ECO codes: C25 for `2...Nc6` and
`2...Bc5`, C28 for `2...Nc6 3.Bc4 Nf6`, and C29 for the Vienna Gambit `2...Nf6 3.f4`.

## Verification

The course validator checks full move histories, connected steps, branch
anchors and rehearsal lines with python-chess. `test_vienna_claims.py` checks
the board facts behind each explanation: checks, discovered checks, pins,
relative pins against the queen, forks, material counts and the transposition
back to the `3...d5` main line. It also checks that after `14.Nf7+` every legal
reply is a king move and the knight still attacks the queen and the rook. The
course journey tests walk every chapter and side trip, and the browser spec
walks all four chapters on desktop and mobile.
