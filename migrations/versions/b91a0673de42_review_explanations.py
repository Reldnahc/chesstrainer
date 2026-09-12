"""Link review sessions to their exact latest submitted attempt."""

from alembic import op

revision = "b91a0673de42"
down_revision = "a38d721c4f90"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE review_sessions ADD COLUMN last_attempt_id VARCHAR REFERENCES exercise_attempts(id)"
    )


def downgrade():
    op.drop_column("review_sessions", "last_attempt_id")
