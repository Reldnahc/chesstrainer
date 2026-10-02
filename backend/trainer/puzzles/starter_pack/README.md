# Lichess starter puzzle pack

`puzzles.csv` holds 972 rows copied unmodified from the public
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
quality or uniqueness beyond legal replay of every line.

`manifest.json` also carries `verification`: the sampled 1,000 rows were checked
with `scripts/verify_puzzle_pack.py` (Stockfish 18, depth 18; solution within
50 cp of best, alternatives at least 100 cp worse, final payoff at least 150 cp
or mate). 972 passed; the 28 listed under `removed` had a second equally short
mate or a near-equal alternative, which this player would wrongly mark as
failures, and were pruned before pinning the hash.

`trainer.puzzles.packs` validates the hash and every row once per process. A
pack is served whole or not at all. To rebuild or enlarge the selection, run
`scripts/build_puzzle_pack.py` against a downloaded dataset with a new
`--version`; existing saved solves keep their own immutable snapshots. A larger
installed pack uses the same layout through `PUZZLE_PACK_PATH`.
