"""Immutable baseline plus resumable account-owned investigations and update cursors."""

import sqlalchemy as sa
from alembic import op

revision = "55de0b7b8ff2"
down_revision = "39c94b22a711"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "game_reviews", sa.Column("revision", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column("game_reviews", sa.Column("refinement_plan", sa.JSON(), nullable=True))
    op.create_table(
        "review_refinements",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), nullable=False),
        sa.Column("ply", sa.Integer(), nullable=False),
        sa.Column("task_key", sa.String(), nullable=False),
        sa.Column("triggers", sa.JSON(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("queries", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("report", sa.JSON(), nullable=True),
        sa.Column("adopted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "task_key"),
    )
    op.create_index("ix_review_refinements_user_id", "review_refinements", ["user_id"])
    op.create_index("ix_review_refinements_game_id", "review_refinements", ["game_id"])
    op.add_column(
        "game_review_moves", sa.Column("revision", sa.Integer(), nullable=False, server_default="0")
    )
    op.execute(
        "ALTER TABLE game_review_moves ADD COLUMN refinement_id VARCHAR REFERENCES review_refinements(id)"
    )


def downgrade():
    with op.batch_alter_table("game_review_moves") as batch:
        batch.drop_column("refinement_id")
    with op.batch_alter_table("game_review_moves") as batch:
        batch.drop_column("revision")
    op.drop_table("review_refinements")
    with op.batch_alter_table("game_reviews") as batch:
        batch.drop_column("refinement_plan")
    with op.batch_alter_table("game_reviews") as batch:
        batch.drop_column("revision")
