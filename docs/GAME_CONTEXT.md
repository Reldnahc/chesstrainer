# Game context and supported relationships

`game-context-1` is a deterministic projection over the actual PGN and the current
effective Stockfish reports. Detail and revision polling share one presentation
function. The API returns a `context` containing one node per validated reviewed
ply, evidence references, missing plies, relationships, candidate turning points
and an input digest. It is derived, not stored prose or pretend conversation
memory. Reopening or changing coach needs no engine work. Refined reports replace
their baseline generation before this graph is built.

Relations are deliberately narrower than an unrestricted chess story:

| Relation | Evidence gate |
| --- | --- |
| Punishment | Adjacent actual moves; previous concession of 100 cp or a mate transition; a searched advantage/equalizing opportunity; next move either keeps that opportunity with less than 50 cp concession or loses its advantage/playable band. Partially using an opportunity is not called wholly missed. |
| Recovery | Same player's earlier error left a searched disadvantage/forced loss; a later near-best move restores at least a playable score. Intervening opponent errors are recorded, so dialogue cannot claim the recovering player created all the improvement. |
| Repeated motif | Same responsible player, supported tactical motif and role on different reviewed plies. Duplicate detectors do not inflate the count; a best-line alternative is excluded. Counts are explicitly among observed reviewed plies. |
| Advantage run | At least six contiguous reviewed plies stay at 200 cp or searched mate for one side. A completed review ending in that side's recorded win adds a conversion observation. This does not mean flawless play or a mathematically proved win. |
| Erosion | At least three 30–149 cp concessions by one side in a nine-ply window, with at least 150 cp net deterioration. Opponent errors that restore the position defeat the net-deterioration claim. |
| Support restored | A concrete surviving piece loses effective support and later regains it. Track its moves; captures, castling ambiguity, missing review or changed actor break the link. This says nothing about why an eventual tactic worked. |

Contiguous score relationships stop at missing plies, invalid mainline contexts,
or adjacent searches disagreeing by more than 100 cp / on mate outcome. We do not
smooth disagreeing engine values into a fabricated consistent story. Repeated
observed motifs can still be linked across a gap, with their limited scope noted.

The four candidate turning points prioritize newly lost/allowed searched mates,
then largest per-move centipawn concessions, then earliest ply. Mate is not given
a fake centipawn value. `biggest_swing_ply` means largest **reviewed concession
under this ordering**, not a guarantee of the game's deepest causal moment.
Partial reviews and searched-advantage limits accompany the graph.

Recorded game results are distinguished from board-proven endings. A result
contradicting an automatic board ending cannot support conversion. Resignation,
timeout and draw agreement are not invented from a bare result header.

The graph contains no coach-specific text, additional model query or new table.
It remains two-sided; learner-specific relationship selection happens in the
[dialogue boundary](COACH_DIALOGUE.md), using the saved game's learner color,
not the selected mover or the board's temporary display orientation.
`test_game_context.py` covers multi-ply positive/negative stories and identity;
native review tests check detail/poll agreement and restart reuse. Later dialogue
can cite these links; current cold SRS never receives them.

The adjacent `history` projection uses [CROSS_GAME_CONTEXT.md](CROSS_GAME_CONTEXT.md)
to link relevant learner errors to supported evidence in other owned games.
It remains separate from within-game relationships and never claims training
caused improvement.
