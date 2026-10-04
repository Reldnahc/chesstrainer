# Positional evidence

`position-facts-1` derives immediate, legal board changes for played and best
candidates. `move-events-2` exposes them as `positional` events. These are facts
about the position, **not explanations inferred from an evaluation drop**.
Stockfish remains responsible for whether either candidate is good. The event
records `value_judgment: not_inferred`, side, before/after values, squares, line
and candidate UCI, with position/rule/search references. Development also
references the PGN history proving the original piece had not moved.

Supported observations:

| Feature | Evidence / limits |
| --- | --- |
| First development | Original knight/bishop leaves its home square, tracked from the standard starting position. Returning home never resets it. Setup games/branches without history abstain. |
| Castling | Legal king/rook relocation and adjacent own pawns; no claim that the resulting king is safe. |
| King flight squares | A pawn move opens an actually legal king destination for a back-rank king on the flank. Checks, castling, attacked squares and non-flank kings abstain. |
| Passed pawns | No enemy pawn ahead on the same or either adjacent file. Track the moving pawn's identity; ordinary advancement does not falsely create a new passer. Captures/en passant/promotion update the sets. |
| Passed-pawn advance | An already passed pawn advances without promotion. No assertion that it can queen. |
| Isolated pawns | No own pawn on either adjacent file, regardless of rank. No assertion that the pawn is weak or lost. |
| Doubled files | Two or more same-color pawns on a file. No automatic good/bad judgment. |
| Rook files | Own pawn absent means semi-open; all pawns absent means open. No guarantee of entry squares or control. |
| Piece support | Existing pin-aware effective-defender geometry gains/loses all support for a surviving non-pawn, non-king piece. An undefended piece is not necessarily capturable or lost. The coach mentions it only when the piece is attacked after the move (`attacked`); otherwise it is trivia (owner decision, 2026-10-04). |
| Bishop pair | Loss of one of exactly two opposite-square-color bishops. Two same-color promoted bishops do not count. No claim that the exchange was unfavorable. |

The current rules deliberately omit bad bishops, backward pawns, outposts, space
advantages, general king-safety judgments and favorable simplification. Geometry
alone is insufficient for those strategic claims. Tactical causality continues
to require the existing verified-line detectors. A fact about a best-move
alternative never impersonates a move actually played in the game.

This layer performs no new search, changes no grading and saves no coach prose.
It is derived from saved report/PGN evidence, so old reviews gain supported facts
without reanalysis. `test_review_positions.py` covers each rule, negative
lookalikes, color symmetry, illegal inputs, branch abstention and invariance to
score/prose changes. Cold SRS still excludes all review-intelligence fields.
