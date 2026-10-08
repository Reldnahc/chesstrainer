# Sicilian Dragon course sources

`sicilian-dragon`, revision `2026-10-v1`, is an original Fieldwork course for
Black. It teaches a bounded selection of lines, not a complete repertoire.
Explanations, prompts, feedback and position annotations are original. The
course has no historical game excerpts: no game score was verified well enough
to include.

## Curriculum and research decisions

| Chapter | Recall line | Teaching purpose |
|---|---|---|
| Build the Dragon | `1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be2 Bg7 7.O-O O-O 8.Be3 Nc6 9.Nxc6 bxc6 10.Qd2 d5` | Reach the Dragon, fianchetto, castle, recapture toward the center and break with d5. Side trips: `4.Qxd4`, `6.Bc4`, `7.Be3` and `9.Qd2`. |
| Meet the Yugoslav Attack | `… 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.O-O-O d5 10.exd5 Nxd5 11.Nxd5 Qxd5 12.Nxc6 Qxc6 13.Bh6 Be6` | One simple plan against White's sharpest setup: castle, Nc6, and d5 the moment White castles queenside. Side trips: `7.Qd2 Ng4`, `8.Bc4`, `9.Nxc6`, `10.Nxc6` (the rook offer with `13...Qc7`) and `11.Nxc6`, which reaches the same position. |
| When the bishop goes to g5 | `… 6.Bg5 Bg7 7.Qd2 h6 8.Be3 Ng4 9.Bf4 e5 10.h3 exd4 11.hxg4 dxc3` | h6 takes g5 from the bishop, Ng4 chases it again and e5 forks knight and bishop. Side trips: `6.Bb5+`, `7.Bc4`, `7.Bb5+`, `8.Bh4`, `8.Bxf6` and `8.Bf4`. |
| White's second-move alternatives | `1.e4 c5 2.Bc4 e6 3.Nf3 Nc6 4.O-O Nf6 5.d3 d5 6.exd5 exd5` | Block the bishop, then take the center. Side trips: `2.Nc3` (back to the Dragon), `2.c3` (Alapin), `2.d4 cxd4 3.Qxd4` and `3.c3` (Smith-Morra Gambit, accepted). |
| White's third-move alternatives | `1.e4 c5 2.Nf3 d6 3.Bc4 Nf6 4.d3 Nc6 5.O-O g6 6.Bg5 Bg7 7.Nc3 O-O` | A Dragon setup without d4. Side trips: `3.Bb5+` (Moscow Variation), `3.Nc3` (back to the Dragon), `3.c3`, `4.Ng5` and `4.Nc3`. |

Every chapter ends with a rehearsal of its main line from the first move. Every
side trip has its own recall line, also starting from the first move and ending
on Black's move. The lessons and recall lines give one answer in every position
they share; `test_course_recall_agreement.py` checks this.

## Opponent replies (Maia-3)

Maia-3, the human-move model Fieldwork uses in game review, estimated how often
1200- and 1600-rated players choose each White move. These are model estimates,
not counted games: the Lichess opening explorer requires a login. White's moves
in the lessons are Maia's most common choice at that point, averaged over both
ratings, except where a chapter or side trip deliberately follows a less common
move:

- `6.Be2` (4% / 7%) is the first chapter's quiet setup. At club level the most
  common sixth moves are `6.Bg5` (27% / 21%), `6.Be3` (13% / 25%), `6.Bc4`
  (18% / 16%) and `6.Bb5+` (15% / 7%); each has a chapter or side trip.
- `7.f3` (13% / 33%) defines the Yugoslav Attack; `7.Qd2` (39% / 31%) is its
  side trip. `10.exd5` (26% / 33%) and `10.Nxc6` (27% / 34%) are almost equally
  common; both are taught.
- `2.Bc4` (17% / 12%) is the most common second move after `2.Nf3`; `2.d4`
  (10% / 8%), `2.Nc3` (8% / 7%) and `2.c3` (4% / 6%) are side trips. After
  `2.d4 cxd4`, `3.Qxd4` (76% / 37%) and `3.c3` (14% / 47%) are both covered.
