# Lichess opening catalogue

The five TSV files and COPYING.txt are unmodified files from
[lichess-org/chess-openings](https://github.com/lichess-org/chess-openings/tree/c67912be581f0793dbaa776be5ccf111e01f88d9),
pinned to commit `c67912be581f0793dbaa776be5ccf111e01f88d9`. Upstream authors:
the Lichess contributors. The data is released under CC0-1.0; the complete
dedication is in COPYING.txt. UPSTREAM.json records the original file hashes.

Fieldwork's `opening_book.py` builds a process-local index of the actual
position/move pairs along these lines. Named positions supply coach text.
This catalogue includes unusual and unsound openings: Book means recognized,
not engine-approved. No runtime downloads or engine queries are involved.

To update, retrieve all five TSV files and COPYING.txt from a single pinned
upstream commit, update COMMIT and UPSTREAM.json, and run test_opening_book.py
and the game-review tests. Do not silently track the upstream master branch.
