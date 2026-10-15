"""Remove the implicit 'local' owner from private tables.

The account migration gave user_id a DEFAULT 'local' on the tables that existed
then, so a raw insert that forgot its owner silently landed in the local
account, which after claim-local is a real person's. Tables added later never
had the default. Every owned row now names its owner.
"""

import sqlalchemy as sa
from alembic import op

revision = "5addd7d590a1"
down_revision = "c8e1f4a7b2d9"
branch_labels = None
depends_on = None


def _defaulted(bind, default):
    tables = bind.exec_driver_sql(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).scalars()
    return [
        table
        for table in tables
        if any(
            column[1] == "user_id" and column[4] == default
            for column in bind.exec_driver_sql(f'PRAGMA table_info("{table}")')
        )
    ]


def _set_default(table, default):
    with op.batch_alter_table(table) as batch:
        batch.alter_column(
            "user_id",
            existing_type=sa.String(),
            existing_nullable=False,
            server_default=default,
        )


def upgrade():
    for table in _defaulted(op.get_bind(), "'local'"):
        _set_default(table, None)


def downgrade():
    # The tables that had the default: those owned when accounts were introduced.
    for table in _owned(op.get_bind()) & set(ACCOUNTS_OWNED):
        _set_default(table, sa.text("'local'"))


def _owned(bind):
    tables = bind.exec_driver_sql("SELECT name FROM sqlite_master WHERE type = 'table'")
    return set(tables.scalars())


# Frozen copy of 71ba12c807d9.OWNED.
ACCOUNTS_OWNED = (
    "analysis_jobs",
    "chesscom_archives",
    "chesscom_imports",
    "classification_analyses",
    "classification_probes",
    "classification_runs",
    "classification_tasks",
    "course_revisions",
    "course_units",
    "courses",
    "decisions",
    "exercise_answers",
    "exercise_attempts",
    "exercise_tags",
    "exercises",
    "game_imports",
    "game_review_moves",
    "game_reviews",
    "games",
    "import_games",
    "lesson_items",
    "lessons",
    "repertoires",
    "review_sessions",
    "reviews",
    "skill_evidence",
    "srs_states",
    "teaching_runs",
    "unit_evidence",
)
