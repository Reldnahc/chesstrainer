"""Retire two legacy shapes: the Chess.com-only job kind and Play's old book field.

A manual Chess.com import was its own "chesscom_fetch" kind, left from the
Chess.com-only importer, while every other provider used "provider_fetch"; both
ran the same work, and the job's provider_imports row names the provider. Saved
Chess.com import jobs become "provider_fetch", and the kind CHECK no longer allows
the old name.

Opening-practice games started before "Show book move" kept the off-book spot's
book moves as ``practice.deviation.book_uci``; they move to ``practice.book_moves``,
where every newer game keeps them, so the reader needs no fallback.
"""

import json

from alembic import op

revision = "ed09d7e2cdb8"
down_revision = "eb978e634f57"
branch_labels = None
depends_on = None

# trainer.job_kinds as of this revision.
KINDS = (
    "game_review",
    "classification",
    "enrichment",
    "puzzle_generation",
    "sync",
    "provider_fetch",
    "level_fit",
    "analysis",
    "retired",
)


def _kinds(kinds):
    with op.batch_alter_table("analysis_jobs") as batch:
        batch.drop_constraint(op.f("ck_analysis_jobs_kind"), type_="check")
        batch.create_check_constraint(
            op.f("ck_analysis_jobs_kind"), f"kind IN ({', '.join(repr(kind) for kind in kinds)})"
        )


def upgrade():
    db = op.get_bind()
    db.exec_driver_sql(
        "UPDATE analysis_jobs SET kind = 'provider_fetch' WHERE kind = 'chesscom_fetch'"
    )
    _kinds(KINDS)
    rows = db.exec_driver_sql(
        "SELECT id, practice FROM play_games WHERE practice LIKE '%book_uci%'"
    ).all()
    for game_id, text in rows:
        practice = json.loads(text)
        deviation = practice.get("deviation") or {}
        if "book_uci" not in deviation:
            continue
        legacy = deviation.pop("book_uci")
        if not practice.get("book_moves"):
            practice["book_moves"] = legacy or []
        db.exec_driver_sql(
            "UPDATE play_games SET practice = ? WHERE id = ?", (json.dumps(practice), game_id)
        )


def downgrade():
    # The old kind ran the same work, so the jobs keep the new name; the CHECK
    # allows the old one again, as the previous revision expects.
    _kinds((*KINDS[:5], "chesscom_fetch", *KINDS[5:]))
