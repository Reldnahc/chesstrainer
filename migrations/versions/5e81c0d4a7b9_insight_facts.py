"""Save each game's Insights facts, so a library is replayed once rather than per request."""

import sqlalchemy as sa
from alembic import op

revision = "5e81c0d4a7b9"
down_revision = "832f7adbe6f5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "insight_facts",
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("facts", sa.LargeBinary(), nullable=False),
    )
    op.create_index("ix_insight_facts_user_id", "insight_facts", ["user_id"])


def downgrade():
    op.drop_index("ix_insight_facts_user_id", table_name="insight_facts")
    op.drop_table("insight_facts")
