# Game narrative and review completion

`game-narrative-1` selects a concise story from the current versioned game context.
It returns factual slots, not character prose: opening/departure, largest reviewed
concession, a supported strong find, difficult find, missed opportunity, narrow
defense, recovery, repeated issue, conversion, gradual erosion and conclusion.
Unsupported slots are omitted rather than padded with generic strategic claims.

Each moment carries supporting plies, semantic-event/relationship IDs and direct
PGN/book/board references where needed. The narrative digest includes the context
generation and selected facts. Refresh, process restart and changing coach do not
rewrite chess history. An incomplete review has no completion/conversion claim.

Selection favors mate transitions, major concessions and concrete strong moves;
rarity alone does not make a strong find. A difficult alternative is never credited
to the played move. Opening recognition does not imply objective quality. The
conclusion prefers python-chess automatic endings; a bare PGN result supplies
only the recorded winner/draw, without inventing resignation, timeout or agreement.

Completed reviews show a compact summary beneath the evaluation graph, with up
to four distinct move jumps and an expandable game story. Quiet/very short games
can have fewer meaningful moments. Move quality and accuracy remain available
in their existing disclosure. At the initial board the coach acknowledges the
completed review; completing in the background never replaces a selected move's
reaction or changes the board. Pause/partial review never claims completion.

Frontend wording is currently neutral. The following dialogue milestone owns
the richer shared utterance contract; saved narrative facts are independent of
that wording and all coach preferences. No new database table or engine/model
query is needed to produce the story.

Validation includes narrative traceability/stability, partial reviews, positive
find guards, conflicting result headers and no prose dependence. Real desktop/
mobile browser tests cover completion, jumps, reload, stable board width,
absence of horizontal overflow and paused-state behavior.
