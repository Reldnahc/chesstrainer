"""Automatic game analysis: job priority, polling change state and account presence."""

import sqlalchemy as sa
from alembic import op

revision = "c3d5e7f9a1b2"
down_revision = "b7c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade():
    # Existing jobs were all started by the learner, so they keep the top level.
    op.add_column(
        "analysis_jobs",
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "provider_connections",
        sa.Column("poll_state", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("away_since", sa.DateTime(timezone=True), nullable=True))
    # Everyone counts as present at upgrade, so nobody's polling pauses immediately.
    op.execute(sa.text("UPDATE users SET last_seen_at = CURRENT_TIMESTAMP"))


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("away_since")
        batch.drop_column("last_seen_at")
    with op.batch_alter_table("provider_connections") as batch:
        batch.drop_column("poll_state")
    with op.batch_alter_table("analysis_jobs") as batch:
        batch.drop_column("priority")
