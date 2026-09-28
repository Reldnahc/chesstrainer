"""Provider-neutral imports and account-owned connections in the existing database."""

import sqlalchemy as sa
from alembic import op

revision = "38db246ec907"
down_revision = "21f2bf8ba641"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "chesscom_imports",
        sa.Column("provider", sa.String(), nullable=False, server_default="chesscom"),
    )
    op.create_table(
        "provider_connections",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("provider", sa.String(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False),
    )
    op.execute(
        "INSERT INTO provider_connections (user_id, provider, username) SELECT id, 'chesscom', chesscom_username FROM users WHERE chesscom_username != ''"
    )


def downgrade():
    op.drop_table("provider_connections")
    with op.batch_alter_table("chesscom_imports") as batch:
        batch.drop_column("provider")
