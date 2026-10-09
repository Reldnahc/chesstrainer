"""Opening practice: a play game can follow a Lessons course's repertoire as its book."""

import sqlalchemy as sa
from alembic import op

revision = "d4e6f8a0b2c4"
down_revision = "0dc741d4af1f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("play_games", sa.Column("practice", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("play_games") as batch:
        batch.drop_column("practice")
