# Data model

SQLAlchemy 2 mapped models, SQLite WAL/foreign keys/30-second busy timeout, and frozen Alembic initial revision 475ea36d42d5. Runtime does not use metadata.create_all. Transactions persist small independent units of work.

| Tables | Purpose |
|---|---|
| game_imports, import_games, games | Original uploads, provenance links, normalized games, learner side and unique fingerprints |
| analysis_jobs | Lifecycle, import/kind, progress, cancellation and sanitized errors |
| chesscom_imports, chesscom_archives | Username/filter/limit settings, download counts/diagnostics, and per-job archive checkpoints, linked to the normal analysis job and import provenance |
| engine_analyses | Unique compatible cache keys, engine/config, FEN, validated candidate/PV payloads |
| decisions | Unique game/ply, FEN/key/move/color, before/played analysis FKs, loss/facts/deep/meaningful flags |
| skills, skill_evidence, llm_runs | Controlled IDs, unique decision/skill links, classification confidence/explanation and model audit |
| courses, course_units, unit_evidence, lessons | Active/archive course snapshots, ordered units, source evidence and stage progress |
| repertoires, exercises, exercise_tags, exercise_answers | Curated PGNs or game/manual sources, normalized answers/tags, policy and verification links |
| srs_states | One library card per exercise, indexed due date, review/lapse counts |
| review_sessions, exercise_attempts, reviews | Active recall sessions, raw attempts, one scheduler event per session |

IDs are UUID hex strings except stable skill IDs. UTC timestamps returned naive by SQLite are explicitly normalized at domain boundaries. Core relationships are queryable. JSON is reserved for immutable engine/config/facts/model payloads, policy snapshots and FSRS serialization.

Credentials are not in SQLite. Configuration lives in environment/.env; Settings is read-only. Skill state is derived from evidence and reviews rather than duplicated in a drift-prone mastery table. Repertoire continuations are normalized directly to exercise answers.

Engine exercise identity includes analysis and policy context; identical boards with different draw histories may intentionally remain separate. Repertoire transpositions merge within a repertoire using legal-play keys and union accepted continuations.

Backups contain a consistent SQLite snapshot, format manifest and safe settings. Restore validates integrity/foreign keys and writes only a new file. The saved Alembic version allows later migrations. Safe settings are reference material and secrets must be restored separately.

Revision `1c14f367bbe8` adds Chess.com query/progress and archive checkpoint tables without modifying existing game identities. A download and its checkpoint commit together; raw selected PGNs remain in game_imports. Backup/restore automatically includes these records. The same mutation lock protects PGN uploads and Chess.com ingestion from cross-source duplicate insertion races.

`chesscom_imports.start_date` and `end_date` are nullable SQL dates, representing inclusive UTC completion-date bounds. They remain queryable alongside username, time_class, months and max_games and participate in active-request deduplication.

Revision `6b9d45ae2210` adds `import_games.is_new`. All imports retain duplicate provenance, but new jobs analyze only links marked true. Existing links migrate as true to preserve the scope of already-created jobs and allow interrupted work to resume; their existing decision/classification caches still prevent expensive recomputation. Future duplicate links are false. No game, evidence or SRS record is deleted by this migration.
