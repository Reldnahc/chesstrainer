# Source and license notices

Fieldwork's original source is licensed under GPL-3.0-or-later; see LICENSE.
The pinned Lichess puzzler source in backend/trainer/_vendor/lichess_puzzler is
licensed under AGPL-3.0; its complete license and provenance are in that directory.
Existing Fieldwork source keeps its original license. The combined application
also carries the applicable AGPL obligations, including the network source offer.
Other dependencies retain their own licenses; Stockfish is installed separately.

The recorded audio candidates under `frontend/src/audio/assets` derive from
CC0-1.0 recordings by el_boss, simone_ds, taure, zachrau, Err0rC0de, chiller345,
hollandm and Sassaby (Freesound), and
Pierre SIBANARCO and Joseph SARDIN (BigSoundBank). Those assets retain CC0;
Fieldwork's source-code license does not replace their public-domain dedication.
The directory includes the complete CC0 text and per-file sources, hashes and
editing notes in `sources.json` and its README. No Chess.com sound assets are used.

The optional human-move adapter and developer benchmarks use CSSLab's AGPL-3.0 inference primitives at
[1e13597c42d4858b7cfd7cfdae01e297263364b2](https://github.com/CSSLab/maia3/tree/1e13597c42d4858b7cfd7cfdae01e297263364b2).
Unmodified model, tokenizer and move-vocabulary source and the complete license
are included in `backend/trainer/_vendor/maia3`. Fieldwork's separate adapter adds
policy-only inference, process isolation and integrity/contract validation. Neural
weights are not committed or bundled in the image. Explicit setup uses
the 79M card's explicit AGPLv3 declaration; smaller cards need weight-term
clarification. Exact hashes, source links and measured installation implications
are recorded in [MAIA_FEASIBILITY.md](docs/MAIA_FEASIBILITY.md).

The optional CPU inference runtime uses PyTorch 2.8.0+cpu and NumPy 2.2.6,
distributed under their upstream BSD-style terms. Their wheels retain their
complete license and bundled third-party notices in `torch-2.8.0+cpu.dist-info/LICENSE`
and `numpy-2.2.6.dist-info/LICENSE.txt` inside the installed Python environment.
`requirements-human-cpu.lock` pins the runtime dependencies; Fieldwork does not
replace their license notices with the application's GPL/AGPL notice.

The Lichess tagger is pinned to commit
8d9faff694ba3a8598abc5465347209af3f90a82. Local changes adapt package imports,
remove global logging configuration and add observer calls at successful motif
return sites. Predicate conditions are preserved. See docs/LICHESS_REUSE.md.

The accuracy calculation in backend/trainer/_vendor/lichess_accuracy is a Python
port of Lichess lila revision 2e653ad1e2b9fad31b4a092394019ef8fafdedb8 (AGPL-3.0),
with evaluation and arithmetic helpers from scalachess 17.8.2 and scalalib 11.8.8
(MIT). That directory includes all three complete licenses, pinned source links,
authorship, and local modifications.

The unmodified opening catalogue in backend/trainer/_vendor/lichess_openings
is from lichess-org/chess-openings revision c67912be581f0793dbaa776be5ccf111e01f88d9,
released under CC0-1.0. That directory includes the complete dedication,
upstream attribution and original file hashes.

Settings provides a Download source code link to a snapshot served from the same
host at /assets/fieldwork-source.zip. The frontend build prepares that snapshot
from Git-listed public source files, including licenses and build instructions.
It excludes environment secrets, databases, games in data, dependencies and
untracked files. Regenerate the frontend/source archive after source changes;
stage new public source files before building. Never track private information.

Exported snapshots include SOURCE_SNAPSHOT.json with file hashes and can rebuild
the source download without Git. Forks and redistributed combined versions must
preserve notices and provide their corresponding source, including modifications.
