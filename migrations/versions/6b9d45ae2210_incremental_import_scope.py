"""Persist whether an import introduced a game, separately from provenance."""

import sqlalchemy as sa
from alembic import op

revision = "6b9d45ae2210"
down_revision = "1c14f367bbe8"
branch_labels = None
depends_on = None


def upgrade():
    # Keep existing job scopes intact so interrupted imports can still resume.
    op.add_column(
        "import_games", sa.Column("is_new", sa.Boolean(), nullable=False, server_default="1")
    )


def downgrade():
    with op.batch_alter_table("import_games") as batch:
        batch.drop_column("is_new")
