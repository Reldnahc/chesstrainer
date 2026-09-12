# Local mistake classification

## Classification v3 (assessment and rollout pending)

Saved-line inspection now extends forward from the initial 16-ply horizon by up to 16 additional plies, only when the chosen endpoint is unfinished. Audits record endpoint, extension and reason. It never substitutes an earlier favorable material balance.

Specific witnesses can span a connected tactical episode (default eight plies). Checks, exchanges, and collection of newly created threats connect events; a quiet unrelated gap stops attribution. This supports forks after exchanges, nonchecking discovered attacks, two-piece double attacks, and a conservative sole-defender deflection. Immediate undefended-capture labels are not added merely because a fork later collects its target.

Before/after cause witnesses identify an abandoned sole unpinned defender, an immediate unfavorable capture/recapture, and a newly created attack from the opponent's previous move that remains unanswered. The latter saves and validates the preceding position/move. These are observed events in the saved continuation, not statements about the learner's intentions. Engine comparisons and material-outcome gates still apply. Taxonomy v3 adds abandoned_defender, deflection and trapped_piece (the latter awaits targeted verification); existing opponent_threat_recognition and avoiding_bad_trades now have local witnesses.

On the isolated 395-position baseline, adaptive endpoints produced 265 outcomes / 68 pattern positions; connected sequences and move causes increased pattern coverage to 103. No engine searches were added for these stages. Accuracy assessment remains pending; see DEVELOPMENT_PLAN.md.

Targeted native tests now corroborate relative pins, costly legal captures of forking pieces, and a conservative trapped-piece pattern. Geometric hypotheses remain unpublished until the matching query confirms a material gain and a compatible score in the best tested defensive continuation. A useful defensive resource, uncollected target, unsettled line or unsupported original outcome causes abstention. Trapped-piece candidates require every legal move of the piece to allow an immediate legal capture; the tested best escape must actually lose the piece. Other defensive resources and broader strategic traps remain outside this detector. Audits retain pending/confirmed/rejected check reasons and the additional analysis IDs.

Fieldwork uses python-chess, local Stockfish and deterministic Python rules. There is no LLM connection, model key, paid classification, or external pedagogy payload. Historical model audits remain archived locally.

## Outcomes, patterns and practice cues

Rules v2 separate three things: an observable material/mate outcome, a supported tactical mechanism, and a short practice cue. An outcome does not imply that a specific mechanism was recognized. Weaknesses and Settings show current coverage separately for outcomes and patterns. Counts overlap and are not accuracy percentages.

| Finding | Required witness |
|---|---|
| Allowed / missed mate | Explicit learner-perspective mate transition versus the best alternative |
| Material loss / missed material gain | Meaningful relative evaluation loss plus different material balances at usable endpoints of both saved lines |
| Hanging piece / missed tactical capture | Immediate capture of an undefended non-pawn with a supported net gain |
| Fork | Newly attacks at least two valuable targets; cannot be legally captured immediately; that same piece collects a target in the line |
| Pin | Every geometric defender of the captured target is absolutely pinned and cannot legally recapture off its pin ray |
| Skewer | A slider checks the king along a ray with a valuable piece behind it, then that same slider captures the rear target |
| Removing defender | Captures the target's sole geometric defender; the next relevant actor move captures the now-undefended target |
| Back rank | Legally replayed rook/queen checkmate on the home rank, with at least two adjacent inward squares occupied by the king's own pawns |
| Discovered attack / double attack | Uncovered check / double check in a supported material or mating line |
| Promotion awareness | Immediate promotion with a supported material gain |

Pin, skewer, removal and back-rank detectors examine the first relevant action and one immediate forcing follow-up. Nonchecking discoveries/double attacks, relative pins, overloads, broad positional causes, opening habits and inferred thought processes remain outside current detector scope. A taxonomy ID alone does not mean a detector exists.

## Verification and limits

All PV moves are replayed and validated by python-chess. Stockfish scores retain explicit centipawn/mate types and the learner's perspective. Already-lost mate positions are not newly labeled allowed mate; retaining a slower mate is not missed mate.

Material rules default to at least 150 cp relative loss, at least one material point, and at most 16 plies. Both lines need a quiet endpoint: no check, no capture/promotion in the last two plies, and unchanged last-three material balances. Do not search backward for an earlier favorable balance when the endpoint is unsettled. Values are pawn 1, minor piece 3, rook 5, queen 9. These are finite-line outcomes, not proof that every reply is forced or every exchange has ended.

