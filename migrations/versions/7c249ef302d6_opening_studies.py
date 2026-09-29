"""Opening study contribution projections and immutable recall authority snapshots."""

import sqlalchemy as sa
from alembic import op

revision = "7c249ef302d6"
down_revision = "6b138de291c5"
branch_labels = None
depends_on = None


def owner():
    return sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False)


def upgrade():
    op.create_table(
        "opening_studies",
        sa.Column("id", sa.String(), primary_key=True),
        owner(),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("source_key", sa.String(), nullable=False),
        sa.Column("source_version", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("eco", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "source", "source_key", "source_version", "color"),
    )
    op.create_table(
        "opening_study_moves",
        sa.Column("study_id", sa.String(), sa.ForeignKey("opening_studies.id"), primary_key=True),
        sa.Column("ordinal", sa.Integer(), primary_key=True),
        owner(),
        sa.Column("exercise_id", sa.String(), sa.ForeignKey("exercises.id"), nullable=False),
        sa.Column("position_key", sa.String(), nullable=False),
        sa.Column("fen", sa.String(), nullable=False),
        sa.Column("ply", sa.Integer(), nullable=False),
        sa.Column("move_uci", sa.String(), nullable=False),
        sa.Column("move_san", sa.String(), nullable=False),
    )
    op.create_index("ix_opening_study_moves_exercise_id", "opening_study_moves", ["exercise_id"])
    op.create_table(
        "opening_cards",
        sa.Column("exercise_id", sa.String(), sa.ForeignKey("exercises.id"), primary_key=True),
        owner(),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("last_active_answers", sa.JSON(), nullable=False),
        sa.Column("retirement_guard_revision", sa.Integer(), nullable=True),
    )
    op.create_table(
        "opening_recall_snapshots",
        sa.Column("session_id", sa.String(), sa.ForeignKey("review_sessions.id"), primary_key=True),
        owner(),
        sa.Column("answer_revision", sa.Integer(), nullable=False),
        sa.Column("fen", sa.String(), nullable=False),
        sa.Column("orientation", sa.String(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("studies", sa.JSON(), nullable=False),
        sa.Column("non_scheduling_reason", sa.String(), nullable=True),
    )
    op.create_table(
        "opening_content_changes",
        sa.Column("id", sa.String(), primary_key=True),
        owner(),
        sa.Column("exercise_id", sa.String(), sa.ForeignKey("exercises.id"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_opening_content_changes_exercise_id", "opening_content_changes", ["exercise_id"]
    )
    for table in (
        "opening_studies",
        "opening_study_moves",
        "opening_cards",
        "opening_recall_snapshots",
        "opening_content_changes",
    ):
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])


def downgrade():
    for table in (
        "opening_content_changes",
        "opening_recall_snapshots",
        "opening_cards",
        "opening_study_moves",
        "opening_studies",
    ):
        op.drop_table(table)
