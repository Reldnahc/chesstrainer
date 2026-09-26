"""Whole-game reports are independent of training decisions and schedules."""

import sqlalchemy as sa
from alembic import op

revision = "04af728d913e"
down_revision = "f83a90d16c24"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "game_reviews",
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), primary_key=True),
        sa.Column("job_id", sa.String(), sa.ForeignKey("analysis_jobs.id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.UniqueConstraint("job_id"),
    )
    op.create_table(
        "game_review_moves",
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), primary_key=True),
        sa.Column("ply", sa.Integer(), primary_key=True),
        sa.Column("report", sa.JSON(), nullable=False),
    )


def downgrade():
    op.drop_table("game_review_moves")
    op.drop_table("game_reviews")
