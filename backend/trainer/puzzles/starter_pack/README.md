# Lichess starter puzzle pack

`puzzles.csv` holds 940 rows copied unmodified from the public
[Lichess puzzle database](https://database.lichess.org/#puzzles), which the
Lichess contributors release under CC0-1.0; the complete dedication is in
COPYING.txt. `manifest.json` pins the file by SHA-256 and records exactly how
the rows were chosen (`build`): the input dataset hash, the seeded reservoir per
rating band, and the popularity, play-count, rating-deviation and length filters.

The selection is weighted toward lower ratings (35% under 1000, 30% from 1000
to 1400, 20% from 1400 to 1800, 15% from 1800 to 2400) with a solver line of at
most nine plies, so a beginning player meets mostly approachable puzzles while
harder ones remain available through the difficulty filter. Themes, ratings and
puzzle links are Lichess's own; Fieldwork adds no claim about pedagogical
quality. Its uniqueness claim is the engine check below.

`manifest.json` also carries `verification`. The sampled 1,000 rows were first
checked on 2026-10-02 (`previous`): 28 had a second equally short mate or a
near-equal alternative and were pruned. On 2026-10-15 the remaining 972 were
re-checked under the current rule with `scripts/verify_puzzle_pack.py`
(Stockfish 18, depth 18; solution within 50 cp of best, every alternative at
least 100 cp worse, under +200 cp and not a mate of any length, also when the
solution mates; final payoff at least 150 cp or mate), twice: multi-threaded and
single-threaded, because search varies near the +200 cp line. The puzzles either
run failed were rechecked single-threaded at depth 22, the close ones at depth
28, and every kept puzzle that a depth-20 run failed or left near a threshold
was rechecked at depth 26 to 28 (`deep_check`). Three depth-18 failures were
cleared there and kept; six puzzles that passed at depth 18 had a second winning
move and were removed. The 32 listed under `removed` each have a second move
that still wins by more than two pawns, which this player, accepting only the
stored move, would mark wrong. No rival mate was found. 940 remain.

`trainer.puzzles.packs` validates the hash and every row once per process. A
pack is served whole or not at all. To rebuild or enlarge the selection, run
`scripts/build_puzzle_pack.py` against a downloaded dataset with a new
`--version`; existing saved solves keep their own immutable snapshots. A larger
installed pack uses the same layout through `PUZZLE_PACK_PATH`.
