"""Share Maia predictions between accounts, like the Stockfish cache.

A prediction depends only on the game (moves, PGN ratings, provider), so two
members who import the same game no longer pay for it twice. Duplicate rows
saved by different accounts are merged into the oldest, and review moves are
repointed to it. Migrations run with foreign keys off, so the table rebuild
keeps game_review_moves.human_analysis_id pointing at the same table name.
"""

import uuid

import sqlalchemy as sa
from alembic import op

revision = "1c26d1ef1233"
down_revision = "e2a4c6b8d0f1"
branch_labels = None
depends_on = None

COLUMNS = "id, cache_key, request, policy, created_at"


def upgrade():
    bind = op.get_bind()
    rows = bind.exec_driver_sql(
        "SELECT id, cache_key FROM human_analyses ORDER BY cache_key, created_at, id"
    )
    keep, merged = {}, {}
    for row_id, key in rows:
        if key in keep:
            merged[row_id] = keep[key]
        else:
            keep[key] = row_id
    for duplicate, kept in merged.items():
        bind.exec_driver_sql(
            "UPDATE game_review_moves SET human_analysis_id = ? WHERE human_analysis_id = ?",
            (kept, duplicate),
        )
        bind.exec_driver_sql("DELETE FROM human_analyses WHERE id = ?", (duplicate,))
    op.create_table(
        "human_analyses_shared",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("cache_key", sa.String(), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("policy", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("cache_key"),
    )
    op.execute(
        f"INSERT INTO human_analyses_shared ({COLUMNS}) SELECT {COLUMNS} FROM human_analyses"
    )
    op.drop_table("human_analyses")
    op.execute("ALTER TABLE human_analyses_shared RENAME TO human_analyses")


def downgrade():
    bind = op.get_bind()
    op.create_table(
        "human_analyses_owned",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("cache_key", sa.String(), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("policy", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "cache_key"),
    )
    # Give each account that references a shared row its own copy.
    owners = bind.exec_driver_sql(
        "SELECT DISTINCT human_analysis_id, user_id FROM game_review_moves"
        " WHERE human_analysis_id IS NOT NULL ORDER BY human_analysis_id, user_id"
    ).fetchall()
    first = {}
    for row_id, owner in owners:
        if row_id not in first:
            first[row_id] = owner
            new_id = row_id
        else:
            new_id = uuid.uuid4().hex
            bind.exec_driver_sql(
                "UPDATE game_review_moves SET human_analysis_id = ?"
                " WHERE human_analysis_id = ? AND user_id = ?",
                (new_id, row_id, owner),
            )
        bind.exec_driver_sql(
            f"INSERT INTO human_analyses_owned (user_id, {COLUMNS})"
            f" SELECT ?, ?, cache_key, request, policy, created_at FROM human_analyses"
            " WHERE id = ?",
            (owner, new_id, row_id),
        )
    # Unreferenced rows are only a cache; they go back to the local account.
    bind.exec_driver_sql(
        f"INSERT INTO human_analyses_owned (user_id, {COLUMNS})"
        f" SELECT 'local', {COLUMNS} FROM human_analyses"
        " WHERE id NOT IN (SELECT id FROM human_analyses_owned)"
        " AND cache_key NOT IN (SELECT cache_key FROM human_analyses_owned"
        " WHERE user_id = 'local')"
    )
    op.drop_table("human_analyses")
    op.execute("ALTER TABLE human_analyses_owned RENAME TO human_analyses")
    op.create_index("ix_human_analyses_user_id", "human_analyses", ["user_id"])
    op.create_index("ix_human_analyses_cache_key", "human_analyses", ["cache_key"])
