# Fundamentals course sources

`chess-fundamentals`, revision `2026-10-v1`, is an original Fieldwork course for
White on six basic skills a new player needs before opening repertoires and
tactics pay off. Like the tactics course it has no recall lines, so nothing from
it enters Due. Explanations, prompts, hints and feedback are original. Of its 12
example positions, eight were composed for this course; four start from common
openings (two Italian Game positions, Scholar's mate and the Scandinavian
Defense).

## Curriculum and research decisions

| Chapter | Examples | Teaching purpose |
|---|---|---|
| What the pieces are worth | cxd4 takes a defended knight with a pawn; Bxf8 wins the exchange | The usual 1, 3, 3, 5, 9 scale; add up what you take and what you can lose; capture with the cheaper piece |
| Count attackers and defenders | Nxe5 Nxe5 Rxe5 on a pawn attacked twice and defended once; Nxe5 when the only defender is pinned | More attackers than defenders wins; start with the cheapest attacker; a piece pinned to its king does not defend |
| Before every move: checks, captures, threats | Qxg4 takes the bishop that attacked the queen; Scholar's mate, Qxf7# | Look at checks, captures and threats for both sides; answer a threat by first looking at captures; checks first |
| Opening principles | Scandinavian 3.Nc3, 4.d4, 5.Nf3; castling against ...Ng4 in the Italian | Center, development, gaining a tempo, castling early |
| Checkmate a lone king | Queen: Kf6, then Qg7#; rook: Rh1, then Rh8# | Drive the king to the edge, bring your own king, avoid stalemate |
| King and pawn endings | Rule of the square: Ke4, Kd3, Kc2, Kxb1; opposition: Ke5, Kf6 and a demonstration to e8=Q+ | Count a pawn race; catch a passed pawn; take the opposition and walk the pawn home |

Each chapter explains its skill on the first position, with highlighted squares
or arrows where they help, then asks for the next example with less help. Every
example asks for one to four learner moves, inside the project's limit of about
five learner moves per exercise. Three chapter-end steps name a matching theme
in Study's Puzzles theme filter (*Hanging piece*, *Mate in 1*, *Pawn endgame*);
those themes exist in the bundled Lichess starter pack. The opening chapter
points to the opening courses instead.

### Chapter boundaries

- **Values before counting.** Counting attackers and defenders only decides a
  capture once the learner can compare what is won and lost.
- **The checks, captures and threats habit gets its own chapter.** It joins the
  first two skills to every move. One example answers an opponent's threat with
  a capture, the other finds a mate by looking at checks first.
- **One opening chapter.** Center, development, tempo and castling are taught
  together as one checklist on two short openings. Specific openings stay in the
  opening courses.
- **Queen and rook mates only.** Bishop-and-knight and two-bishop mates are not
  basic enough for this course.
- **The square and the opposition only.** Key squares, triangulation and other
  pawn-ending theory are outside this course.

## Named positions and sources

- **Italian Game (piece values):** `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6
  6.O-O O-O 7.h3 Nd4`. The last move is a composed mistake; the lesson claims only
  the board facts that tests assert.
- **Scholar's mate:** `1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7#`. The feedback names
  3...g6 and 3...Qe7 as Black's defenses; Stockfish 17.1 at depth 22 ranks them
  first and second (Black +0.33 and +0.15).
- **Scandinavian Defense:** `1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 Bf5`.
  3...Qa5 is the main line, which usually plays ...c6 before ...Bf5 (4.d4 c6
  5.Nf3 Nf6 6.Bc4 Bf5); 5...Bf5 is a playable alternative. Either way, Black's
  early queen loses time to Nc3.
- **Italian Game (castling):** `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 Nf6 5.Nc3 Ng4`,
  stored as a FEN because the chapter's first example also starts from the
  initial position. A test plays the moves and compares the FEN.

The eight composed positions have no source. Their FENs are constants at the top
of `backend/trainer/study_lessons/courses/fundamentals.py`.

## Engine verification

Stockfish 17.1 (Linux x86-64 AVX2 build, 4 threads, 256 MB hash) searched every
decision with MultiPV over all legal moves: depth 20 for the taught move, depth
18 for the scripted reply. Board claims, mates and the stalemate are asserted
exactly with python-chess in `backend/tests/test_fundamentals_course.py`.

| Example | Taught move | Score | Next-best other move |
|---|---|---|---|
| Knight on d4 | cxd4 | +4.17 | +0.86 |
| Open diagonal | Bxf8 | +3.16 | +0.53 |
| Two attackers | Nxe5 | +1.48 | +0.34 |
| Two attackers, recapture | Rxe5 | +1.40 | −4.14 |
| Pinned defender | Nxe5 | +3.14 | +1.34 |
| Loose bishop | Qxg4 | +4.61 | −0.28 |
| Scholar's mate | Qxf7# | mate | −1.71 |
| Early queen | Nc3 | +0.71 | +0.29 |
| Early queen, center | d4 | +0.73 | +0.72 |
| Early queen, development | Nf3 | +0.63 | +0.44 |
| Knight on g4 | O-O | +0.82 | +0.94 (Bxf7+) |
| Queen mate | Kf6 | mate in 2 | mate in 3 |
| Rook mate | Rh1 | mate in 2 | mate in 3 |
| Pawn race | Ke4 | +4.95 | −6.14 |

