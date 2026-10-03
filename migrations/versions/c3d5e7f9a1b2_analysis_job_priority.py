"""Order analysis jobs so freshly played games run before older backfill."""

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


def downgrade():
    with op.batch_alter_table("analysis_jobs") as batch:
        batch.drop_column("priority")
