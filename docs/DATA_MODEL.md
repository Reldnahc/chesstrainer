# Data model

SQLAlchemy 2 mapped models use SQLite WAL, foreign keys and a 30-second busy timeout. Alembic owns schema changes, starting at frozen revision 475ea36d42d5 and currently ending at 39c94b22a711. Runtime does not use metadata.create_all. Transactions persist small independent units of work.

## Current and archival relationships

| Tables | Role |
|---|---|
| users, auth_sessions, user_preferences | Account credentials/session digests, recent-game sync and persisted coach/motion preferences |
| game_imports, import_games, games | Original uploads, provenance links, normalized games, learner side and unique fingerprints |
| analysis_jobs | Lifecycle, import/kind, progress, cancellation and sanitized errors |
| chesscom_imports, chesscom_archives | Query/filter settings, download diagnostics and per-job archive checkpoints |
| engine_analyses | Compatible durable cache, engine/configuration, FEN and validated candidate/PV payloads |
| game_reviews, game_review_moves | Account-owned resumable whole-game review metadata and per-ply engine evidence, independent of training/FSRS |
| decisions | Unique game/ply, FEN/key/move/color, original analysis references, loss/facts/deep/meaningful flags |
| skills, skill_evidence, classification_runs | Controlled IDs, current evidence projection and immutable local/historical classification audits |
| classification_analyses, classification_tasks, classification_probes | Supplemental evidence, capped job selections and root/tail/defense query links, separate from grading authority |
| exercises, exercise_tags, exercise_answers | Game/manual practice and archived repertoire exercises, normalized answers/tags, policy snapshots and verification references |
| srs_states | One serialized library card per exercise, due/review/lapse fields, eligibility and persistent retirement |
| review_sessions, exercise_attempts, reviews | Raw sessions/attempts and one scheduler event per ordinary recall; focused and archived lesson attempts are separate |
| courses, course_units, unit_evidence, course_revisions, lessons, lesson_items | Archived course snapshots, source evidence, ordered items and historical progress; no active generation/progression |
| teaching_runs | Archived model teaching audits; existing records can be inspected/rejected but new teaching is unavailable |
| repertoires | Archived curated PGNs; import/list/practice product routes are disabled |

There are 35 application tables plus alembic_version. IDs are UUID hex strings except stable skill IDs and the reserved local account. UTC timestamps returned naive by SQLite are normalized at domain boundaries. Core relationships are queryable; JSON holds immutable engine/facts/classification payloads, policy snapshots, historical course snapshots and FSRS serialization.

`human_analyses` stores account-owned provider-neutral requests and complete policy
facts, unique by owner and versioned cache key. `game_review_moves.human_analysis_id`
references that evidence independently of Stockfish analysis IDs. Model weights
remain reproducible files outside SQLite. Native inference holds no database
transaction. See [HUMAN_MODELS.md](HUMAN_MODELS.md) for identity and interpretation.

Host configuration lives in environment/.env. User settings are account-owned and
editable in Settings. SQLite contains salted password hashes and session-token
digests, never plaintext passwords or session tokens. Skill state is derived from
evidence and reviews, avoiding a duplicated mastery table. See [ACCOUNTS.md](ACCOUNTS.md)
for ownership filtering and private foreign-key validation.

Engine exercise identity includes analysis/policy context, so identical boards with different draw histories may remain separate. Legacy repertoire helpers normalized continuations into exercise answers and merged transpositions within a repertoire by legal-play key. Those saved rows remain readable; they do not imply an active import or practice workflow. Existing manual exercises remain reviewable through the retained validated API.

## Backups and compatibility

Backups contain a consistent SQLite snapshot, format manifest and safe settings. Restore validates integrity/foreign keys and writes only a new file. The saved Alembic version supports later migrations. Safe settings are reference material; reapply them manually and restore secrets separately.

Repertoire archival is a read-time source filter, not deletion or retirement. Lesson release changed eligibility only. Classification-only jobs update audit/evidence projections without creating exercises or changing schedules. The interface refactor adds no migration or schema change. [VERIFICATION.md](VERIFICATION.md) records current copy-preservation checks.

## Migration history

The following notes describe how retained fields and compatibility behavior were introduced. References to creating course sequences describe historical domain behavior, not an active application workflow.

Revision `1c14f367bbe8` adds Chess.com query/progress and archive checkpoint tables without modifying existing game identities. A download and its checkpoint commit together; raw selected PGNs remain in game_imports. Backup/restore automatically includes these records. The same mutation lock protects PGN uploads and Chess.com ingestion from cross-source duplicate insertion races.

`chesscom_imports.start_date` and `end_date` are nullable SQL dates, representing inclusive UTC completion-date bounds. They remain queryable alongside username, time_class, months and max_games and participate in active-request deduplication.

Revision `6b9d45ae2210` adds `import_games.is_new`. All imports retain duplicate provenance, but new jobs analyze only links marked true. Existing links migrate as true to preserve the scope of already-created jobs and allow interrupted work to resume; their existing decision/classification caches still prevent expensive recomputation. Future duplicate links are false. No game, evidence or SRS record is deleted by this migration.

### Archived lesson progression migration: 92f71bce490a

CourseUnit adds stable group_key and active membership. CourseRevision contains immutable JSON snapshots of a course update (target, groups, priority, supporting decisions and original run mappings); current core relationships remain relational.

