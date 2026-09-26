# Source and license notices

Fieldwork's original source is licensed under GPL-3.0-or-later; see LICENSE.
The pinned Lichess puzzler source in backend/trainer/_vendor/lichess_puzzler is
licensed under AGPL-3.0; its complete license and provenance are in that directory.
Existing Fieldwork source keeps its original license. The combined application
also carries the applicable AGPL obligations, including the network source offer.
Other dependencies retain their own licenses; Stockfish is installed separately.

The Lichess tagger is pinned to commit
8d9faff694ba3a8598abc5465347209af3f90a82. Local changes adapt package imports,
remove global logging configuration and add observer calls at successful motif
return sites. Predicate conditions are preserved. See docs/LICHESS_REUSE.md.

The accuracy calculation in backend/trainer/_vendor/lichess_accuracy is a Python
port of Lichess lila revision 2e653ad1e2b9fad31b4a092394019ef8fafdedb8 (AGPL-3.0),
with evaluation and arithmetic helpers from scalachess 17.8.2 and scalalib 11.8.8
(MIT). That directory includes all three complete licenses, pinned source links,
authorship, and local modifications.

Settings provides a Download source code link to a snapshot served from the same
host at /assets/fieldwork-source.zip. The frontend build prepares that snapshot
from Git-listed public source files, including licenses and build instructions.
It excludes environment secrets, databases, games in data, dependencies and
untracked files. Regenerate the frontend/source archive after source changes;
stage new public source files before building. Never track private information.

Exported snapshots include SOURCE_SNAPSHOT.json with file hashes and can rebuild
the source download without Git. Forks and redistributed combined versions must
preserve notices and provide their corresponding source, including modifications.
