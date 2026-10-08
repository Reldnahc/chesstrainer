# White Italian Game: curriculum and source record

Revision `2026-10-v3` teaches a connected quiet White setup, its remaining development, and an actual central break. Historical games provide explicitly contrasting examples rather than substitutes for the repertoire's missing plans. Only their factual move scores were transcribed. All Fieldwork instructional explanations, decisions, highlights, and repertoire selections are original writing; no modern game annotations are reproduced.

## Why these chapter boundaries

Chapter count follows the learning problems, not a template. The original separate Two Knights chapter repeated the same endpoint as the first chapter. It is now an optional move-order branch: `...Nf6` requires accounting for e4, and the selected `...Bc5` then transposes. The course explicitly does **not** claim every Two Knights setup transposes; `...Be7` and sharper White alternatives are outside this starter repertoire.

| Chapter | Learner outcome | Scope decision |
| --- | --- | --- |
| Build the quiet setup | Explain development, e4 support and king safety; recognize the selected Two Knights transposition | Four required decisions, one optional decision. Condenses the duplicate chapter; Pollock's different `d4/Ng5` game remains an optional contrast. |
| Give every piece a job | Connect `c3`, `Re1`, `Bb3`, `Nbd2–f1` and `Be3/Nxe3` to a working position | Seven required decisions. Keep the sequence together because moving the rook and knight creates the later bishop development and recapture. Optional branches practise a bishop escape and punish premature `...d5`; neither interrupts the main path. |
| Choose when to open the center | Play `d4`, choose the exchange order, rebuild the center and finish development; recognize Black's active counterstrike | Five required decisions and two optional decisions. The good `...d5` response is compared at the exact position where it diverges, rather than taught as another long opening line. |

There are 54 teaching steps and 23 decisions including optional branches. These are consequences of the selected teaching objectives, not a minimum size for future courses. Later rehearsals begin at their chapter's shared position, retaining full legal history, so the lesson player does not repeatedly ask for the initial setup. Optional Due enrollment still uses the existing full-line opening-study behavior and position deduplication.

## Instructional research and scope