Lesson keeps ordered stage completion plus check_rounds and last_check_correct. LessonItem links an ordered stage position to an Exercise, with current-round completed/clean fields. The archived implementation appended Lesson and LessonItem rows for later sequences. ReviewSession.lesson_item_id distinguishes course practice from ordinary review; all raw Attempt rows stay linked to the session. Completed lesson attempts never create Review rows. SRSState.eligible controlled lesson withholding; migration d17b63e02a48 later released nonretired lesson-held cards.

SkillEvidence.active is the current diagnosis projection. Its prior run remains in ClassificationRun; course revisions preserve prior evidence/run mappings when the projection changes. Rejected ClassificationRun responses remain auditable. TeachingRun separately stores unit/model/prompt/schema, evidence IDs, response, confidence, status/error, attempts, tokens and time.

The additive migration preserves existing review rows and serialized FSRS state. It adds nullable lesson session references directly in SQLite, avoiding a destructive rebuild of the referenced review table. Backup/restore includes all new tables automatically.

Migration a38d721c4f90 adds nullable `srs_states.retired_at` and `retired_interval_days`. These preserve the retirement timestamp and triggering interval independently of lesson eligibility and the original serialized FSRS card/due date. No history is deleted. Startup applies the configured retirement threshold to existing states with a saved last-review timestamp.

Migration b91a0673de42 adds nullable review_sessions.last_attempt_id referencing exercise_attempts. New attempts update the link atomically with their recorded result; existing historical attempts are preserved. Old sessions without a link gain one on their next submitted move. Explanation payloads are derived from immutable engine evidence and deterministic replay (version 1), so no duplicate explanation/LLM table is needed.

### Local classification migration c42d1738a9bf

Native SQLite renames move llm_runs to classification_runs and skill_evidence.llm_run_id to classification_run_id, preserving IDs and foreign keys. New provider/version columns distinguish legacy_llm from local_rules. Original model, prompt, confidence and token columns remain for historical audit/export compatibility; local runs use no tokens or external model. Old classification responses and course snapshots are not deleted. Existing model evidence is made inactive before local backfill; pending paid teaching jobs are cancelled.

New run responses contain typed findings with skill ID, rule ID/version, direction, actor, analysis ID, supporting plies/moves/squares, verification type, explanation and rule parameters. These immutable detail payloads are JSON; decision/skill/run relationships remain relational. The legacy confidence column holds 1 for emitted local evidence and 0 for abstention; it is an aggregation weight, not a calibrated probability. Historical teaching rows are archived and no longer generated.

Classification-only backfills update runs and skill projections, never games, exercises, reviews, FSRS states, retirement or course sequences. Backups cover the renamed tables automatically. Migration was exercised on a database copy and checked for foreign-key integrity and unchanged learning-history rows before deployment.

Migration d17b63e02a48 removes lesson holds: set srs_states.eligible to true only where a lesson item references the exercise and retired_at is null. No other column or historical table changes. Downgrade does not re-hide cards because new review progress may have occurred after release.

Repertoire removal is read-time archival: exercises.source = repertoire is excluded from the review queue, and API writes are rejected. Repertoire rows, exercises, answers, attempts and FSRS state remain unchanged. No migration or retirement marker is applied.

### Classification and practice migration e6294af71b35

classification_analyses links a decision to supplemental before/actual EngineAnalysis rows, the originating job, a unique probe configuration key and timestamp. It never rewrites the Decision or ExerciseAnswer analysis IDs. classification_tasks has a composite job/decision primary key and requested probe key; this persists the capped selection across cancellation/restart. Completed probes are immutable and future jobs skip identical requests.

ReviewSession adds mode (review by default), nullable focus_skill_id, first response_ms and completed_at. Old sessions get neutral defaults without rebuilding the referenced table. Focus sessions retain ordinary Attempt rows and failed/revealed/completed state but create no Review and never write SRSState. Historical rows are unchanged; absent historical timing is not fabricated.

Classification response schema v2 adds outcomes, abstention reasons, witness frame_ply, square roles and practice cues. Historical responses remain readable through defaults. Relational SkillEvidence remains the current projection; outcomes and mechanism findings are distinguishable by the controlled skill sets. Backups automatically include new tables and columns.

### Classification schema v3 and rule version 3.1

Response schema v3 adds typed continuation endpoints, defense-check diagnostics, previous-move context on relevant findings and supporting analysis IDs on findings/outcomes. JSON stores immutable diagnostic payloads; classification_probes keeps the core supplemental engine relationships queryable. Older response schemas remain readable through default fields. Rule version is distinct from response-schema version and participates in classification/probe cache identity. Migration f83a90d16c24 adds immutable classification_probes rows linking a supplemental analysis to root and tail/defensive native results, with query kind, root-relative ply and unique query key. At its original rollout it was verified on both the copied and live database with every row of all 28 existing tables unchanged.

Review intelligence refinement adds account-owned `review_refinements`, finite
`game_reviews.refinement_plan`, review/row revisions and an optional adopted-task
reference on `game_review_moves`. Migration `55de0b7b8ff2` preserves all baseline
reports and IDs. The baseline JSON is never overwritten by investigation output.
See [REVIEW_REFINEMENT.md](REVIEW_REFINEMENT.md) for effective-generation rules.
