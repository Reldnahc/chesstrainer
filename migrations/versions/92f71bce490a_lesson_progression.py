"""Stable lesson sequences, teaching audits and SRS graduation.

Revision ID: 92f71bce490a
Revises: 6b9d45ae2210
"""

from alembic import op
import sqlalchemy as sa

revision = "92f71bce490a"
down_revision = "6b9d45ae2210"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "lessons", sa.Column("check_rounds", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "lessons", sa.Column("last_check_correct", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "skill_evidence", sa.Column("active", sa.Boolean(), nullable=False, server_default="1")
    )
    op.add_column(
        "course_units", sa.Column("group_key", sa.String(), nullable=False, server_default="")
    )
    op.add_column(
        "course_units", sa.Column("active", sa.Boolean(), nullable=False, server_default="1")
    )
    op.add_column(
        "srs_states", sa.Column("eligible", sa.Boolean(), nullable=False, server_default="1")
    )
    op.create_table(
        "course_revisions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("course_id", sa.String(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("fingerprint", sa.String(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_course_revisions_course_id", "course_revisions", ["course_id"])
    op.create_table(
        "lesson_items",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("lesson_id", sa.String(), sa.ForeignKey("lessons.id"), nullable=False),
        sa.Column("exercise_id", sa.String(), sa.ForeignKey("exercises.id"), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("clean", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("lesson_id", "ordinal"),
    )
    op.create_index("ix_lesson_items_lesson_id", "lesson_items", ["lesson_id"])
    # SQLite supports a nullable REFERENCES column directly; no table rebuild is needed.
    op.execute(
        "ALTER TABLE review_sessions ADD COLUMN lesson_item_id VARCHAR REFERENCES lesson_items(id)"
    )
    op.create_table(
        "teaching_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("unit_id", sa.String(), sa.ForeignKey("course_units.id"), nullable=False),
        sa.Column("cache_key", sa.String(), nullable=False, unique=True),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("schema_version", sa.String(), nullable=False),
        sa.Column("prompt_version", sa.String(), nullable=False),
        sa.Column("evidence_ids", sa.JSON(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_teaching_runs_unit_id", "teaching_runs", ["unit_id"])


def downgrade():
    op.drop_column("lessons", "last_check_correct")
    op.drop_column("lessons", "check_rounds")
    op.drop_table("teaching_runs")
    op.drop_column("review_sessions", "lesson_item_id")
    op.drop_table("lesson_items")
    op.drop_table("course_revisions")
    op.drop_column("srs_states", "eligible")
    op.drop_column("course_units", "active")
    op.drop_column("course_units", "group_key")
    op.drop_column("skill_evidence", "active")
