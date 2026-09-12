"""Persist automatic review retirement without deleting scheduling history."""

from alembic import op
import sqlalchemy as sa

revision = "a38d721c4f90"
down_revision = "92f71bce490a"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("srs_states", sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("srs_states", sa.Column("retired_interval_days", sa.Float(), nullable=True))


def downgrade():
    op.drop_column("srs_states", "retired_interval_days")
    op.drop_column("srs_states", "retired_at")
