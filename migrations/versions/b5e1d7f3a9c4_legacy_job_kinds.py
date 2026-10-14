"""Rename retired job kinds to the kinds that now run the same work.

Older versions queued "chesscom" and "provider_import" jobs, which fetched like
today's manual imports, and "training" jobs, which analysed one import like the
legacy "analysis" kind. Renaming them keeps job kinds a closed set, and a saved
row of either old fetch kind now runs in the fetch lane instead of the analysis one.
"""

from alembic import op

revision = "b5e1d7f3a9c4"
down_revision = "a7d3e9b1c5f2"
branch_labels = None
depends_on = None

RENAMED = {
    "chesscom": "chesscom_fetch",
    "provider_import": "provider_fetch",
    "training": "analysis",
}


def upgrade():
    for old, new in RENAMED.items():
        op.get_bind().exec_driver_sql(
            "UPDATE analysis_jobs SET kind = ? WHERE kind = ?", (new, old)
        )


def downgrade():
    pass  # The old kinds ran the same work; nothing depends on telling them apart.
