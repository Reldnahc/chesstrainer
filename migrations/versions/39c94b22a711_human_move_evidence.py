"""Account-owned provider-neutral human evidence in the existing database."""

import sqlalchemy as sa
from alembic import op

revision = "39c94b22a711"
down_revision = "ab35a86cd472"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "human_analyses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("cache_key", sa.String(), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("policy", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "cache_key"),
    )
    op.create_index("ix_human_analyses_user_id", "human_analyses", ["user_id"])
    op.create_index("ix_human_analyses_cache_key", "human_analyses", ["cache_key"])
    # SQLite supports adding a nullable reference without rebuilding saved reviews.
    op.execute(
        "ALTER TABLE game_review_moves ADD COLUMN human_analysis_id VARCHAR REFERENCES human_analyses(id)"
    )


def downgrade():
    op.drop_column("game_review_moves", "human_analysis_id")
    op.drop_table("human_analyses")
