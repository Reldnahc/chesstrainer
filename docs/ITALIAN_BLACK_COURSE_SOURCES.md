# Black Italian: source and authoring record

`italian-black-foundations`, revision `2026-09-v1`, teaches Black through a
bishop-first Italian repertoire. The chapters cover quiet development, the early
c3/d4 central advance, and declining the Evans Gambit. Each ends in independent
rehearsal; only its three designated lines can be enrolled for scheduled recall.
This is a small starter repertoire, not coverage of every White continuation.

All instructions, position notes, hints and feedback are original Fieldwork
writing. Guided decisions identify the move taught in this course rather than
claiming it is the only legal or objectively best move. Historical game scores
illustrate the ideas and remain separate from the chosen recall lines.

## Historical scores

The primary source is Horace F. Cheshire (editor), *The Hastings Chess Tournament
1895*, published in 1896. The factual scores come from the public-domain original
book, not from modern instructional commentary.

| Game | Lesson purpose | Primary source | Complete score endpoint |
| --- | --- | --- | --- |
| Mason–Lasker, 27 August 1895 | Black's quiet development; bishop exchanges change White's pawn structure | [pp. 264–265](https://archive.org/details/cu31924029919820/page/n319/mode/1up) | 82.Kh8, draw; 163 plies |
| Steinitz–von Bardeleben, 17 August 1895 | Black answers c3/d4 with exchanges, Bb4+ and d5 | [pp. 157–158](https://archive.org/details/cu31924029919820/page/n200/mode/1up) | 25.Rxh7+, Black resigned; 49 plies |
| Pollock–Lasker, 13 August 1895 | Declining b4, preserving the bishop and returning to development | [p. 115](https://archive.org/details/cu31924029919820/page/n152/mode/1up) | 23...Ne2+, White resigned; 46 plies |

The first two scores reuse the existing validated transcriptions, with their own
Black-side annotations. They do not alter the White Italian course or its saved
revision. The [original Italian source record](ITALIAN_COURSE_SOURCES.md) records
their source differences and reuse provenance. The original book's
[Commons record](https://commons.wikimedia.org/wiki/File:The_Hastings_chess_tournament_1895._Containing_the_authorised_account_of_the_230_games_played_Aug.-Sept._1895_(IA_cu31924029919820).pdf)
documents the public-domain status and applies Public Domain Mark 1.0.

Pollock–Lasker was checked visually against printed page 115 (PDF page 153,
zero-based scan leaf 152) in the same cached primary scan. Its complete factual
score agrees with the [IRLchess transcription](https://www.irlchess.com/hastings1895_allfiles/games_hastings1895/g72.htm),
used only as a secondary cross-check. No Tarrasch annotation or other source prose
is reproduced. The score ends with the recorded check and resignation; it does
not invent a played mating continuation.

## Teaching choices and limits

- **Quiet Italian:** `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 Nf6 5.O-O d6
  6.c3 O-O`. The decisions teach development, mutual e-pawn support and castling.
  The course does not imply Nf6 wins the defended e4-pawn.
- **Early central advance:** `4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Bd2 Bxd2+
  8.Nbxd2 d5 9.exd5 Nxd5 10.O-O O-O`. The supported claims are concrete: the
  bishop check and exchange, the d5-pawn's attacks on c4/e4, equal material after
  recapture, and both kings castling. The historical excerpt uses the distinct
  `7.Nc3` reply instead. Its pin, ensuing piece placement and later Black loss
  are explicitly a contrast, not a recommendation to memorize that game.
- **Evans Declined:** `4.b4 Bb6 5.c3 d6 6.a4 a6 7.a5 Ba7 8.d3 Nf6
  9.O-O O-O`. This is a deliberately quiet study selection. It trades time and
  queenside space for keeping the bishop without accepting the offered pawn;
  it is not described as a refutation of the gambit. The returnable branch shows
  Pollock's historical `8.b5 axb5 9.Bxb5 Nf6 10.a6 O-O` as a contrasting choice.

The quiet Evans continuation is authored teaching material, not attributed to
Pollock–Lasker. The central chapter branches from the source game's opening at
White's seventh move; only the designated short line is enrolled. Opening codes
identify these selected lines; they are not grading evidence.

## Checks

The production content validator replays every full source game, repertoire line,
decision reply and transition, preserving exact histories and branch anchors.
`backend/tests/test_italian_black_claims.py` checks the specific supports, attacks,
bishop exchange, historical pin, material balance, castling, retreat safety, source annotation plies and
final recorded fork. It also verifies that changing Black-course annotations in
one returned object cannot mutate the original White course.

The shared bundled-course journey and native authoring checks cover these new
chapters through the existing player and bounded Stockfish audit. Those searches
are authoring checks only: opening a lesson never downloads content or starts an
engine job, and engine preferences do not rewrite the authored answer contract.
