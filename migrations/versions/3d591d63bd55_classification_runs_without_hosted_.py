"""Drop the hosted-model fields from classification runs.

Classification has one classifier, the local rules, which sends no prompt and
spends no tokens. ``prompt_version`` and the two token counts were left from the
hosted-model contract; every row the local rules wrote holds "1" and zeros.
"""

import sqlalchemy as sa
from alembic import op

revision = "3d591d63bd55"
down_revision = "ed09d7e2cdb8"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("classification_runs") as batch:
        batch.drop_column("prompt_version")
        batch.drop_column("input_tokens")
        batch.drop_column("output_tokens")


def downgrade():
    with op.batch_alter_table("classification_runs") as batch:
        batch.add_column(
            sa.Column("prompt_version", sa.String(), nullable=False, server_default="1")
        )
        batch.add_column(
            sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0")
        )
        batch.add_column(
            sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0")
        )
