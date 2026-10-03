"""Connected accounts are polled by the server; new games queue their own analysis."""

import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select

from trainer.game_analysis import RECENT_GAMES
from trainer.models import AnalysisJob, ProviderCheckpoint, ProviderConnection, ProviderImport, now

log = logging.getLogger(__name__)

# A sync scans the newest games, whatever month they were played in.
SYNC_SCOPE = {"time_class": "all", "months": 0, "max_games": RECENT_GAMES}
SYNC_COUNTERS = (
    "archives_total",
    "archives_processed",
    "games_fetched",
    "games_imported",
    "duplicates",
    "filtered",
    "rejected",
)


def latest_sync(db, provider, name):
    if not name:
        return None
    return db.scalar(
        select(AnalysisJob)
        .join(ProviderImport)
        .where(
            AnalysisJob.kind == "sync",
            ProviderImport.username == name,
            ProviderImport.provider == provider,
        )
        .order_by(AnalysisJob.created_at.desc())
    )


def connected_username(db, provider):
    saved = db.get(ProviderConnection, (db.info["user_id"], provider))
    return saved.username if saved else ""


def queue_sync(db, provider, *, min_age=60):
    """Queue (or reuse) this account's sync job; returns it, or None if unconnected."""
    name = connected_username(db, provider)
    if not name:
        return None
    job = latest_sync(db, provider, name)
    if job:
        age = (
            datetime.now(timezone.utc) - job.created_at.replace(tzinfo=timezone.utc)
        ).total_seconds()
        if job.status in {"queued", "running"} or age < min_age:
            return job
        # Reuse this account's sync checkpoint instead of accumulating a job
        # and duplicate raw PGN archive on every periodic refresh.
        db.execute(delete(ProviderCheckpoint).where(ProviderCheckpoint.job_id == job.id))
        source = db.get(ProviderImport, job.id)
        source.fetch_completed = False
        source.errors = []
        for key in SYNC_COUNTERS:
            setattr(source, key, 0)
        for key, value in SYNC_SCOPE.items():
            setattr(source, key, value)
        job.status, job.cancel_requested, job.error = "queued", False, None
        job.created_at = now()
    else:
        job = AnalysisJob(kind="sync")
        db.add(job)
        db.flush()
        db.add(ProviderImport(job_id=job.id, provider=provider, username=name, **SYNC_SCOPE))
    db.commit()
    return job


def poll(workspaces, owners, interval):
    """One polling round: queue a sync for every saved connection that is due."""
    for owner in owners:
        try:
            with workspaces.open(owner) as workspace:
                with workspace.mutation_lock, workspace.sessions() as db:
                    providers = db.scalars(
                        select(ProviderConnection.provider).where(ProviderConnection.username != "")
                    ).all()
                    for provider in providers:
                        queue_sync(db, provider, min_age=interval)
        except Exception:
            # One account's failure must not stop polling for the others.
            log.exception("sync_poll_failed", extra={"user_id": owner})
