# Tactics course sources

`tactics-foundations`, revision `2026-10-v1`, is an original Fieldwork course for
White on six basic tactical patterns. Unlike the opening courses it has no recall
lines, so nothing from it enters Due. Explanations, prompts, hints and feedback
are original. Of its 18 example positions, 15 were composed for this course, two
are well-known opening traps and one comes from a historical game.

## Curriculum and research decisions

| Chapter | Examples | Teaching purpose |
|---|---|---|
| Forks: attack two pieces at once | Ne7+ forks king and queen; e5 forks bishop and knight; Qa4+ forks king and a loose bishop | One move, two targets; piece values; why a check makes a fork hard to escape; loose pieces |
| Pins: hold a piece in front of a bigger one | Re1 pins a knight that d5 then attacks; Bb5 pins the queen to the king; Caro-Kann trap ending in Nd6# | A piece pinned to the king cannot leave the line, not even to capture; attack a pinned piece again |
| Skewers: attack through the bigger piece | Ra7+ along a rank, Bd3+ along a diagonal, Re1+ along a file | The pin turned around: check the front piece, take the one behind |
| Discovered attacks and double check | Petrov trap with Nc6+; Bxh7+ uncovering Rd1 on the queen; Réti–Tartakower's Qd8+ and Bg5+ | Move one piece to uncover another; a moving piece that checks; a double check allows only king moves |
| Remove the defender | Bxf6 removes h7's guard; e5 chases it away; Bxc6 removes a bishop's only defender | Ask what each piece guards; capture or chase the guard |
| Back-rank checkmate | Re8# against an unguarded back rank; Rxe8+ Bxe8 Rxe8# by counting; Qxc8+ Qxc8 Rxc8# | The king's own pawns block its escape; count guards; luft for your own king |

Each chapter introduces its pattern on the first position, highlighting the
targets, then shortens the help on the next two. Every example asks for one or
two learner moves, inside the project's limit of about five learner moves per
exercise. Chapter-end steps name the matching theme in Study's Puzzles theme
filter; those themes exist in the bundled Lichess starter pack.

### Chapter boundaries

- **One pattern per chapter.** Each pattern needs its own recognition cue: two
  targets for a fork, a valuable piece behind for a pin, a valuable piece in
  front for a skewer.
- **Discovered attack and double check together.** A double check is a
  discovered check in which the moving piece also gives check, so it is taught
  as the chapter's last step rather than separately.
- **Capturing and chasing a defender together.** Both remove a guard; they match
  the starter pack's *capturing defender* and *deflection* themes.
- **Back-rank mate is the only mating pattern.** Other mating patterns, defensive
  tactics and Black-side practice are outside this course.

## Named positions and sources

- **Caro-Kann trap:** `1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Qe2 Ngf6 6.Nd6#`.
  The lesson claims only the moves, the pinned e7-pawn and the mate; tests assert
  the pin and the mate.
- **Petrov trap:** `1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4 4.Qe2 Nf6 5.Nc6+`. The feedback
  names 4...Qe7 as Black's correct reply; Stockfish 17.1 at depth 20 ranks it
  first (White +0.56), ahead of 4...d6 (+1.45).
- **Réti–Tartakower, Vienna 1910:** score and publication history from Edward
  Winter, [Réti v Tartakower](https://www.chesshistory.com/winter/extra/retitartakower.html).
  Georg Marco published the game in the *Neues Wiener Tagblatt* on 1 April 1910
  with the finish `10 Bg5+ Resigns`, as did Bachmann's 1911 *Schachjahrbuch*.
  Tartakower later called it a casual game (*Freipartie*). The commonly given
  `10...Kc7 11.Bd8#` (and `10...Ke8 11.Rd8#`) are continuations, not moves of the
  earliest published score; the lesson says so when it plays them. The example
  starts after `8...Nxe4` and demonstrates `9.Qd8+ Kxd8`.

The 15 composed positions have no source. Their FENs are constants at the top of
`backend/trainer/study_lessons/courses/tactics.py`.

## Engine verification

Stockfish 17.1 (Linux x86-64 AVX2 build, 4 threads, 256 MB hash) searched every
decision with MultiPV over all legal moves: depth 18 for the taught move, depth
16 for the scripted reply. Mates and board claims are asserted exactly with
python-chess in `backend/tests/test_tactics_course.py`.

| Example | Taught move | Score | Next-best other move |
|---|---|---|---|
| Knight fork | Ne7+ | +6.30 | +2.87 |
| Pawn fork | e5 | +1.89 | −4.40 |
| Queen fork | Qa4+ | +5.51 | +1.37 |
| Pinned knight | d5 | +5.43 | +3.12 |
| Pinned queen | Bb5 | +5.68 | +2.96 |
| Caro-Kann trap | Nd6# | mate | +0.30 |
| Rank skewer | Ra7+ | +7.34 | +0.08 |
| Diagonal skewer | Bd3+ | +8.32 | −0.17 |
| File skewer | Re1+ | +6.37 | +1.39 |
| Petrov trap | Nc6+ | +4.92 | +2.69 |
| Discovered check | Bxh7+ | +6.65 | +4.39 |
| Réti–Tartakower | Bg5+ | mate in 2 | −4.87 |
| Captured guard | Bxf6 | +8.10 | +5.25 |
| Chased guard | e5 | +4.58 | +1.22 |
| Only defender | Bxc6 | +4.54 | +0.83 |
| Open back rank | Re8# | mate | mate in 4 |
| Guarded back rank | Rxe8+ | mate in 2 | +1.62 |
| Queen sacrifice | Qxc8+ | mate in 2 | −0.14 |

Every taught move, including each follow-up capture, is Stockfish's first choice
or within 15 centipawns of it. The two near-ties are a pinned knight that cannot
escape (after `d5 Ke7`, h4 and dxe6 score the same) and a second queen win
(Rb5+ beside Bxh7 in the diagonal skewer). A decision accepts only the taught
move; another winning move gets the player's standard "different continuation"
message.

Every scripted reply is within 40 centipawns of Stockfish's best defense, or is
mated just as quickly:

- **Pinned knight:** the reply is Stockfish's ...Ke7, which defends the knight
  but keeps the pin. An earlier draft used ...Kf8, ranked 13th of 18.
- **Only defender:** ...bxc6 is the natural recapture (−5.25); ...Bf6, which
  saves the bishop (−4.86), is better. The feedback names it and says the knight
  is still won.
- **Réti–Tartakower:** ...Kc7 and ...Ke8 are both mated next move; the feedback
  gives the other mate.
- **Pawn fork:** ...Nd7 scored within 35 centipawns of the best reply in both
  runs.

Composed positions were revised while authoring when the engine found a rival
idea: the pawn fork's White rook moved from e1 to d1 so ...Bb4 no longer comes
with tempo, and its reply became ...Nd7 because ...Nd5 let c4 compete with
exd6; a first queen fork (Qd5+) failed to ...Be6 and became Qa4+; the pinned
queen's knight moved from f6 to g6 so e5 was no longer a rival; the
only-defender knight moved from d2 to b3 so ...Bf4 no longer gained a tempo.

## Framework change

Tactics examples start from unrelated positions. An explanation step may now
begin a separate example from a different starting position (initial FEN): the
board changes without move playback, and Back returns to the previous example.
Within one starting position every transition must still continue the existing
history, and a branch, decision or demonstration cannot change the starting
position. The opening courses' content hashes are unchanged.

## Remaining boundaries

- Every example is White to move; there are no defensive tactics.
- Each decision has one accepted answer.
- The course appears in the shared lesson library under Study, next to the
  opening courses.
