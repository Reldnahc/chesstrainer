"""Name the Lichess import limits after Lichess.

provider_timeout_seconds, provider_max_response_bytes and provider_max_scan_games
only ever applied to Lichess, beside chesscom_* settings for Chess.com. Saved
values move to the new names; the old environment names are still read.
"""

from alembic import op

revision = "3613644faa1d"
down_revision = "747b84117a4e"
branch_labels = None
depends_on = None

RENAMED = {
    "provider_timeout_seconds": "lichess_timeout_seconds",
    "provider_max_response_bytes": "lichess_max_response_bytes",
    "provider_max_scan_games": "lichess_max_scan_games",
}


def rename(pairs):
    for old, new in pairs:
        op.get_bind().exec_driver_sql("UPDATE site_settings SET key = ? WHERE key = ?", (new, old))


def upgrade():
    rename(RENAMED.items())


def downgrade():
    rename((new, old) for old, new in RENAMED.items())
