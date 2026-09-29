# Italian Game pilot: source record

The pilot teaches White's Italian Game through three contrasting historical games. Only their factual move scores were transcribed. All Fieldwork instructional explanations, decisions, highlights, and repertoire selections are original writing; no modern game annotations are reproduced.

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
| Wilhelm Steinitz–Curt von Bardeleben, 17 August 1895 | Prepare an immediate central opening with 4.c3 and 5.d4 | [157–158](https://archive.org/details/cu31924029919820/page/n200/mode/1up) | 25.Rxh7+, Black resigned; 49 plies |
| William H. K. Pollock–Emanuel Schiffers, 2 September 1895 | Black's Two Knights development and central counterplay require a different response | [330](https://archive.org/details/cu31924029919820/page/n391/mode/1up) | 44...a2, White resigned; 88 plies |

The historical games illustrate choices and consequences. Their complete continuations are examples, not automatically enrolled repertoire or a claim that every move was best. Pollock's loss is explicitly a warning example. Lesson excerpts need not require learners to memorize the later middlegame or endgame.

## Transcription checks and differences

The named printed pages were visually inspected in the primary scan. Every move in all three complete scores is legal under python-chess; the course content model also validates the full histories when loading. SAN is retained in `backend/trainer/study_lessons/courses/italian_games.py` as a readable transcription and converted to UCI through python-chess.

[IRLchess's Hastings collection](https://www.irlchess.com/hastings1895_allfiles/openings_hastings1895.html), which cites the tournament book, was used as a secondary cross-check. Differences were resolved against the primary scan:

- **Mason–Lasker:** the book plays 8...c6 and 10...O-O. Some modern scores exchange those moves, reaching the same position after move 10. Fieldwork follows the printed order, so source-game histories and excerpt anchors remain exact.
- **Pollock–Schiffers:** the primary book includes 44...a2 before “White resigns.” The IRLchess PGN ends after 44.h6. Fieldwork includes the final legal black move recorded on printed page 330.
- **Steinitz–von Bardeleben:** the actual score ends at 25.Rxh7+ and resignation. The book subsequently prints an illustrative mate continuation; that analysis is not included as played moves.

The primary book calls Steinitz “W. Steinitz.” Modern catalogues may use William or Wilhelm; Fieldwork displays the surname and does not infer additional biography from the score.
