"""Account-owned puzzle practice snapshots and idempotent attempts."""

import sqlalchemy as sa
from alembic import op

revision = "5a027cd180b4"
down_revision = "49e862bc710a"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "puzzle_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("provider_id", sa.String(), nullable=False),
        sa.Column("puzzle_key", sa.String(), nullable=False),
        sa.Column("definition_version", sa.String(), nullable=False),
        sa.Column("puzzle_source", sa.String(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("failed", sa.Boolean(), nullable=False),
        sa.Column("first_response_ms", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "request_id"),
    )
    op.create_index("ix_puzzle_sessions_user_id", "puzzle_sessions", ["user_id"])
    op.create_table(
        "puzzle_attempts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("session_id", sa.String(), sa.ForeignKey("puzzle_sessions.id"), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False),
        sa.Column("uci", sa.String(), nullable=True),
        sa.Column("grade", sa.String(), nullable=False),
        sa.Column("elapsed_ms", sa.Integer(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("session_id", "request_id"),
    )
    op.create_index("ix_puzzle_attempts_user_id", "puzzle_attempts", ["user_id"])
    op.create_index("ix_puzzle_attempts_session_id", "puzzle_attempts", ["session_id"])


def downgrade():
    op.drop_table("puzzle_attempts")
    op.drop_table("puzzle_sessions")
