"""Release positions withheld by the removed lesson flow; preserve recall history."""

from alembic import op

revision = "d17b63e02a48"
down_revision = "c42d1738a9bf"
branch_labels = None
depends_on = None


def upgrade():
    # Eligibility is the only changed field. Do not reset due dates, FSRS or retirement.
    op.execute(
        "UPDATE srs_states SET eligible = 1 "
        "WHERE eligible = 0 AND retired_at IS NULL "
        "AND exercise_id IN (SELECT exercise_id FROM lesson_items)"
    )


def downgrade():
    # Re-hiding cards would lose access to practice that may have happened since release.
    pass
