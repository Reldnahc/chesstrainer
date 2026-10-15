# Course sources

One authoring and source record for each bundled Study course: why its chapters
are shaped as they are, which historical scores and references it relies on,
and how its claims are checked. Course content and
validation rules are in [Study](STUDY.md#guided-lessons); the file format is in
[Course files](COURSE_FILES.md).

## White Italian Game

Revision `2026-10-v5` teaches a connected quiet White setup, Black's common alternatives including the Two Knights Defense, the setup's remaining development, and an actual central break. Historical games provide explicitly contrasting examples rather than substitutes for the repertoire's missing plans. Only their factual move scores were transcribed. All Fieldwork instructional explanations, decisions, highlights, and repertoire selections are original writing; no modern game annotations are reproduced.

### Why these chapter boundaries

Chapter count follows the learning problems, not a template. The Two Knights has its own chapter because after `3...Nf6 4.d3`, Black's common fourth moves `4...d5`, `4...h6`, `4...d6` and `4...Bb4+` each need their own answer, and only `4...Bc5` transposes to the first chapter (`4...Be7` is met by castling). The course does **not** claim every Two Knights setup transposes; sharper White alternatives such as Pollock's `4.d4` are outside this starter repertoire.

| Chapter | Learner outcome | Scope decision |
| --- | --- | --- |
| Build the quiet setup | Explain development, e4 support and king safety; punish `3...Nd4` and meet `3...h6` | Four required decisions; side trips for `3...Nd4` (five decisions) and `3...h6` (three). Feedback notes cover `4...d6`, `4...h6`, `5...O-O` and `5...h6`, which keep the same plan. |
| Meet the Two Knights Defense | Defend e4 with `d3`; answer `4...d5` with `exd5`, castling and `Re1`; meet `4...h6`, `4...d6` and `4...Bb4+` | Four required decisions; three side trips with seven decisions. Pollock's different `d4/Ng5` game is an optional contrast. |
| Give every piece a job | Connect `c3`, `Re1`, `Bb3`, `Nbd2–f1` and `Be3/Nxe3` to a working position | Seven required decisions. Keep the sequence together because moving the rook and knight creates the later bishop development and recapture. Optional branches answer the `...Bg4` pin, practise a bishop escape and punish premature `...d5`; none interrupts the main path. |
| Choose when to open the center | Play `d4`, choose the exchange order, rebuild the center and finish development; recognize Black's active counterstrike | Five required decisions and two optional decisions. The good `...d5` response is compared at the exact position where it diverges, rather than taught as another long opening line. |

There are 94 teaching steps and 43 decisions including optional branches. These are consequences of the selected teaching objectives, not a minimum size for future courses. Later rehearsals begin at their chapter's shared position, retaining full legal history, so the lesson player does not repeatedly ask for the initial setup. Optional Due enrollment still uses the existing full-line opening-study behavior and position deduplication.

### Instructional research and scope

- **Sverre Johnsen, *How to Beat the Open Games* (Gambit, 2018), pp. 80–83**, [publisher/distributor sample](https://www.newinchess.com/media/wysiwyg/product_pdf/7805.pdf). The quiet Italian discussion emphasizes patterns and manoeuvres across many playable move orders, including rook placement, bishop exchanges and knight routes. This supports teaching decisions rather than presenting one fixed sequence as universal.
- **Martyn Kravtsiv, *PCO: Practical Chess Openings* (Gambit), pp. 83–85**, [sample](https://www.newinchess.com/media/wysiwyg/product_pdf/89017.pdf). The sample discusses `Bb3–c2`, `Nbd2–f1`, bishop exchanges and Black's prepared `...d5`. It also explains that active Black counterplay remains after sensible White development. Fieldwork's selected continuations are independently checked; the course is not a transcription of this book's repertoire.
- **Alexander Kalinin and Nikolai Kalinichenko, *The Modernized Italian Game for White* (Thinkers Publishing, 2021)**, [authorized sample](https://www.scacco.it/data/attachments/10102/modernized-italian-game.pdf), contents and foreword. The authors distinguish central expansion, bishop pursuit/exchanges and Black's `...d5` as separate strategic problems. This informed the coverage review, not a claim to teach all of the book's themes or its full analysis.

These contemporary sources retain their own copyright. Their published samples were consulted to check instructional priorities; Fieldwork's wording and exercises are original. The public-domain score provenance below applies only to the historical tournament book.

### Concrete claims and authoring checks

The revised line continues to `15.Be3`, rather than stopping at preparation. Its selected route is:

`1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 Nf6 5.O-O d6 6.c3 O-O 7.Re1 a6 8.Bb3 Ba7 9.Nbd2 h6 10.Nf1 Re8 11.Ng3 Be6 12.d4 exd4 13.Bxe6 fxe6 14.cxd4 Qe7 15.Be3`.

The development chapter instead illustrates `11.Be3 Bxe3 12.Nxe3`: the knight recapture keeps the f-pawn intact. Mason's historical `fxe3` gives an immediately relevant structural contrast. Neither recapture is labelled universally superior.

Specific checks prevent misleading generalizations:

- `Bc2` escapes `...Na5`, but **does not yet defend e4 while White's pawn is on d3**. The lesson explicitly distinguishes its future support after the pawn advances.
- The early `7...d5` example is a **premature break**, not strong scripted resistance. After `8.exd5 Nxd5 9.Nxe5 Nxe5 10.Rxe5 c6`, White has won one pawn, not the game.
- After the main line's `12.d4`, the alternative `12...d5 13.dxe5 Ng4 14.Nd4 Ncxe5` is sound active counterplay with seven pawns each. It is not described as another version of the earlier mistake.
- `13.Bxe6` before `cxd4` removes the bishop that could otherwise pin the f3-knight from g4. Immediate `cxd4` remains playable; the selected exchange order is not called a forced tactic or unique best move.
- After `...exd4 Bxe6 fxe6`, Black's original e-pawn is on d4. The recapture therefore **does not create doubled e-pawns**; it leaves the f-file semi-open. After `cxd4`, White has pawns on d4/e4 and Black on d6/e6.
- The final `Be3` supports d4 and completes development. Black still has `...Ng4` and `...e5` resources; the course promises neither a free attack nor an opening win.
- `3...Nd4` leaves e5 undefended, but `4.Nxe5? Qg5` attacks the knight and g2. After `4.Nxd4 exd4 5.O-O Bc5 6.Bxf7+ Kxf7 7.Qh5+`, every legal reply leaves the c5-bishop attacked and undefended; White ends a pawn up and Black can no longer castle.
- In the Two Knights, `4...d5` attacks the c4-bishop and the e4-pawn at once. After `7.Re1`, e5 is attacked twice and defended once until `...Bd6`.
- After `4...d6`, the f8-bishop can reach only e7 and only Black's king defends f7. After `5.Ng5 Be6 6.Nxe6 fxe6`, nothing defends e6.
- The `3...h6` side trip, the Two Knights `4...h6` side trip and `3...Bc5 4.d3 Nf6 5.O-O h6 6.c3` reach the same position.
- `...Bg4` pins the f3-knight to the queen, not the king. After `h3 Bh5 Nbd2` the d2-knight defends f3. `gxf3` after an immediate `...Bxf3` would double White's f-pawns and remove the g-pawn, which is why the lesson recaptures with the queen.
- In Mason–Lasker each side has developed one bishop; White's c1-bishop is still at home. The Steinitz comparison names the real difference from our setup: we support e4 and castle before d4. Steinitz also prepared a c-pawn recapture, so that is not the difference.

`backend/tests/test_italian_white_claims.py` checks these relationships against production step positions, including the negative cases. Bounded Stockfish checks support the chosen examples; they do not certify an exhaustive repertoire or every historical move as best.

### Common replies

Maia-3, the human-move model Fieldwork uses in game review, estimates how often 1200- and 1600-rated players choose each reply. These are model estimates, not counted games. The course covers Black's most common third moves (`3...h6`, `3...Nd4`) and fourth moves after `3...Nf6 4.d3`.

Every taught White move, in chapters, side trips and recall lines, is Stockfish 17.1's first choice at depth 20 to 22 or within 0.3 pawns of it. Scores are pawns from White's side. Black's shown replies are the most common in Maia's estimate unless noted.

| Black's reply (Maia 1200 / 1600) | Taught White moves | Stockfish | Notes in the lesson |
|---|---|---|---|
| `3...Nd4` (8% / 7%) | `4.Nxd4 exd4 5.O-O Bc5 6.Bxf7+ Kxf7 7.Qh5+ Kf8 8.Qxc5+` | +1.2, then +3 to +4 | `4.Nxe5? Qg5` is −0.6; `5...Nf6 6.Re1` and `5...d6 6.c3` (+1.4); `6...Kf8 7.Bb3` (+3.1); `8...d6 9.Qxd4`. `7...Kf8` is Stockfish's choice. |
| `3...h6` (16% / 12%) | `4.O-O Nf6 5.d3 Bc5 6.c3` | +0.5, then +0.2 to +0.3 | `4.d4` is +0.6; `4...Bc5 5.c3` and `d4` (+1.0) |
| `3...Nf6 4.d3 d5` (19% / 9%), the Two Knights main line | `5.exd5 Nxd5 6.O-O Be6 7.Re1 Bd6` | +0.4 to +0.7 | `5.Bb3` is −0.3 and `5.Bb5` −0.8. Against `6...Be6`, `7.Ng5` is about 0.2 better; `7.Re1` is best against the about equally common `6...Bg4` and `6...Bc5`, so one move covers all three. `8.d4` (+1.0), also against `7...f6`. |
| `4...h6` (13% / 16%) | `5.O-O Bc5 6.c3` | +0.3 | the `3...h6` trip's position; `5...d6 6.c3` |
| `4...d6` (8% / 6%) | `5.Ng5 Be6 6.Nxe6 fxe6 7.Bxe6` | +0.8, then +2.1 to +2.2 | Maia also expects `5...d5` (40% / 56%): `6.exd5` (+0.9), then `6...Na5 7.Bb5+` or `6...Nxd5 7.O-O`. Against `7...Qe7` or `7...Nd4`, `8.Bh3`. |
| `4...Bb4+` (5% / –) | `5.c3 Ba5 6.O-O` | +0.4 to +0.5 | `5...Bc5` (48% / 32%) or `5...Be7`: castle |
| `6...Bg4` after `6.c3` (44% / 47%) | `7.h3 Bh5 8.Nbd2` | +0.4 to +0.5 | `7...Bxf3 8.Qxf3` (+0.7; `8.gxf3` is −0.7); `8...Bxf3 9.Nxf3`; `6...O-O 7.Re1 Bg4 8.h3` (+0.3) |
| `4...d6`, `4...h6` after `3...Bc5 4.d3`; `5...O-O`, `5...h6` after `5.O-O` | castle, then `c3` | +0.2 to +0.3 | feedback notes only |

Recall lines for side trips start where their chapter's main line starts: the first chapter's from the initial position, the Two Knights lines after `3...Nf6`, the development chapter's after `5...d6` and the central chapter's after `10...Re8`. The `...Na5`, premature `...d5` and active `...d5` comparisons also have recall lines.

### Names and codes

A recall line's ECO code is the code of the deepest classified position it reaches, as game databases classify it. The `3...h6`, `4...h6` and quiet-setup lines (development, the `...Bg4` pin, the `...Na5` and `...d5` comparisons, and the central break) play `c3` with `...Nf6`, `...Bc5` and `d3` on the board, the Giuoco Pianissimo position of `3...Bc5 4.c3 Nf6 5.d3`, so they carry C54: the [ECO list](https://en.wikipedia.org/wiki/List_of_chess_openings) gives C54 for `4.c3 Nf6`, and Lichess's [opening file](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) names these positions "Italian Game: Classical Variation, Giuoco Pianissimo" (C54). Lines without `c3` keep C50.

### Primary publication and reuse

Horace F. Cheshire (editor), *The Hastings Chess Tournament 1895: Containing the authorised account of the 230 games played Aug.–Sept. 1895*, published in 1896 by G. P. Putnam's Sons / Chatto & Windus.

- [Internet Archive primary scan](https://archive.org/details/cu31924029919820)
- [Original PDF](https://archive.org/download/cu31924029919820/cu31924029919820.pdf)
- [Wikimedia Commons provenance and public-domain declaration](https://commons.wikimedia.org/wiki/File:The_Hastings_chess_tournament_1895._Containing_the_authorised_account_of_the_230_games_played_Aug.-Sept._1895_(IA_cu31924029919820).pdf)

The Commons file record identifies the original book as public domain in its country of origin and jurisdictions with a term of life plus 100 years or fewer, and in the United States because of its publication date. It applies [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/). The historical book is the source of the bundled scores, not the licensing terms of a modern database or modern commentary.

### Included scores

| Game | Purpose | Printed pages | Complete recorded score |
| --- | --- | --- | --- |
| James Mason–Emanuel Lasker, 27 August 1895 | Quiet development with 4.d3; exchanges change the pawn structure | [264–265](https://archive.org/details/cu31924029919820/page/n319/mode/1up) | 82.Kh8, drawn; 163 plies |
| Wilhelm Steinitz–Curt von Bardeleben, 17 August 1895 | Prepare an immediate central opening with 4.c3 and 5.d4 | [157–158](https://archive.org/details/cu31924029919820/page/n200/mode/1up) | 25.Rxh7+, White won (see below); 49 plies |
| William H. K. Pollock–Emanuel Schiffers, 2 September 1895 | Black's Two Knights development and central counterplay require a different response | [330](https://archive.org/details/cu31924029919820/page/n391/mode/1up) | 44...a2, White resigned; 88 plies |

The historical games illustrate choices and consequences. Their complete continuations are examples, not automatically enrolled repertoire or a claim that every move was best. Pollock's loss is explicitly a warning example. Lesson excerpts need not require learners to memorize the later middlegame or endgame.

### Transcription checks and differences

The named printed pages were visually inspected in the primary scan. Every move in all three complete scores is legal under python-chess; the course content model also validates the full histories when loading. SAN is retained in the course file, `backend/trainer/study_lessons/courses/italian-foundations.json`, as a readable transcription and converted to UCI through python-chess.

[IRLchess's Hastings collection](https://www.irlchess.com/hastings1895_allfiles/openings_hastings1895.html), which cites the tournament book, was used as a secondary cross-check. Differences were resolved against the primary scan:

- **Mason–Lasker:** the book plays 8...c6 and 10...O-O. Some modern scores exchange those moves, reaching the same position after move 10. Fieldwork follows the printed order, so source-game histories and excerpt anchors remain exact.
- **Pollock–Schiffers:** the primary book includes 44...a2 before “White resigns.” The IRLchess PGN ends after 44.h6. Fieldwork includes the final legal black move recorded on printed page 330.
- **Steinitz–von Bardeleben:** the actual score ends at 25.Rxh7+. The book prints “Resigns”, but reports from the tournament, collected in [Edward Winter's article](https://chesshistory.com/winter/extra/steinitzvonbardeleben.html), say von Bardeleben left the room without resigning and lost on time. The White course says only that White won; the Black course explains the loss on time. The book subsequently prints an illustrative mate continuation; that analysis is not included as played moves.

The primary book calls Steinitz “W. Steinitz.” Modern catalogues may use William or Wilhelm; Fieldwork displays the surname and does not infer additional biography from the score.

## Black Italian

`italian-black-foundations`, revision `2026-10-v6`, teaches Black through a
bishop-first Italian repertoire. The chapters cover quiet development against
White's common fourth moves, choosing a post-castling plan, the early c3/d4
central advance, the `7.Nc3` gambit, and declining the Evans Gambit. Each ends
in independent rehearsal; only its 17 designated lines can be enrolled for
scheduled recall.
This is a starter repertoire, not coverage of every White continuation.

All instructions, position notes, hints and feedback are original Fieldwork
writing. Guided decisions identify the move taught in this course rather than
claiming it is the only legal or objectively best move. Historical game scores
illustrate the ideas and remain separate from the chosen recall lines.

### Historical scores

The primary source is Horace F. Cheshire (editor), *The Hastings Chess Tournament
1895*, published in 1896. The factual scores come from the public-domain original
book, not from modern instructional commentary.

| Game | Lesson purpose | Primary source | Complete score endpoint |
| --- | --- | --- | --- |
| Mason–Lasker, 27 August 1895 | Black's quiet development; bishop exchanges change White's pawn structure | [pp. 264–265](https://archive.org/details/cu31924029919820/page/n319/mode/1up) | 82.Kh8, draw; 163 plies |
| Steinitz–von Bardeleben, 17 August 1895 | Black answers c3/d4 with exchanges, Bb4+ and d5 | [pp. 157–158](https://archive.org/details/cu31924029919820/page/n200/mode/1up) | 25.Rxh7+; Black left without resigning and lost on time; 49 plies |
| Pollock–Lasker, 13 August 1895 | Declining b4, preserving the bishop and returning to development | [p. 115](https://archive.org/details/cu31924029919820/page/n152/mode/1up) | 23...Ne2+, White resigned; 46 plies |

The first two scores reuse the existing validated transcriptions, with their own
Black-side annotations. They do not alter the White Italian course. The
[original Italian source record](#white-italian-game) records
their source differences and reuse provenance. The original book's
[Commons record](https://commons.wikimedia.org/wiki/File:The_Hastings_chess_tournament_1895._Containing_the_authorised_account_of_the_230_games_played_Aug.-Sept._1895_(IA_cu31924029919820).pdf)
documents the public-domain status and applies Public Domain Mark 1.0.

Pollock–Lasker was checked visually against printed page 115 (PDF page 153,
zero-based scan leaf 152) in the same primary scan. Its complete factual
score agrees with the [IRLchess transcription](https://www.irlchess.com/hastings1895_allfiles/games_hastings1895/g72.htm),
used only as a secondary cross-check. No Tarrasch annotation or other source prose
is reproduced. The score ends with the recorded check and resignation; it does
not invent a played mating continuation.

### Teaching choices and limits

- **Quiet Italian:** `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 Nf6 5.O-O d6
  6.c3 O-O`. The decisions teach development, mutual e-pawn support and castling.
  The course does not imply Nf6 wins the defended e4-pawn, and the feedback
  says no central pawns have been exchanged yet rather than calling the center
  “closed”, a term for locked pawn chains. An optional branch
  asks for `4.d3 Nf6 5.Ng5 O-O`: the rook on f8 joins the defense of f7. Side
  trips meet White's other common fourth moves: `4.O-O Nf6 5.d3 d6` and
  `4.Nc3 Nf6 5.d3 d6` keep Black's setup, `4.Ng5 Qxg5 5.d4 Qxg2` punishes
  the undefended knight, and `4.d4 Bxd4 5.Nxd4 Nxd4 6.c3 Nc6 7.Qf3 Qf6` keeps
  the won pawn while stopping `Qxf7` mate.
- **Plan after castling:** From that familiar position, `7.Re1 a5 8.Nbd2 Be6
  9.Bxe6 fxe6` asks the learner to carry out the plan: restrain b4, develop
  the remaining bishop and restore material after White chooses to exchange.
  Black gains doubled e-pawns and a semi-open f-file; the e6-pawn supports d5/f5,
  but Nf6 still blocks Rf8. The course does not invent an immediate rook attack,
  claim b4 is illegal, or imply White must choose Bxe6. The chapter rehearsal
  starts at the castled position and asks only its three new decisions. Optional
  Due enrollment uses the existing course-line import, which preserves the
  complete opening history and deduplicates positions; it is not a promise that
  the account's scheduled study will contain only those three decisions.
- **Early central advance:** `4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Bd2 Bxd2+
  8.Nbxd2 d5 9.exd5 Nxd5 10.O-O O-O`. The supported claims are concrete: the
  bishop check and exchange, the d5-pawn's attacks on c4/e4, equal material after
  recapture, and both kings castling. Side trips meet `6.e5 d5 7.Bb5 Ne4
  8.cxd4 Bb6`, `8.Qxd2 Nxe4 9.Qe3 d5` (the queen recapture leaves e4
  undefended), `10.Qe2+ Be6 11.O-O O-O` and `10.Qb3 Nce7 11.O-O O-O`. The
  historical excerpt uses the distinct `7.Nc3` reply instead, which the next
  chapter teaches. Its pin, ensuing piece placement and later Black loss
  are explicitly a contrast, not a recommendation to memorize that game. At
  the taught line's endpoint, the explanation identifies White's isolated
  d4-pawn, Black's blockade on d5 and White's remaining space/activity. It does
  not equate an isolated pawn with a lost pawn or a won game.
- **The `7.Nc3` gambit:** `7.Nc3 Nxe4 8.O-O Bxc3 9.bxc3 d5 10.Bb5 O-O`. The
  pinned c3-knight cannot recapture on e4, and taking the pawn is Stockfish's
  only move that keeps Black better. White gets two bishops and open lines for
  the pawn; the chapter does not claim Black is winning. Side trips meet
  `8.Qe2 d5 9.Bb5 O-O` and the Møller Attack, `9.d5 Bf6 10.dxc6 bxc6`.
- **Evans Declined:** `4.b4 Bb6 5.c3 d6 6.a4 a6 7.a5 Ba7 8.d3 Nf6
  9.O-O O-O`. This is a deliberately quiet study selection. It trades time and
  queenside space for keeping the bishop without accepting the offered pawn;
  it is not described as a refutation of the gambit. The returnable branch meets
  Pollock's historical `8.b5` with `8...axb5 9.Bxb5 Nf6 10.a6 Nxe4`: the a6
  push left e4 undefended. Lasker's `10...O-O` is noted as also good.
  The game excerpt continues through `13...d5`, connecting development to an
  actual central break while White's king is still on e1. Both ...Nf6 and ...O-O
  are guided decisions before rehearsal asks for them.

The quiet Evans continuation is authored teaching material, not attributed to
Pollock–Lasker. The central chapter branches from the source game's opening at
White's seventh move; the game itself is never enrolled. Opening codes
identify these selected lines; they are not grading evidence.

### Instructional sources

The curriculum is checked against the following instructional sources. These
support the teaching choices and tradeoffs;
the lesson prose is original, and no licensed annotations or course package was
imported.

| Source | Relevance and limit |
| --- | --- |
| John Emms, [*First Steps: 1 e4 e5*, official publisher sample, pp. 12–17](https://www.newinchess.com/media/wysiwyg/product_pdf/7790.pdf) | Explains bishop-first development and meeting a later Ng5 with castling. Our short branch shows the defender added on f8, without importing the source's full tactical game. |
| GM Arjun Kalyan, [*Top-Level Repertoire against Italian Game*, free author preview](https://www.modern-chess.com/course/top-level-repertoire-against-italian-game/82911/) | Confirms the chosen bishop-first framework and specifically motivates ...a5 before ...Be6 to restrain White's queenside play after an exchange. It also distinguishes c3/d4 from c3/d3 and identifies other concrete branches outside this starter course. |
| IM Jeremy Silman, [*The Art and Science of the Isolated d-Pawn*](https://www.chess.com/article/view/the-art-and-science-of-the-isolated-d-pawn) | Explains the defender's blockade/pressure/exchange ideas and the isolated pawn side's space and active-piece compensation. The exact Fieldwork endpoint has the isolated d4-pawn and knight on d5; the lesson does not promise an automatic structural win. |

### Chapter boundaries

Chapter count is an outcome of distinct learning goals, not a template to fill.

| Chapter | Teaching reason |
| --- | --- |
| Quiet development | Six setup decisions and the f7-defense comparison. Basic development and king safety form one coherent checkpoint. |
| Plan after castling | Queenside restraint, bishop exchange and its structural cost belong together. Rehearsal starts from the already learned castled position, so basic setup is not repeated just to practice the new plan. |
| Early central advance | The bishop check, exchange, ...d5 and recapture are one connected response. Splitting it would separate the tactical actions from the resulting isolated-pawn structure. |
| The `7.Nc3` gambit | White's most common reply to `6...Bb4+`; its main line and two side trips hold eight decisions. |
| Evans Declined | Preserving the bishop and resuming development are the same defensive task. A second chapter would mostly repeat ordinary development. |

The boundary is explicit: selected starter lines, not an exhaustive Black
repertoire or a middlegame strategy course. White's other responses to ...Be6,
and many early Italian sidelines, are not silently claimed as covered.

### Names and codes

A recall line's ECO code is the code of the deepest classified position it
reaches, as game databases classify it. The two quiet lines (develop and castle,
restrain and exchange) play `c3` with `...Nf6`, `...Bc5` and `d3` on the board,
the Giuoco Pianissimo position of `3...Bc5 4.c3 Nf6 5.d3`, so they carry C54:
the [ECO list](https://en.wikipedia.org/wiki/List_of_chess_openings) gives C54
for `4.c3 Nf6`, and Lichess's [opening
file](https://github.com/lichess-org/chess-openings/blob/master/c.tsv) names
these positions "Italian Game: Classical Variation, Giuoco Pianissimo" (C54).
Lines without `c3` keep C50.

### Common replies

Maia-3, the human-move model Fieldwork uses in game review, estimates how often
1200- and 1600-rated players choose each reply. These are model estimates, not
counted games.

Every taught Black move, in chapters, side trips and recall lines, is
Stockfish 17.1's first choice at depth 20 to 22 or within 0.3 pawns of it,
except the deliberate Evans decline with `4...Bb6` (about 0.4). Scores are pawns
from Black's side, so positive scores favor Black. White's shown replies are the
most common in Maia's estimate unless noted.

| White's reply (Maia 1200 / 1600) | Taught Black moves | Stockfish | Notes in the lesson |
|---|---|---|---|
| `4.O-O` (18% / 20%) | `4...Nf6 5.d3 d6` | −0.2 | `6.c3 O-O` rejoins the main line. `6.Bg5`, `6.h3` or `6.Nc3 h6` (about −0.1); `6.Ng5` or `5.Ng5 O-O` (+0.2 to +0.5); `5.Nc3` or `5.Re1 d6` (−0.1 to −0.2); `5.c3 Nxe4 6.d4 d5` (+0.4); `5.d4 Bxd4 6.Nxd4 Nxd4`, a pawn ahead (+0.2) |
| `4.Nc3` (14% / 13%) | `4...Nf6 5.d3 d6` | −0.1 | `6.Bg5 h6` (0.0); `6.Be3 Bxe3` (+0.1); `5.O-O d6` reaches the `4.O-O` trip's position; `5.Ng5 O-O` (+0.5); the rare `5.Nxe5 Nxe5 6.d4 Nxc4 7.dxc5` leaves Black a piece for a pawn ahead (+2.8) |
| `4.Ng5` (5% / –) | `4...Qxg5 5.d4 Qxg2` | +4.2, then +6.0 | `6.dxc5 Qxh1+` or `6.Rf1 Qxe4+` (+6.1 to +6.6); `5.d3 Qxg2` (+5.9) |
| `4.d4` (4% / 5%) | `4...Bxd4 5.Nxd4 Nxd4 6.c3 Nc6 7.Qf3 Qf6` | 0.0, then +0.9 to +1.1 | `7.Qf3` threatens `Qxf7` mate. `7.Qd5 Qf6` (+1.1); `5.Ng5 Nh6` (+0.4); `5.c3 Bb6` (+1.2); `6.Qh5 Qe7` (+0.8); `6.Be3 Nc6` (+0.1) |
| `6.e5` (8% / 20%) | `6...d5 7.Bb5 Ne4 8.cxd4 Bb6` | 0.0 to +0.1 | `7.Bb5` leads at 1600; at 1200, `7.exf6` is slightly more common: `7...dxc4 8.fxg7 Rg8` (+0.9). `7.exd6 Qxd6` (+1.5); `7.Bb3` or `7.Be2 Ne4` (0.0 to +0.4); `7.cxd4 dxc4` (+1.0); `8.Bxc6+ bxc6` (+0.3) |
| `8.Qxd2` (33% / 9%) | `8...Nxe4 9.Qe3 d5` | +0.5, then +0.8 | `10.Bb5 Bd7` (+1.1); `10.Bxd5 Qxd5` (+1.0); `9.Qf4` or `9.Qe2 d5` (+0.4 to +1.2) |
| `10.Qe2+` (18% / 13%) | `10...Be6 11.O-O O-O` | +0.1 | `10...Qe7?` loses the d5-knight to `11.Bxd5` (−4.4). `11.Bxd5 Qxd5`, since the e6-bishop is pinned (+2.0); `11.Ng5 Qxg5` (+5.0); `11.Ne5 Nxd4` (+1.8) |
| `10.Qb3` (12% / 19%) | `10...Nce7 11.O-O O-O` | −0.3 to −0.2 | Stockfish's `10...Na5` (0.0) can repeat after `11.Qa4+ Nc6 12.Qb3` |
| `7.Nc3` (51% / 54%), new chapter | `7...Nxe4 8.O-O Bxc3 9.bxc3 d5 10.Bb5 O-O` | +0.3 to +0.7 | `7...O-O`, `7...Bxc3+` and `7...d5` are −0.6 to −1.1; `8...O-O? 9.Nd5` (−0.6). `10.Bb5` leads at 1600 and `10.Bb3` at 1200: castle against `10.Bb3`, `10.Bd3` or `10.Re1` (+0.4 to +0.9). The rare `10.Ba3` stops castling: `10...dxc4` (+1.9) |
| `8.Qe2` (22% / 15%) | `8...d5 9.Bb5 O-O` | +1.1, then +1.9 | `9.Bb3 O-O` (+2.9); `9.Bxd5 Qxd5` (+2.3); `9.O-O Bxc3` (+1.2) |
| `9.d5`, the Møller Attack (5% / 15%) | `9...Bf6 10.dxc6 bxc6` | +0.3, then +1.0 | `10.Re1 Ne7 11.Rxe4 O-O` (+0.1; `11...d6` is +0.2) |
| `8.b5` in the Evans (10% / 7%) | `8...axb5 9.Bxb5 Nf6 10.a6 Nxe4` | +0.6, then +1.0 | White's moves follow Pollock–Lasker, where Lasker castled instead (+0.85). `11.Qe2 Nf6` (+1.7); `11.axb7 Bxb7` (+2.5) |

The Evans `8.b5` side trip teaches `10...Nxe4`, which Stockfish rates about 0.2
pawns above Lasker's `10...O-O`, and says castling is also good. The `5.Ng5`
branch asks for castling as a decision.

Recall lines for side trips start where their chapter's main line starts: the
quiet, central and Evans chapters' from the initial position and the `7.Nc3`
chapter's after `6...Bb4+`. A test checks that the course's lessons and recall
lines give the same answer wherever they reach the same position, because
Recall accepts every enrolled line's move there.

### Checks

The production content validator replays every full source game, repertoire line,
decision reply and transition, preserving exact histories and branch anchors.
`backend/tests/test_italian_black_claims.py` checks the specific supports, attacks,
bishop exchange, historical pin, material balance, castling, retreat safety,
source annotation plies and final recorded fork. Further checks verify the f7
defenders, legal Rxf7 reply, the Bxe6/fxe6 structure, the actual isolated d4-pawn
and blockade, and the supported historical d5 break. Tests also prove b4
remains legal, a bishop retreat can decline the exchange, fxe6 is the actual
recapture, and Nf6 prevents an immediate rook attack on f2. The anchored plan
rehearsal matches its three guided decisions exactly; Evans rehearsal contains
no new post-gambit learner move absent from its instruction. The tests also
verify that changing Black-course annotations in one returned object cannot
mutate the original White course.

Side-trip tests replay each side trip's claims: what attacks and
defends the pieces named, the pins, checks and mate threats, that each move
recommended against White's alternatives is legal there, and the material
count each summary states. Further tests require every side trip to have a
recall line that ends where the trip ends and starts where its chapter starts.

The shared bundled-course journey tests walk every chapter through the
player. Stockfish searches are authoring checks only: opening a lesson never
downloads content or starts an engine job, and engine preferences do not
rewrite the authored answer contract.

## King's Gambit

`kings-gambit-foundations`, revision `2026-10-v6`, is an original Fieldwork
course for White. The chapters teach a bounded selection, not a complete
repertoire or a promise that the gambit gives White an advantage. Explanations,
prompts, feedback and position annotations are original. Sources informed the
choice of lines; their prose has not been copied into the lessons.

### Curriculum and research decisions

| Chapter | Recall line | Teaching purpose |
|---|---|---|
| A pawn for active play | `1.e4 e5 2.f4 exf4 3.Nf3 d5 4.exd5 Nf6 5.Bb5+ c6 6.dxc6 Nxc6 7.d4 Bd6 8.O-O O-O 9.Nbd2 Bg4 10.c3` | Develop with check, answer a counterattack, then carry out the central-support plan while recognizing the relative pin. Material is equal, but Black has active play. |
| Challenge the pawn chain | `1.e4 e5 2.f4 exf4 3.Nf3 g5 4.h4 g4 5.Ne5 Nf6 6.Bc4 d5 7.exd5 Bd6 8.d4 Nh5 9.O-O` | Follow the opponent's threats: defend Ne5 before castling. Explain the defended f4-pawn and the possible knight jump to g3. |
| Meet Black's other replies | `1.e4 e5 2.f4 exf4 3.Nf3 Nc6 4.d4 d6 5.Bxf4 Bg4 6.Be2` | One plan for the common replies the other chapters skip: cover h4, take the center with d4, win back f4 with the c1-bishop. Side trips cover 2...Nc6, 3...d6, 3...Nf6, 3...Be7 and 4...d5. |
| Build a center against Bc5 | `1.e4 e5 2.f4 Bc5 3.Nf3 d6 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb6 7.Nc3` | Cover h4, prepare the central break, and preserve the d4-pawn's role in blocking the bishop's diagonal to g1. |
| Meet the Falkbeer countergambit | From `1.e4 e5 2.f4 d5`: `3.exd5 e4 4.d3 Nf6 5.dxe4 Nxe4 6.Nf3 Bc5 7.Qe2 Bf5 8.Nc3 Qe7 9.Be3` | Remove the e4 wedge before Nf3, use the open e-file, then recognize how intervening pieces change the pin. |


#### Chapter boundaries

The chapter count follows the positions' learning demands, not a quota:

- **Modern Defense.** The bishop check, central counterattack and castling
  sequence form one connected development problem. The continuation
  `9...Bg4 10.c3` carries out the c3 support plan while showing Black's
  relative pin on Nf3. One pawn move does not justify a separate chapter.
- **Pawn chain.** `h4`, the attacked knight, `...d5` and defending Ne5
  before castling are successive consequences of the same position. Splitting
  at `...Bd6` would separate the threat from its answer. The optional premature
  castling example and Rosanes contrast support that objective; they are
  optional illustrations, not recall obligations.
- **Black's other replies.** One plan covers the common replies the other
  chapters skip; its table is under Common replies below.
- **Bc5 refusal.** The queen-check hazard and the prepared c3/d4 center belong
  together; its five guided decisions follow a single pawn structure.
- **Falkbeer.** `...e4` prevents the normal immediate Nf3 development, and
  clearing it gives Black piece activity on the open e-file. The chapter
  develops through Qe2, Nc3 and Be3, has its own rehearsal, and shows why a
  changing pin requires reassessment. Recall starts after `2...d5`, with the
  full game history preserved, rather than adding repeated initial e4/f4
  decisions.

The course is a bounded foundation, not a complete repertoire. Rarer second and
third moves, and deeper alternatives inside each chapter, are not covered.

The Modern Defense uses an established bishop-check line rather than
`5.d4 Nxd5 6.Bc4 Nb6`. Ian Simpson's [original Modern Defense
analysis](https://www.ianchessgambits.com/kings-gambit-modern-defence.html)
discusses Black's stronger `...Be6` resource against that line and the `Bb5+` setup.
It also identifies the `Nbd2`/`c3` plan. Exeter Chess Club's [annotated game
collection](https://www.exeterchessclub.org.uk/content/variations-kings-gambit)
includes Kinlay–Nunn, London 1977, following the selected line through `9.Nbd2`.
The added `...Bg4` / `c3` position makes the support plan concrete, while the
remaining undeveloped bishop and queen explain why this is not a completed
attack or a promise of equal engine evaluation.

John Shaw's [*The King's Gambit* publisher sample](https://www.newinchess.com/media/wysiwyg/product_pdf/7093.pdf)
and Steve Giddins's [*The Most Exciting Chess Games Ever* publisher sample](https://www.newinchess.com/media/wysiwyg/product_pdf/9024.pdf),
pp. 172–174, inform the pawn-chain chapter. Its line develops `Bc4` and meets
Black's challenging central play with `...d5`/`...Bd6`, rather than a
`6.d4 d6 7.Nd3` line that avoids it. The move order makes the lesson concrete:
`8.d4` defends Ne5 before `9.O-O`.

The course does not claim `6.d4` is refuted; Stockfish rates it close to
`6.Bc4`. The line is chosen for its teaching sequence and opponent resistance,
not because every alternative is wrong. The selected `9.O-O` is also a study
choice; `9.Nc3` appears in the literature.

### Short comparisons

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
not copied source annotations. The classical `3...e4` is a named alternative Black may choose, not a claim that
it is stronger than transposing to the Modern Defense with `3...exf4`.

Each chapter ends in independent rehearsal. Historical games and side trips
never automatically schedule their moves for recall. Each side trip
that shows a common opponent reply has its own optional recall line. The two
mistake demonstrations, premature castling and `3.fxe5?`, have none: their
White moves are what not to play.

### Historical scores

| Game | Score source | Included score | Lesson excerpt |
|---|---|---|---|
| Rosanes–Anderssen, Breslau 1863 | [Giddins publisher sample, pp. 172–174](https://www.newinchess.com/media/wysiwyg/product_pdf/9024.pdf#page=17) | 46 plies, through `23...Re1#`, Black win | After `8...Nh5` through `13...Ng3`, plies 16–26 |
| Morphy–Bornemann, blindfold game | [*The Blue Book of Chess* (1910), p. 183](https://www.gutenberg.org/files/16377/16377-h/16377-h.htm#Pg_183); PGN 67 | 61 plies, through `31.cxd7+`, Black resigns | After `3...d6` through `11.O-O-O`, plies 6–21 |

Rosanes–Anderssen reaches the position studied in chapter two and then takes a
different ninth move, showing why taking material does not replace developing
and protecting the king. The score agrees with
[Edward Winter's](https://chesshistory.com/winter/extra/rosanesanderssen.html).
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
1910 book as public domain in the United States. chessgames.com lists the game
as 32 moves, so its score may continue one move beyond `31.cxd7+`.

### Explanation details

- **Bc5 refusal, `7.Nc3`:** nothing else defends e4 against the f6-knight, so
  Nc3 is its only defender.
- **Modern Defense, `7...Bd6`:** the bishop defends f4 but cannot reach h2;
  Black's own f4-pawn blocks it.
- **Pawn chain, `5.Ne5`:** the rejected alternative is the Allgaier Gambit,
  `5.Ng5 h6 6.Nxf7`, which gives the knight up on f7.
- **Premature castling:** `9.Re1` pins the bishop to the king, `9...Qe7` defends
  it and shields the king, and `10...Bxd4+` escapes with check.
- **After `9.O-O`:** counting attackers suggests `Bxf4` wins a pawn, but after
  `9...O-O 10.Bxf4` Black ignores the bishop and plays `10...Qxh4` with a strong
  attack (about −2.9 for White). `Rxf4` lets the h5-knight take the rook. The
  text says both.

### Common replies

Maia-3, the human-move model Fieldwork uses in game review, estimates how often
1200- and 1600-rated players choose each reply. These are model estimates, not
counted games. `2...Nc6` alone is about a quarter of Black's replies to `2.f4`.

Taught White moves are checked with Stockfish 17.1 at depth 20 to 22. `2.f4`
itself scores about −0.7 for White, which is normal for this gambit, and
`5.Bb5+`, `6.Bc4` and `7.d4` trail the engine's first choice by 0.3–0.5. Every
taught move in the table below is the first choice or within 0.2 pawns of it. Scores are pawns from White's side; the accepted
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
is a note. In the Falkbeer, the `3...exf4` and `9...Nxc3` comparisons are side
trips with decisions and their own recall lines. The Modern Defense and
Falkbeer chapters each have a queen-recapture side trip; the bishop's
check `5.Bb5+` in the transposition trip trails Stockfish's `5.c4` by about 0.2,
as in the Modern Defense chapter itself.

Recall lines for side trips start where their chapter's main line starts. A
test checks that the course's lessons and recall lines give the same answer
wherever they reach the same position, because Recall accepts every enrolled
line's move there.

### Verification

The course validator checks full move histories, connected steps, branch
anchors, source excerpts and rehearsal lines with python-chess. Focused content
tests cover concrete attacks, pawn counts, counterexamples, Falkbeer pin changes,
the anchored rehearsal, transposition histories and final Rosanes mating geometry.
Stockfish authoring checks evaluate the prescribed choices and stronger
opponent resources separately from the historical illustrations. Player tests
cover branch return, withheld rehearsal answers, historical-game exploration
and optional enrollment. No network access or live engine analysis is needed to
load a lesson.

## Sicilian Dragon

`sicilian-dragon`, revision `2026-10-v1`, is an original Fieldwork course for
Black. It teaches a bounded selection of lines, not a complete repertoire.
Explanations, prompts, feedback and position annotations are original. The
course has no historical game excerpts: no game score was verified well enough
to include.

### Curriculum and research decisions

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

### Opponent replies (Maia-3)

Maia-3, the human-move model Fieldwork uses in game review, estimated how often
1200- and 1600-rated players choose each White move. These are model estimates,
not counted games. White's moves
in the lessons are Maia's most common choice at that point, averaged over both
ratings, except where a chapter or side trip deliberately follows a less common
move:

- `6.Be2` (4% / 7%) is the first chapter's quiet setup. At club level the most
  common sixth moves are `6.Bg5` (27% / 21%), `6.Be3` (13% / 25%), `6.Bc4`
  (18% / 16%) and `6.Bb5+` (15% / 7%); each has a chapter or side trip.
- `7.f3` (13% / 33%) defines the Yugoslav Attack; `7.Qd2` (39% / 31%) is its
  side trip. `10.exd5` (26% / 33%) and `10.Nxc6` (27% / 34%) are almost equally
  common; both are taught. Books treat `9.Bc4` as White's main ninth move, but
  Maia rates it only 4% / 8%, and `9.g4` 4% / 6%. Neither has its own side trip;
  `9.Bc4 Nxd4` reaches the same position as the `8.Bc4` side trip.
- `2.Bc4` (17% / 12%) is the most common second move after `2.Nf3`; `2.d4`
  (10% / 8%), `2.Nc3` (8% / 7%) and `2.c3` (4% / 6%) are side trips. After
  `2.d4 cxd4`, `3.Qxd4` (76% / 37%) and `3.c3` (14% / 47%) are both covered.
- After `2.Nf3 d6`, `3.Bc4` (33% / 22%) is the most common move other than
  `3.d4`. `3.Nc3` (14% / 7%), `3.c3` (6% / 10%) and `3.Bb5+` (6% / 6%) are side
  trips. After `3.Bc4 Nf6`, `4.d3` (25% / 32%), `4.Nc3` (28% / 28%) and `4.Ng5`
  (24% / 10%) are all covered.

### Engine check

Every Black move in a lesson, side trip or recall line is checked with
Stockfish 18 at depth 20; every lesson move lies on one of the 29 recall lines.
Each taught move is the engine's first choice or within 0.3 pawns of it, with
one documented exception:

- **`5...g6`, the Dragon move itself,** trails `5...a6` (the Najdorf) by about
  0.3 to 0.4 at depth 20 to 22. As with `2.f4`
  in the King's Gambit, the move that defines the opening is kept. It appears
  in the first chapter and in the `2.Nc3` and `3.Nc3` transpositions.

Other notable checks, scores in pawns from Black's side at the end of each line:

| Line | Final score | Notes |
|---|---|---|
| Quiet `6.Be2` setup | 0.0 | `10...d5` is level with `10...Qc7` and `10...a5`. |
| Yugoslav, `9.O-O-O d5` | +0.2 | `13...Be6` is first choice; after `14.Bxg7`, `Kxg7` is the only recapture. |
| `7.Qd2 Ng4 8.Bf4 Bxd4 9.Qxd4 e5` | +2.4 | `7...O-O` is about 0.2 worse than `7...Ng4` at depth 22. |
| Rook offer, `13...Qc7 14.Qxa8 Bf5 15.Qxf8+ Kxf8` | +0.8 | Queen against two rooks and a pawn; `15...Bxf8` is about −0.2. |
| `6.Bg5 … 8.Be3 Ng4 9.Bf4 e5 10.h3 exd4 11.hxg4 dxc3` | +4.0 | After `12.bxc3`, Black is a knight up for a pawn; `12.Qxc3?? Bxc3+` wins the queen, and `12.Qxd6 Qxd6` keeps the extra knight (+4.6). |
| `8.Bf4 e5` | +2.2 | The fork wins material. |
| `3.c3 Nf6 4.d4 Nxe4 5.dxc5 Nxc5` | +1.0 | Black keeps the extra pawn. |
| Smith-Morra, `7...Nf6` | +0.1 | After `8.Qe2`, `8...Be7`, `8...Bd7` and `8...a6` are about equal. |

Summary advice that goes beyond the taught moves is checked too: `11.e5 Ng4`
in the quiet line (`11...Nd7` is about 0.5 worse), `10.exd5 Nxd5` after
`7.Be3 … 9...d5`, `6.exd5 exd5` after `4.Ng5 e6 5.d3 d5`, and `8.Nd5 Nxd5` in the
third-move chapter.

### Names and codes

The opening, variation names and ECO codes follow the
[Wikipedia article on the Dragon](https://en.wikipedia.org/wiki/Sicilian_Defence,_Dragon_Variation)
(B70 to B79, including B76 for the Yugoslav Attack with `7...O-O` and B77 for
`9.Bc4`) and its sources. The article also records that Fyodor Dus-Chotimirsky, in his 1953 autobiography, said he
named the variation in 1901 after the constellation Draco (Edward Winter's
earliest printed use is from 1914), and that `9...d5` is
Black's usual reply to `9.O-O-O`. The other names are standard: Alapin
Variation (`2.c3`, B22), Smith-Morra Gambit (`2.d4 cxd4 3.c3`, B21), Moscow
Variation (`3.Bb5+`, B51 to B52). The quiet `6.Be2` line castles both sides
before `8.Be3 Nc6`, reaching the position of `6.Be3 Bg7 7.Be2 Nc6 8.O-O O-O`,
which is B73 (the Classical Variation with `8.O-O`; only `9.Nb3` is B74).

### Verification

The course validator checks full move histories, connected steps, branch
anchors and rehearsal lines with python-chess. `test_dragon_claims.py` checks
the board facts behind each explanation: attacks, pins, defenders, forks,
material counts and the two transpositions back to the Dragon. The course
journey tests walk every chapter and side trip, and the browser spec walks all
five chapters on desktop and mobile.

## Vienna Gambit

`vienna-gambit`, revision `2026-10-v2`, is an original Fieldwork course for
White. It teaches a bounded selection of lines, not a complete repertoire or a
promise that the gambit gives White an advantage. Explanations, prompts,
feedback and position annotations are original. The course has no historical
game excerpts: no game score was verified well enough to include.

### Curriculum and research decisions

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

### Opponent replies (Maia-3)

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

### Engine check

Every White move in a lesson, side trip or recall line is checked with
Stockfish 18 at depth 20; every lesson move lies on one of the 19 recall lines.
Each taught move is the engine's first choice or within 0.3 pawns of it, with
one documented exception:

- **`3.f4`, the gambit move itself,** trails `3.Nf3` by about 0.4 at depth 20
  and 22 (about −0.2 for White against +0.2). As with `2.f4` in the King's
  Gambit, the move that defines the opening is kept.

`2.Nc3` trails `2.Nf3` by about 0.2, and `3.Bc4` against `2...Nc6` trails
`3.Nf3` by about 0.1. Against `2...Nc6`, `3.f4` is about 0.8 worse than the
best move, so the course develops first. In the `4...Qe7` side trip, `6.d4` is
the engine's first choice, up to about 0.45 ahead of
`6.Nf3` at depths 18 to 26 and sometimes nearly level.

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

### Names and codes

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
A line's code is the code of the deepest classified position it reaches, as
game databases classify it. The two `2...Nc6` lines that continue with `Nf3`
transpose into the Italian Game with `Nc3` (`3.Bc4 Bc5 4.Nc3 Nf6` or
`4.d3 Nf6 5.Nc3`), so they carry C50, the code both the
[ECO list](https://en.wikipedia.org/wiki/List_of_chess_openings) and Lichess's
opening file give those positions. The `4.d3 Bb4` line keeps C28: after `5.Nf3`
no classified position follows the Vienna one.

### Verification

The course validator checks full move histories, connected steps, branch
anchors and rehearsal lines with python-chess. `test_vienna_claims.py` checks
the board facts behind each explanation: checks, discovered checks, pins,
relative pins against the queen, forks, material counts and the transposition
back to the `3...d5` main line. It also checks that after `14.Nf7+` every legal
reply is a king move and the knight still attacks the queen and the rook. The
course journey tests walk every chapter and side trip, and the browser spec
walks all four chapters on desktop and mobile.

## Tactics

`tactics-foundations`, revision `2026-10-v1`, is an original Fieldwork course for
White on six basic tactical patterns. Unlike the opening courses it has no recall
lines, so nothing from it enters Due. Explanations, prompts, hints and feedback
are original. Of its 18 example positions, 15 were composed for this course, two
are well-known opening traps and one comes from a historical game.

### Curriculum and research decisions

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

The texts say that a check can be blocked or the checking piece captured, not
that the king must move, and that a pinned piece cannot leave its line without
exposing the piece behind it. In the pawn fork, Black ends with an extra piece
for two pawns, one point ahead.

#### Chapter boundaries

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

### Named positions and sources

- **Caro-Kann trap:** `1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Qe2 Ngf6 6.Nd6#`.
  The lesson claims only the moves, the pinned e7-pawn and the mate; tests assert
  the pin and the mate.
- **Petrov trap:** `1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4 4.Qe2 Nf6 5.Nc6+`. The feedback
  names 4...Qe7 as Black's correct reply; Stockfish 17.1 at depth 20 ranks it
  first (White +0.56), ahead of 4...d6 (+1.45). 3...Nxe4 is already dubious;
  Black's usual move is 3...d6 ([Wikipedia](https://en.wikipedia.org/wiki/Petrov%27s_Defence)).
- **Réti–Tartakower, Vienna 1910:** score and publication history from Edward
  Winter, [Réti v Tartakower](https://www.chesshistory.com/winter/extra/retitartakower.html).
  Georg Marco published the game in the *Neues Wiener Tagblatt* on 1 April 1910
  with the finish `10 Bg5+ Resigns`, as did Bachmann's 1911 *Schachjahrbuch*.
  Tartakower later called it a casual game (*Freipartie*). The commonly given
  finish `10...Kc7 11.Bd8#` (Tartakower, *A Breviary of Chess*) is a
  continuation, not part of the earliest published score; the lesson says so
  when it plays it. `10...Ke8 11.Rd8#` is the other mate, which the feedback
  mentions. The example
  starts after `8...Nxe4` and demonstrates `9.Qd8+ Kxd8`.

The 15 composed positions have no source. Their FENs are in the course file,
`backend/trainer/study_lessons/courses/tactics-foundations.json`.

### Engine verification

Every decision is checked with Stockfish 17.1, MultiPV over all legal moves.
Mates and board claims are asserted exactly with python-chess in
`backend/tests/test_tactics_course.py`.

Every taught move, including each follow-up capture, is Stockfish's first choice
or within about 20 centipawns of it. The two near-ties are a pinned knight that cannot
escape (after `d5 Ke7`, h4 and dxe6 score the same) and a second queen win
(Rb5+ beside Bxh7 in the diagonal skewer). A decision accepts only the taught
move; another winning move gets the player's standard "different continuation"
message. Prompts rule out a second answer where one exists: the double-check
prompt asks for the square where the bishop also guards e7, because Ba5+ is a
double check too (and loses); the Caro-Kann prompt asks for checkmate, because
Nxf6+ also checks; the Petrov prompt asks for a knight move that attacks the
queen where the king cannot take it, because Ng6+ also attacks something
valuable.

Every scripted reply is within 40 centipawns of Stockfish's best defense, is
mated just as quickly, or is named below with its gap:

- **Pinned knight:** the reply is Stockfish's ...Ke7, which defends the knight
  but keeps the pin.
- **Only defender:** ...bxc6 is the natural recapture (−5.25); ...Bf6, which
  saves the bishop (−4.86), is better. The feedback names it and says the knight
  is still won.
- **Réti–Tartakower:** ...Kc7 and ...Ke8 are both mated next move; the feedback
  gives the other mate.
- **Pawn fork:** ...Nd7 is within about 35 centipawns of the best reply.
- **Rank skewer:** every king move loses the rook and the game; Stockfish
  prefers ...Kc6 to the scripted ...Kd6, which loses faster.
- **Chased guard:** ...Rfe8 is about a pawn worse than ...g6 (+5.84 against
  +4.89 at depth 24); the feedback names ...g6 as the tougher defense.

### Separate starting positions

Tactics examples start from unrelated positions. An explanation step may
begin a separate example from a different starting position (initial FEN): the
board changes without move playback, and Back returns to the previous example.
Within one starting position every transition must still continue the existing
history, and a branch, decision or demonstration cannot change the starting
position.

### Remaining boundaries

- Every example is White to move; there are no defensive tactics.
- Each decision has one accepted answer.
- The course appears under Study → Lessons → Fundamentals with the fundamentals course, apart
  from the opening courses.

## Fundamentals

`chess-fundamentals`, revision `2026-10-v1`, is an original Fieldwork course for
White on six basic skills a new player needs before opening repertoires and
tactics pay off. Like the tactics course it has no recall lines, so nothing from
it enters Due. Explanations, prompts, hints and feedback are original. Of its 12
example positions, eight were composed for this course; four start from common
openings (two Italian Game positions, Scholar's mate and the Scandinavian
Defense).

### Curriculum and research decisions

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

#### Chapter boundaries

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

### Named positions and sources

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

The eight composed positions have no source. Their FENs are in the course file,
`backend/trainer/study_lessons/courses/chess-fundamentals.json`.

### Engine verification

Every decision is checked with Stockfish 17.1, MultiPV over all legal moves.
Board claims, mates and the stalemate are asserted exactly with python-chess in
`backend/tests/test_fundamentals_course.py`.

Every taught move except O-O in the Italian castling position is Stockfish's
first choice. There Bxf7+ scores a little higher (about +0.9 against +0.8);
the prompt asks for castling, and O-O is
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

### Explanation details

- *Material*, *develop* and the eighth rank are explained where they first
  appear. A series of captures on one square is a *trade*, because chapter 1
  uses *the exchange* for a rook against a bishop or knight.
- **Scholar's mate** is called a trap, not an opening. ...g6 is safe only when
  the e5-pawn is defended (after 2.Qh5 g6?? Qxe5+ wins the h8-rook), and after
  ...g6, Qf3 aims at f7 again; ...Nf6 blocks it.
- **Castling:** a rook and a pawn for a knight and a bishop is 6 points for 6, so
  the feedback says why it is still a bad trade (Stockfish about −2.9 for Black
  after ...Nxf2 Rxf2 Bxf2+ Kxf2).
- **Stalemate:** the warning covers every move that is not a check, not only
  queen moves; from `7k/8/4Q3/6K1/8/8/8/8 w`, the king move Kg6 is stalemate.
- **The square:** after ...b3 the king on e4 is outside the smaller square, so
  the step asks the king to step into it.
- **Rook pawns:** the summary warns that the king-in-front method often fails
  with an a- or h-pawn. Syzygy scores `6k1/8/6K1/7P/8/8/8/8 b` as a draw and the
  same position with a g-pawn as a White win.

### Tablebase verification

The two pawn endings and both mates are checked exactly with Syzygy endgame
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

### Remaining boundaries

- Every example is White to move.
- Each decision has one accepted answer.
- Most of the starter pack's pawn-ending puzzles are rated above 1200, so that
  practice set is harder than the chapter.
- The course appears under Study → Lessons → Fundamentals with the tactics course, apart from
  the opening courses.