- **Sverre Johnsen, *How to Beat the Open Games* (Gambit, 2018), pp. 80–83**, [publisher/distributor sample](https://www.newinchess.com/media/wysiwyg/product_pdf/7805.pdf). The quiet Italian discussion emphasizes patterns and manoeuvres across many playable move orders, including rook placement, bishop exchanges and knight routes. This supports teaching decisions rather than presenting one fixed sequence as universal.
- **Martyn Kravtsiv, *PCO: Practical Chess Openings* (Gambit), pp. 83–85**, [sample](https://www.newinchess.com/media/wysiwyg/product_pdf/89017.pdf). The sample discusses `Bb3–c2`, `Nbd2–f1`, bishop exchanges and Black's prepared `...d5`. It also explains that active Black counterplay remains after sensible White development. Fieldwork's selected continuations are independently checked; the course is not a transcription of this book's repertoire.
- **Alexander Kalinin and Nikolai Kalinichenko, *The Modernized Italian Game for White* (Thinkers Publishing, 2021)**, [authorized sample](https://www.scacco.it/data/attachments/10102/modernized-italian-game.pdf), contents and foreword. The authors distinguish central expansion, bishop pursuit/exchanges and Black's `...d5` as separate strategic problems. This informed the coverage review, not a claim to teach all of the book's themes or its full analysis.

These contemporary sources retain their own copyright. Their published samples were consulted to check instructional priorities; Fieldwork's wording and exercises are original. The public-domain score provenance below applies only to the historical tournament book.

## Concrete claims and authoring checks

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

`backend/tests/test_italian_white_claims.py` checks these relationships against production step positions, including the negative cases. Native authoring analysis checked both sides' selected continuations, with deeper comparisons for the two `...d5` cases and the exchange-order decision. Current verification commands and results are recorded in [verification history](VERIFICATION.md). Bounded engine checks support the chosen examples; they do not certify an exhaustive repertoire or every historical move as best.

Revision `2026-09-v1` sessions and enrolled studies keep their saved snapshots. The new chapter graph and longer lines are published only under `2026-09-v2`.

Revision `2026-10-v3` changes wording only, after the [October 2026 chess check](VERIFICATION.md#opening-course-chess-check--october-8-2026). The Mason–Lasker note now says each side has developed one bishop; White's c1-bishop is still at home. The Steinitz comparison now names the real difference from our setup: we supported e4 and castled before d4. Steinitz also prepared a c-pawn recapture, so that was not the difference. Moves, chapters and recall lines are unchanged, and earlier sessions and enrolled studies keep their snapshots.

## Primary publication and reuse

Horace F. Cheshire (editor), *The Hastings Chess Tournament 1895: Containing the authorised account of the 230 games played Aug.–Sept. 1895*, published in 1896 by G. P. Putnam's Sons / Chatto & Windus.

- [Internet Archive primary scan](https://archive.org/details/cu31924029919820)
- [Original PDF](https://archive.org/download/cu31924029919820/cu31924029919820.pdf)
- [Wikimedia Commons provenance and public-domain declaration](https://commons.wikimedia.org/wiki/File:The_Hastings_chess_tournament_1895._Containing_the_authorised_account_of_the_230_games_played_Aug.-Sept._1895_(IA_cu31924029919820).pdf)

The Commons file record identifies the original book as public domain in its country of origin and jurisdictions with a term of life plus 100 years or fewer, and in the United States because of its publication date. It applies [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/). The historical book is the source of the bundled scores, not the licensing terms of a modern database or modern commentary.

## Included scores

| Game | Purpose | Printed pages | Complete recorded score |
| --- | --- | --- | --- |
| James Mason–Emanuel Lasker, 27 August 1895 | Quiet development with 4.d3; exchanges change the pawn structure | [264–265](https://archive.org/details/cu31924029919820/page/n319/mode/1up) | 82.Kh8, drawn; 163 plies |
| Wilhelm Steinitz–Curt von Bardeleben, 17 August 1895 | Prepare an immediate central opening with 4.c3 and 5.d4 | [157–158](https://archive.org/details/cu31924029919820/page/n200/mode/1up) | 25.Rxh7+, White won (see below); 49 plies |
| William H. K. Pollock–Emanuel Schiffers, 2 September 1895 | Black's Two Knights development and central counterplay require a different response | [330](https://archive.org/details/cu31924029919820/page/n391/mode/1up) | 44...a2, White resigned; 88 plies |

The historical games illustrate choices and consequences. Their complete continuations are examples, not automatically enrolled repertoire or a claim that every move was best. Pollock's loss is explicitly a warning example. Lesson excerpts need not require learners to memorize the later middlegame or endgame.

## Transcription checks and differences

The named printed pages were visually inspected in the primary scan. Every move in all three complete scores is legal under python-chess; the course content model also validates the full histories when loading. SAN is retained in `backend/trainer/study_lessons/courses/italian_games.py` as a readable transcription and converted to UCI through python-chess.

[IRLchess's Hastings collection](https://www.irlchess.com/hastings1895_allfiles/openings_hastings1895.html), which cites the tournament book, was used as a secondary cross-check. Differences were resolved against the primary scan:

- **Mason–Lasker:** the book plays 8...c6 and 10...O-O. Some modern scores exchange those moves, reaching the same position after move 10. Fieldwork follows the printed order, so source-game histories and excerpt anchors remain exact.
- **Pollock–Schiffers:** the primary book includes 44...a2 before “White resigns.” The IRLchess PGN ends after 44.h6. Fieldwork includes the final legal black move recorded on printed page 330.
- **Steinitz–von Bardeleben:** the actual score ends at 25.Rxh7+. The book prints “Resigns”, but reports from the tournament, collected in [Edward Winter's article](https://chesshistory.com/winter/extra/steinitzvonbardeleben.html), say von Bardeleben left the room without resigning and lost on time. The White course says only that White won; the Black course explains the loss on time. The book subsequently prints an illustrative mate continuation; that analysis is not included as played moves.

The primary book calls Steinitz “W. Steinitz.” Modern catalogues may use William or Wilhelm; Fieldwork displays the surname and does not infer additional biography from the score.
