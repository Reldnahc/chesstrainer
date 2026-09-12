"""Separate immutable continuation and defensive-probe links.

Revision ID: f83a90d16c24
Revises: e6294af71b35
"""

import sqlalchemy as sa
from alembic import op

revision = "f83a90d16c24"
down_revision = "e6294af71b35"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "classification_probes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "classification_analysis_id",
            sa.String(),
            sa.ForeignKey("classification_analyses.id"),
            nullable=False,
        ),
        sa.Column(
            "root_analysis_id", sa.String(), sa.ForeignKey("engine_analyses.id"), nullable=False
        ),
        sa.Column("analysis_id", sa.String(), sa.ForeignKey("engine_analyses.id"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("at_ply", sa.Integer(), nullable=False),
        sa.Column("query_key", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("classification_analysis_id", "query_key"),
    )
    op.create_index(
        "ix_classification_probes_classification_analysis_id",
        "classification_probes",
        ["classification_analysis_id"],
    )


def downgrade():
    op.drop_table("classification_probes")