Absolute evaluation no longer gates material findings: a player can lose a piece while still winning. Small evaluation preferences and compensated material without the configured evaluation loss do not qualify. Pinned forking pieces cannot claim off-ray targets. Geometry alone never proves a training-worthy mistake.

Findings retain rule/version, actor, direction, analysis ID, plies, UCI moves, affected squares, witness frame, named square roles and explanation/cue. Outcomes retain the analysis and endpoint. Abstention reasons include continuation_unsettled, no_verified_material_or_mate_outcome and mechanism_unclassified; these can coexist with partial findings.

## Saved work and optional enrichment

New meaningful decisions classify automatically. **Settings > Classify saved games** reuses saved engine evidence without starting Stockfish. Results, including abstentions, are cached by evidence, rules, parameters and taxonomy. Failed work preserves active labels; successful abstention replaces earlier labels. Rejected identical results stay rejected. Historical runs remain auditable.

**Settings > Deepen unclear positions** optionally queues extra local Stockfish work. Default budget: 40 positions, at most six searches per position, each capped at 2 seconds / depth 22 (first reached bound). Two searches refresh best/actual root comparisons; remaining queries extend unfinished saved tails or test specific legal defenses. Concrete pending defensive questions take priority, followed by unknown outcomes and unclear mechanisms, with severity/recency ordering. The selected task list persists, so a cancelled/restarted job cannot silently expand its budget. Later jobs skip identical completed probes and can process another batch. Progress and cancel/retry are in Import.

Each completed probe links separate immutable best/actual EngineAnalysis records through classification_analyses. Original Decision analysis IDs, ExerciseAnswer grades, policies and SRS states never change. Reclassification prefers the latest supplemental pair, including if it reduces confidence or coverage. More engine time does not guarantee a new label. The engine cache includes binary identity, settings, root moves and limits; both searches use the actual game history.

Additional classification_probes rows link each tail/defense to its supplement, root analysis, exact ply, query identity and native result. Tail joins require the exact parent endpoint and legal replay; their local side-to-move score never replaces the original root evaluation. Hypothesis checks validate the requested legal move set, position, direction/perspective and witness. Completion links commit together after bounded work; cancellation leaves all completed native searches cached and safely reusable.

## Using findings

Weaknesses separates tactical patterns from material/mate outcomes, shows distinct positions and independent games, provides cues, and lets the learner browse every supporting decision. **Practice N positions** starts up to 12 distinct active positions, rotating through different games where possible. Practice has its own session provenance, raw attempts/first-response time and completion timestamp. It never updates FSRS, retirement, scheduled recall counts or due dates. Reloading the app returns to mixed Review; choosing the skill again starts a new batch and can resume an unfinished practice attempt.

Show why runs the shared motif detectors on the exact answer's saved continuation, not a label copied from a different move in the source game. Pattern buttons jump to the witness frame and highlight attacker, target/king and defender/blocker squares. Cues appear after answering. Supplemental classification analyses do not replace the older evidence used to grade or explain an existing answer, so an enriched classification may have more detail than that answer's playback.

## Configuration and evaluation

See CONFIGURATION.md for CLASSIFICATION_* settings. These influence classification only, not accepted moves. Rules use weights 1/0 for aggregation; these are not calibrated confidence probabilities.

`python scripts/classification_report.py --output data/report.json --sample data/sample.csv` reads the database without writes or engine calls. Outputs contain private FENs, moves and evidence IDs; keep them local. It refuses to overwrite existing files. Sampling balances rare patterns, outcomes and abstentions, and assigns all positions from a game to one development/holdout split.

A human reviewer fills expected_outcomes and expected_mechanisms with semicolon-separated supported skill IDs, then sets fully_labeled=yes only after exhaustively reviewing both fields. Blank expected fields on a fully labeled row mean no supported labels, not missing work. Leave uncertain/incomplete rows unmarked. For a blind assessment, hide predicted columns and stratum while labeling. Keep holdout games out of rule tuning.

`python scripts/classification_report.py --annotations data/sample.csv --output data/evaluated.json` reports precision/recall separately for outcomes and mechanisms, including split metrics. Only explicitly completed annotations count. Unknown labels, duplicate decisions and changed evidence are rejected. Empty denominators stay unknown. The stratified subset is not an unweighted population accuracy estimate. Independent human labels and long-term improvement measurements are still outstanding; fixtures and coverage do not establish accuracy.

UI examples from isolated fixtures: [phone pattern playback](screenshots/classification-pattern-mobile.png) and [desktop pattern playback](screenshots/classification-pattern-desktop.png).
