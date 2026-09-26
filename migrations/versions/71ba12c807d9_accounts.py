"""Persistent accounts and ownership in the existing single SQLite database."""

import sqlalchemy as sa
from alembic import op

revision = "71ba12c807d9"
down_revision = "04af728d913e"
branch_labels = None
depends_on = None

OWNED = [
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
]
KEYS = {
    "games": "fingerprint",
    "exercises": "identity",
    "classification_analyses": "cache_key",
    "classification_runs": "cache_key",
    "teaching_runs": "cache_key",
}


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False, unique=True),
        sa.Column("password", sa.String(), nullable=False),
        sa.Column("admin", sa.Boolean(), nullable=False),
        sa.Column("disabled", sa.Boolean(), nullable=False),
        sa.Column("chesscom_username", sa.String(), nullable=False),
        sa.Column("created", sa.Float(), nullable=False),
    )
    op.execute("INSERT INTO users VALUES ('local','__local__','',0,1,'',0)")
    op.create_table(
        "auth_sessions",
        sa.Column("digest", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires", sa.Float(), nullable=False),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    convention = {"uq": "uq_%(table_name)s_%(column_0_name)s"}
    for name in OWNED:
        with op.batch_alter_table(name, naming_convention=convention) as batch:
            batch.add_column(
                sa.Column("user_id", sa.String(), nullable=False, server_default="local")
            )
            batch.create_foreign_key("fk_" + name + "_user", "users", ["user_id"], ["id"])
            batch.create_index("ix_" + name + "_user_id", ["user_id"])
            if name in KEYS:
                key = KEYS[name]
                batch.drop_constraint("uq_" + name + "_" + key, type_="unique")
                batch.create_unique_constraint("uq_" + name + "_user_" + key, ["user_id", key])


def downgrade():
    if (
        op.get_bind()
        .exec_driver_sql(
            "SELECT count(*) FROM users WHERE id != 'local' OR username != '__local__'"
        )
        .scalar()
    ):
        raise RuntimeError("Accounts exist; restore a pre-upgrade backup instead of downgrading.")
    for name in reversed(OWNED):
        with op.batch_alter_table(name) as batch:
            if name in KEYS:
                key = KEYS[name]
                batch.drop_constraint("uq_" + name + "_user_" + key, type_="unique")
                batch.create_unique_constraint("uq_" + name + "_" + key, [key])
            batch.drop_index("ix_" + name + "_user_id")
            batch.drop_constraint("fk_" + name + "_user", type_="foreignkey")
            batch.drop_column("user_id")
    op.drop_table("auth_sessions")
    op.drop_table("users")
