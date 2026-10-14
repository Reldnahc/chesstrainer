"""Index the account queries that sorted or scanned a whole table.

Every account query filters on user_id, and SQLite picked each table's
single-column user_id index and then sorted or scanned the rest: the games
library page, an account's jobs by status, and the workers' claim of the next
queued job. Composite indexes now lead with what those queries filter and sort
on, the single-column indexes they make redundant go, and foreign keys that
queries follow get their own index.
"""

from alembic import op

revision = "f6c0e2a4b8d7"
down_revision = "e4a8c2f6d0b3"
branch_labels = None
depends_on = None

ADDED = (
    ("ix_games_user_id_played_at", "games", ["user_id", "played_at", "created_at", "id"]),
    ("ix_analysis_jobs_user_id_status", "analysis_jobs", ["user_id", "status"]),
    ("ix_analysis_jobs_claim", "analysis_jobs", ["status", "kind", "priority", "created_at"]),
    ("ix_analysis_jobs_import_id", "analysis_jobs", ["import_id"]),
    ("ix_exercise_attempts_session_id", "exercise_attempts", ["session_id"]),
    ("ix_exercises_decision_id", "exercises", ["decision_id"]),
    ("ix_game_review_moves_human_analysis_id", "game_review_moves", ["human_analysis_id"]),
    ("ix_import_games_game_id", "import_games", ["game_id"]),
    ("ix_play_games_saved_game_id", "play_games", ["saved_game_id"]),
)
# Prefixes of a unique constraint or of an index above.
REMOVED = (
    ("ix_games_user_id", "games", ["user_id"]),
    ("ix_analysis_jobs_user_id", "analysis_jobs", ["user_id"]),
    ("ix_analysis_jobs_status", "analysis_jobs", ["status"]),
)


def upgrade():
    for name, table, columns in REMOVED:
        op.drop_index(name, table_name=table)
    for name, table, columns in ADDED:
        op.create_index(name, table, columns)


def downgrade():
    for name, table, _ in ADDED:
        op.drop_index(name, table_name=table)
    for name, table, columns in REMOVED:
        op.create_index(name, table, columns)
