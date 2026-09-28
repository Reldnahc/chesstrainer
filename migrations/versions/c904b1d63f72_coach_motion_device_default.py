"""Follow device motion preferences until an account chooses an override."""

import sqlalchemy as sa
from alembic import op

revision = "c904b1d63f72"
down_revision = "55de0b7b8ff2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("user_preferences") as batch:
        batch.alter_column("coach_motion", existing_type=sa.String(), server_default="system")


def downgrade():
    op.execute("UPDATE user_preferences SET coach_motion = 'natural' WHERE coach_motion = 'system'")
    with op.batch_alter_table("user_preferences") as batch:
        batch.alter_column("coach_motion", existing_type=sa.String(), server_default="natural")
