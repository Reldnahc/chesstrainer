"""Puzzles mined from the learner's own games, and the per-game searches behind them."""

import sqlalchemy as sa
from alembic import op

revision = "c7e2a9f4b1d3"
down_revision = "c3d5e7f9a1b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "analysis_jobs",
        sa.Column("puzzles_found", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "game_puzzle_searches",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), nullable=False),
        sa.Column("generator_version", sa.String(), nullable=False),
        sa.Column("engine_version", sa.String(), nullable=False),
        sa.Column("candidates", sa.Integer(), nullable=False),
        sa.Column("kept", sa.Integer(), nullable=False),
        sa.Column("searched_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "game_id", "generator_version"),
    )
    op.create_index("ix_game_puzzle_searches_user_id", "game_puzzle_searches", ["user_id"])
    op.create_index("ix_game_puzzle_searches_game_id", "game_puzzle_searches", ["game_id"])
    op.create_table(
        "game_puzzles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), nullable=False),
        sa.Column("ply", sa.Integer(), nullable=False),
        sa.Column("decision_id", sa.String(), sa.ForeignKey("decisions.id"), nullable=True),
        sa.Column("generator_version", sa.String(), nullable=False),
        sa.Column("position_key", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("definition", sa.JSON(), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "game_id", "ply", "generator_version"),
    )
    op.create_index("ix_game_puzzles_user_id", "game_puzzles", ["user_id"])
    op.create_index("ix_game_puzzles_game_id", "game_puzzles", ["game_id"])
    op.create_index("ix_game_puzzles_position_key", "game_puzzles", ["position_key"])
    op.create_index("ix_game_puzzles_status", "game_puzzles", ["status"])


def downgrade():
    op.drop_table("game_puzzles")
    op.drop_table("game_puzzle_searches")
    with op.batch_alter_table("analysis_jobs") as batch:
        batch.drop_column("puzzles_found")
