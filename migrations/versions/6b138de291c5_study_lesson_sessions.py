"""New authored Study lessons, distinct from archived lesson records."""

import sqlalchemy as sa
from alembic import op

revision = "6b138de291c5"
down_revision = "5a027cd180b4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "study_lesson_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("course_id", sa.String(), nullable=False),
        sa.Column("course_revision", sa.String(), nullable=False),
        sa.Column("course_title", sa.String(), nullable=False),
        sa.Column("chapter_id", sa.String(), nullable=False),
        sa.Column("chapter_title", sa.String(), nullable=False),
        sa.Column("content_hash", sa.String(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "request_id"),
    )
    op.create_index("ix_study_lesson_sessions_user_id", "study_lesson_sessions", ["user_id"])
    op.create_table(
        "study_lesson_commands",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "session_id", sa.String(), sa.ForeignKey("study_lesson_sessions.id"), nullable=False
        ),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("session_id", "request_id"),
    )
    op.create_index("ix_study_lesson_commands_user_id", "study_lesson_commands", ["user_id"])
    op.create_index("ix_study_lesson_commands_session_id", "study_lesson_commands", ["session_id"])
    op.create_table(
        "study_lesson_progress",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id", sa.String(), nullable=False),
        sa.Column("course_revision", sa.String(), nullable=False),
        sa.Column("chapter_id", sa.String(), nullable=False),
        sa.Column("content_hash", sa.String(), nullable=False),
        sa.Column("viewed_steps", sa.JSON(), nullable=False),
        sa.Column("attempted_steps", sa.JSON(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "course_id", "course_revision", "chapter_id"),
    )
    op.create_index("ix_study_lesson_progress_user_id", "study_lesson_progress", ["user_id"])


def downgrade():
    op.drop_table("study_lesson_commands")
    op.drop_table("study_lesson_progress")
    op.drop_table("study_lesson_sessions")
