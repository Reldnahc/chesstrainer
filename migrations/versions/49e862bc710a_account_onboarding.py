"""One-time onboarding for newly created accounts; existing users are complete."""

import sqlalchemy as sa
from alembic import op

revision = "49e862bc710a"
down_revision = "38db246ec907"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users", sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default="0")
    )
    op.execute("UPDATE users SET onboarding_completed=1")


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("onboarding_completed")
