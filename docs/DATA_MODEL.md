# Data model

SQLAlchemy 2 mapped models use SQLite WAL, foreign keys and a 30-second busy timeout. Alembic owns schema changes from frozen revision 475ea36d42d5; `alembic heads` shows the current revision. Runtime does not use metadata.create_all. Transactions persist small independent units of work.

## Current and archival relationships

| Tables | Role |
|---|---|
| users, auth_sessions, user_preferences | Account credentials/session digests, administrator and password-change-required flags, presence for polling, and persisted coach/motion/audio preferences |
| provider_connections | Account-owned provider usernames and the poller's change markers (`poll_state`) |
| game_imports, import_games, games | Original uploads, provenance links, normalized games, learner side, saved mainline move counts, unique fingerprints and the nullable `rated` flag (statistics skip only games known to be unrated) |
| analysis_jobs | Lifecycle, import/kind, progress, cancellation and sanitized errors |
| chesscom_imports, chesscom_archives | Query/filter settings, download diagnostics and per-job archive checkpoints |
| engine_analyses | Compatible durable cache, engine/configuration, FEN and validated candidate/PV payloads |
| play_games, play_profiles | Account-owned games against the coach's bot (moves, saved per-ply reports, result, the saved library game) and the measured level fit with its evidence size |
| game_reviews, game_review_moves | Account-owned resumable whole-game review metadata and per-ply engine evidence, independent of training/FSRS |
| decisions | Unique game/ply, FEN/key/move/color, original analysis references, loss/facts/deep/meaningful flags |
| skills, skill_evidence, classification_runs | Controlled IDs, current evidence projection and immutable local/historical classification audits |
| classification_analyses, classification_tasks, classification_probes | Supplemental evidence, capped job selections and root/tail/defense query links, separate from grading authority |
| exercises, exercise_tags, exercise_answers | Game/manual practice and archived repertoire exercises, normalized answers/tags, policy snapshots and verification references |
| srs_states | One serialized library card per exercise, due/review/lapse fields, eligibility and persistent retirement |
| review_sessions, exercise_attempts, reviews | Raw sessions/attempts and one scheduler event per ordinary recall; focused and archived lesson attempts are separate |
| puzzle_sessions, puzzle_attempts | Private immutable puzzle snapshots, revisioned solve progress and idempotent practice commands; independent of Review/FSRS |
| game_puzzles, game_puzzle_searches | Account-owned puzzles mined from the learner's games, each with its engine evidence or abstention reason, and one search record per game and generator version |
| courses, course_units, unit_evidence, course_revisions, lessons, lesson_items | Archived course snapshots, source evidence, ordered items and historical progress; no active generation/progression |
| teaching_runs | Archived model teaching audits; existing records can be inspected/rejected but new teaching is unavailable |
| repertoires | Archived curated PGNs; import/list/practice product routes are disabled |

There are 51 application tables plus alembic_version. IDs are UUID hex strings except stable skill IDs and the reserved local account. UTC timestamps returned naive by SQLite are normalized at domain boundaries. Core relationships are queryable; JSON holds immutable engine/facts/classification payloads, policy snapshots, historical course snapshots and FSRS serialization.

`human_analyses` stores provider-neutral requests and complete policy facts, unique
by versioned cache key. Like `engine_analyses` it is shared between accounts: the
key depends only on the game and provider, so members who import the same game
reuse one prediction. `game_review_moves.human_analysis_id`
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

Repertoire archival is a read-time source filter, not deletion or retirement. Lesson release changed eligibility only. Classification-only jobs update audit/evidence projections without creating exercises or changing schedules.
