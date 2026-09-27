# PolyForm Perimeter compatibility assessment

Reviewed September 27, 2026 in response to the request to license Fieldwork under
PolyForm Perimeter. **Closed: the owner chose to retain the existing licensing.**
No license change or dependency migration is planned. The existing LICENSE,
package metadata, upstream notices and source offer remain in force. The
assessment below is retained for reference if a transition is reconsidered.

## Requested terms and current combination

The official current text is [PolyForm Perimeter 1.0.1](https://polyformproject.org/licenses/perimeter/1.0.1).
Its Noncompete and Competition sections exclude providing competing products,
including free products marketed as substitutes. This is a use restriction, not
merely a requirement to acknowledge authors or publish modifications.

Fieldwork currently incorporates AGPL code into the backend and imports a GPL
library directly. The checked-in GPL and AGPL texts require licensing covered
combined works as a whole and prohibit further restrictions (sections 5 and 10).
On that basis, the current application is not a compatible candidate for a
Perimeter-only license. This is the assessment of the code and license terms,
not a determination that every separately distributed tool shares one license.
See the [GNU guidance on incorporated code and separate programs](https://www.gnu.org/licenses/gpl-faq.en.html#GPLInProprietarySystem).

## Components requiring a decision

| Component | Evidence in this repository | Consequence for a transition |
|---|---|---|
| Lichess tactical tagger | `backend/trainer/_vendor/lichess_puzzler/` contains copied AGPL source and provenance. `lichess_patterns.py` imports it directly. | Obtain appropriate permission from the upstream rights holders, or replace the implementation and review its adapters/tests for inherited source. It powers tactical recognition and coaching evidence. |
| Lichess accuracy port | `backend/trainer/_vendor/lichess_accuracy/README.md` identifies the AGPL lila translation and separate MIT helpers. `game_accuracy.py` directly calls the port. | Resolve the AGPL implementation through alternative licensing or a properly independent replacement. Translating or mechanically rewriting it does not establish independent authorship. Preserve the MIT notices for any retained helpers. |
| python-chess | `pyproject.toml` pins `python-chess==1.999`; its installed `chess==1.11.2` metadata declares GPL-3.0+. Numerous backend modules import its board, move, PGN and engine APIs. | Obtain alternative permission or replace this integrated dependency. This reaches legal moves, PGN handling, native-engine communication, grading and classification; it is a substantial change. [Upstream license declaration](https://github.com/niklasf/python-chess/blob/master/setup.py). |
| Stockfish | Docker installs a separate executable; `engine.py` starts it through UCI. | Preserve Stockfish's GPL notices and source obligations. Assess this process boundary separately; the inventory does not conclude that Stockfish must be replaced. [Stockfish licensing](https://stockfishchess.org/about/). |
| Opening catalogue, fonts and other libraries | Opening data has CC0 provenance; fonts carry OFL notices; other dependency terms remain separately applicable. | Preserve their terms and finish a dependency/asset audit. Their presence does not authorize relicensing the AGPL/GPL components above. |

Current licensing and integration decisions are recorded in [NOTICE.md](../NOTICE.md),
[LICHESS_REUSE.md](LICHESS_REUSE.md) and [GAME_ACCURACY.md](GAME_ACCURACY.md).

## What would make the change reviewable

1. Choose whether to retain the current GPL/AGPL application or pursue a separate
   migration to Perimeter-compatible code. No feature removal or dependency rewrite
   is authorized by this assessment.
2. For a migration, establish the required rights or replacements for the three
   integrated components above. Review original-code ownership and contributions;
   a Git author list alone is not evidence of rights to upstream material.
3. Preserve chess behavior with legal-move/PGN edge cases, native-engine lifecycle,
   grading, tactical evidence and accuracy regressions. Do not silently degrade the
   review features to achieve a license change.
4. After compatibility and rights are resolved, update LICENSE, NOTICE, Python/npm
   metadata, README, relevant architecture/reuse docs, Settings wording and source
   packaging together. Keep all applicable third-party licenses and notices.

Moving files to a vendor directory, adding an exclusion paragraph, or placing
closely integrated code behind a thin wrapper does not itself settle the combined
work issue. Adding Perimeter as an optional alternative would also leave the GPL
route available, so it would not establish an effective project-wide noncompete
restriction. [GNU explanation of wrappers](https://www.gnu.org/licenses/gpl-faq.en.html#GPLWrapper).

Previously distributed GPL versions keep the rights already granted to recipients;
a prospective license change cannot withdraw those permissions while its conditions
are met (LICENSE section 2).

This document records a compatibility blocker, not a new license grant or a claim
that the repository has already moved to PolyForm Perimeter.
