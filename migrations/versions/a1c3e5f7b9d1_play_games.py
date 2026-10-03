"""Games against the coach's bot and the per-account level fit."""

import sqlalchemy as sa
from alembic import op

revision = "a1c3e5f7b9d1"
down_revision = "c7e2a9f4b1d3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "play_games",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("coach_id", sa.String(), nullable=False),
        sa.Column("coach_name", sa.String(), nullable=False),
        sa.Column("learner_color", sa.Boolean(), nullable=False),
        sa.Column("opponent_kind", sa.String(), nullable=False),
        sa.Column("opponent_rating", sa.Integer(), nullable=False),
        sa.Column("learner_rating", sa.Integer(), nullable=False),
        sa.Column("commentary", sa.String(), nullable=False),
        sa.Column("moves", sa.JSON(), nullable=False),
        sa.Column("reports", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("result", sa.String(), nullable=True),
        sa.Column("termination", sa.String(), nullable=True),
        sa.Column("saved_game_id", sa.String(), sa.ForeignKey("games.id"), nullable=True),
        sa.Column("losing_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("draw_declined", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_play_games_user_id", "play_games", ["user_id"])
    op.create_index("ix_play_games_status", "play_games", ["status"])
    op.create_table(
        "play_profiles",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("fitted_rating", sa.Integer(), nullable=True),
        sa.Column("platform_rating", sa.Integer(), nullable=True),
        sa.Column("platform", sa.String(), nullable=True),
        sa.Column("positions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("configuration_key", sa.String(), nullable=False, server_default=""),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("play_profiles")
    op.drop_index("ix_play_games_status", table_name="play_games")
    op.drop_index("ix_play_games_user_id", table_name="play_games")
    op.drop_table("play_games")
