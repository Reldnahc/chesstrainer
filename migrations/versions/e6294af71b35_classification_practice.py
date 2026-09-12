"""Supplemental classification evidence and separate focused practice provenance.

Revision ID: e6294af71b35
Revises: d17b63e02a48
"""

import sqlalchemy as sa
from alembic import op

revision = "e6294af71b35"
down_revision = "d17b63e02a48"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "classification_analyses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("decision_id", sa.String(), sa.ForeignKey("decisions.id"), nullable=False),
        sa.Column("cache_key", sa.String(), nullable=False, unique=True),
        sa.Column("job_id", sa.String(), sa.ForeignKey("analysis_jobs.id")),
        sa.Column(
            "before_analysis_id", sa.String(), sa.ForeignKey("engine_analyses.id"), nullable=False
        ),
        sa.Column(
            "played_analysis_id", sa.String(), sa.ForeignKey("engine_analyses.id"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_classification_analyses_decision_id", "classification_analyses", ["decision_id"]
    )
    op.create_table(
        "classification_tasks",
        sa.Column("job_id", sa.String(), sa.ForeignKey("analysis_jobs.id"), primary_key=True),
        sa.Column("decision_id", sa.String(), sa.ForeignKey("decisions.id"), primary_key=True),
        sa.Column("cache_key", sa.String(), nullable=False),
    )
    # Native ADD COLUMN preserves references from attempts/reviews to review_sessions.
    op.add_column(
        "review_sessions", sa.Column("mode", sa.String(), nullable=False, server_default="review")
    )
    op.execute(
        "ALTER TABLE review_sessions ADD COLUMN focus_skill_id VARCHAR REFERENCES skills(id)"
    )
    op.add_column("review_sessions", sa.Column("response_ms", sa.Integer()))
    op.add_column("review_sessions", sa.Column("completed_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("review_sessions", "completed_at")
    op.drop_column("review_sessions", "response_ms")
    op.drop_column("review_sessions", "focus_skill_id")
    op.drop_column("review_sessions", "mode")
    op.drop_table("classification_tasks")
    op.drop_table("classification_analyses")