Every taught move except O-O in the Italian castling position is Stockfish's
first choice. There Bxf7+ scores a little higher (+0.94 against +0.82 at depth
20, +0.88 against +0.80 at depth 26); the prompt asks for castling, and O-O is
the only castling move. The other near-tie is the Scandinavian's fourth move,
where d4 and Nf3 score within a few centipawns; the prompt asks for a pawn on a
center square, and d4 is the only such move. A decision accepts only the taught move; another good move gets
the player's standard "different continuation" message. Prompts are written so
that the taught move is the only one that fits them: for example, Nc3 is the
only knight move that attacks the queen, and Kf6 is the only legal forward king
move after ...Kd7.

Every scripted reply is within 15 centipawns of Stockfish's best defense, or is
the only legal move, or is mated just as quickly:

- **Open diagonal:** ...Qxf8 (−3.24) is second to ...Kxf8 (−3.15).
- **Early queen:** ...Qa5 (−0.69) is second to ...Qd6 (−0.66); it is the main
  line. ...Bf5 (−0.72) is second to ...c6 (−0.58).
- **Pawn race:** ...b1=Q+ is mated as quickly as the other promotions.
- **Queen and rook mates:** ...Kh7 and ...Kf8 are the only legal moves.

Composed positions were revised while authoring when the engine or a duplicate
found a problem: the first counting example gained an extra black pawn by
mistake and was corrected; the pinned-defender position was redrawn because
Bxc6+ and Qxd8+ matched Nxe5 on an open d-file; a castling example in the
Scandinavian was dropped because castling scored well below Ne4; a back-rank
mate planned for the checks-first example repeated the tactics course and was
replaced by Scholar's mate; and a counting example with a knight pinned on e6
repeated the tactics course's pin example and was dropped.

## Independent review

Before merging, independent reviews rechecked every board claim with
python-chess, every taught move and reply with Stockfish 17.1, the endings with
the Syzygy tables, and the terms against Wikipedia, chess.com and ChessKid
articles. They found no false chess fact in the lesson text, and these changes
followed:

- *Material*, *develop* and the eighth rank are explained where they first
  appear. A series of captures on one square is a *trade*, because chapter 1
  uses *the exchange* for a rook against a bishop or knight.
- **Scholar's mate:** ...g6 is safe only when the e5-pawn is defended (after
  2.Qh5 g6?? Qxe5+ wins the h8-rook), and after ...g6, Qf3 aims at f7 again: 22
  of Black's 32 replies then allow Qxf7#, and ...Nf6 blocks it.
- **Castling:** a rook and a pawn for a knight and a bishop is 6 points for 6, so
  the feedback says why it is still a bad trade (Stockfish −2.86 for Black after
  ...Nxf2 Rxf2 Bxf2+ Kxf2).
- **Stalemate:** the warning covers every move that is not a check, not only
  queen moves; from `7k/8/4Q3/6K1/8/8/8/8 w`, the king move Kg6 is stalemate.
- **The square:** after ...b3 the king on e4 is outside the smaller square, so
  the step asks the king to step into it.
- **Rook pawns:** the summary warns that the king-in-front method often fails
  with an a- or h-pawn. Syzygy scores `6k1/8/6K1/7P/8/8/8/8 b` as a draw and the
  same position with a g-pawn as a White win.
- **Description:** Scholar's mate is called a trap, not an opening.

The course had not been released, so it keeps revision `2026-10-v1` with a new
content hash.

## Tablebase verification

The two pawn endings and both mates were checked exactly with Syzygy endgame
tablebases (the 3- and 4-piece WDL tables shipped in the python-chess
repository), probed with python-chess. The app itself still uses no
tablebases.

- **Pawn race:** at each of the three king decisions the taught move is the only
  winning move, and every other move loses, including h5 at the start. After
  ...b1=Q+, Kxb1 wins.
- **Opposition:** Ke5 is the only winning move; the other five legal moves draw.
  After ...Kd7, Kf6 wins (Kd5 and Kf5 also win, but are not forward moves). Every
  White move in the closing demonstration keeps the win.
- **Mates:** Kf6 and Rh1 are the only moves that force mate next move; tests
  assert this by trying every move and reply.

## Remaining boundaries

- Every example is White to move.
- Each decision has one accepted answer.
- Most of the starter pack's pawn-ending puzzles are rated above 1200, so that
  practice set is harder than the chapter.
- The course appears under Study → Lessons → Fundamentals with the tactics course, apart from
  the opening courses.
