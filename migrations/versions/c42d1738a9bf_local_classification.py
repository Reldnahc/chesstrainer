"""Preserve historical audits while moving classification to local rules."""

from alembic import op

revision = "c42d1738a9bf"
down_revision = "b91a0673de42"
branch_labels = None
depends_on = None


def upgrade():
    # Native renames preserve referring FKs, row IDs and historical course snapshots.
    op.execute("ALTER TABLE llm_runs RENAME TO classification_runs")
    op.execute("ALTER TABLE skill_evidence RENAME COLUMN llm_run_id TO classification_run_id")
    op.execute(
        "ALTER TABLE classification_runs ADD COLUMN provider VARCHAR NOT NULL DEFAULT 'legacy_llm'"
    )
    op.execute(
        "ALTER TABLE classification_runs ADD COLUMN version VARCHAR NOT NULL DEFAULT 'legacy'"
    )
    # Keep historical evidence, but do not present old model labels as local findings.
    op.execute("UPDATE skill_evidence SET active = 0")
    op.execute(
        "UPDATE analysis_jobs SET status = 'cancelled', cancel_requested = 1, error = 'Model teaching generation was removed; historical results are preserved.' WHERE kind = 'teaching' AND status IN ('queued', 'running')"
    )


def downgrade():
    op.drop_column("classification_runs", "version")
    op.drop_column("classification_runs", "provider")
    op.execute("ALTER TABLE skill_evidence RENAME COLUMN classification_run_id TO llm_run_id")
    op.execute("ALTER TABLE classification_runs RENAME TO llm_runs")
