"""Save each game's mainline half-move count so the library never replays PGNs."""

import sqlalchemy as sa
from alembic import op

revision = "b7c1d2e3f4a5"
down_revision = "93a425f18cb6"
branch_labels = None
depends_on = None


def upgrade():
    # Existing rows stay NULL and are filled the first time they are listed.
    op.add_column("games", sa.Column("move_count", sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table("games") as batch:
        batch.drop_column("move_count")
