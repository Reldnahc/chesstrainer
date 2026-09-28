# Cross-game context

`cross-game-1` adds corroboration for a learner's supported missed/allowed tactical
motifs and mate errors in the currently reviewed game. It reads the existing
account-owned active `SkillEvidence`/`Decision` projection. Weaknesses and review
history now share the same grouping and independent-game recurrence helper;
there is no second weakness database or competing threshold.

The game being reviewed is excluded. One other game containing many related
mistakes is still one independent sample. The host's existing
`MIN_INDEPENDENT_GAMES` (default 2) determines provisional versus supported
recurrence. Provisional evidence is available to diagnostics, but must never be
presented as an established habit. Inactive/superseded classification evidence is
excluded. Opponent mistakes and the learner's successful tactics do not become
claims about the learner's weakness.

Each item includes the controlled skill/title, support state, independent-game
and occurrence counts, matching current plies and owned evidence/decision/game
references. The digest includes account, current context generation, threshold
and source evidence. No character text is saved. Reclassification changes the
projection on the next read without re-running Stockfish or Maia.

`scope: other_saved_games` is deliberate: imported history may be incomplete,
undated, or contain games later than the game being reviewed. Do not describe
these as a chronological trend or say "you always do this." SRS retention is a
separate existing metric and is not evidence that training caused improvement
in subsequent games. No training-transfer claim is produced here.

Queries use the same ownership-enforcing ORM sessions as other private data.
Only relevant motifs are fetched, in one ordered query; no per-skill practice
queries or engine work occur during review. New users and users who have only
used game review receive an empty history until actual classified evidence
exists. Viewing a review does not create Decisions, exercises or FSRS recalls.

`test_cross_game_context.py` verifies support boundaries, current-game exclusion,
duplicate positions, active projection changes, player role and cross-account
isolation. These hints remain absent from cold-SRS responses.