- After `2.Nf3 d6`, `3.Bc4` (33% / 22%) is the most common move other than
  `3.d4`. `3.Nc3` (14% / 7%), `3.c3` (6% / 10%) and `3.Bb5+` (6% / 6%) are side
  trips. After `3.Bc4 Nf6`, `4.d3` (25% / 32%), `4.Nc3` (28% / 28%) and `4.Ng5`
  (24% / 10%) are all covered.

## Engine check

Every Black move in a lesson, side trip or recall line was checked with
Stockfish 18 at depth 20 on this PC (the cloud checks of the earlier courses
used Stockfish 17.1). A script confirmed that every lesson move lies on one of
the 29 checked recall lines. Each taught move is the engine's first choice or
within 0.3 pawns of it, with one documented exception:

- **`5...g6`, the Dragon move itself,** trails `5...a6` (the Najdorf) by 0.28 at
  depth 20 and by 0.27 to 0.39 at depth 22, depending on the run. As with `2.f4`
  in the King's Gambit, the move that defines the opening is kept. It appears
  in the first chapter and in the `2.Nc3` and `3.Nc3` transpositions.

Other notable checks, scores in pawns from Black's side at the end of each line:

| Line | Final score | Notes |
|---|---|---|
| Quiet `6.Be2` setup | 0.0 | `10...d5` is level with `10...Qc7` and `10...a5`. |
| Yugoslav, `9.O-O-O d5` | +0.2 | `13...Be6` is first choice; after `14.Bxg7`, `Kxg7` is the only recapture. |
| `7.Qd2 Ng4 8.Bf4 Bxd4 9.Qxd4 e5` | +2.4 | `7...O-O` is about 0.3 worse than `7...Ng4`. |
| Rook offer, `13...Qc7 14.Qxa8 Bf5 15.Qxf8+ Kxf8` | +0.8 | Queen against two rooks and a pawn; `15...Bxf8` is about −0.2. |
| `6.Bg5 … 8.Be3 Ng4 9.Bf4 e5 10.h3 exd4 11.hxg4 dxc3` | +4.0 | After `12.bxc3` or `12.Qxc3`, Black is a knight up for a pawn. |
| `8.Bf4 e5` | +2.2 | The fork wins material. |
| `3.c3 Nf6 4.d4 Nxe4 5.dxc5 Nxc5` | +1.0 | Black keeps the extra pawn. |
| Smith-Morra, `7...Nf6` | +0.1 | `8.Qe2 Be7` is the engine's choice next. |

Summary advice that goes beyond the taught moves was checked too: `11.e5 Ng4`
in the quiet line (`11...Nd7` is about 0.5 worse), `10.exd5 Nxd5` after
`7.Be3 … 9...d5`, `6.exd5 exd5` after `4.Ng5 e6 5.d3 d5`, and `8.Nd5 Nxd5` in the
third-move chapter.

## Names and codes

The opening, variation names and ECO codes follow the
[Wikipedia article on the Dragon](https://en.wikipedia.org/wiki/Sicilian_Defence,_Dragon_Variation)
(B70 to B79, including B76 for the Yugoslav Attack with `7...O-O` and B77 for
`9.Bc4`) and its sources. The article also records that Fyodor Dus-Chotimirsky
named the variation in 1901 after the constellation Draco, and that `9...d5` is
Black's usual reply to `9.O-O-O`. The other names are standard: Alapin
Variation (`2.c3`, B22), Smith-Morra Gambit (`2.d4 cxd4 3.c3`, B21), Moscow
Variation (`3.Bb5+`, B51 to B52).

## Verification

The course validator checks full move histories, connected steps, branch
anchors and rehearsal lines with python-chess. `test_dragon_claims.py` checks
the board facts behind each explanation: attacks, pins, defenders, forks,
material counts and the two transpositions back to the Dragon. The course
journey tests walk every chapter and side trip, and the browser spec walks all
five chapters on desktop and mobile.
