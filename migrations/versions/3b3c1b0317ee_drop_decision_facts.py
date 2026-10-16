"""Drop decisions.facts: the replayed board facts were never read.

Nothing in the classifier, the API or the frontend used them (backend audit
finding 43), so analysis no longer replays every principal variation to build them.
"""

import sqlalchemy as sa
from alembic import op

revision = "3b3c1b0317ee"
down_revision = "3d591d63bd55"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("decisions") as batch:
        batch.drop_column("facts")


def downgrade():
    op.add_column(
        "decisions",
        sa.Column("facts", sa.JSON(), nullable=False, server_default="{}"),
    )
