"""Connected accounts are polled by the server; new games queue their own analysis."""

import logging
import time
from datetime import datetime, timezone

from sqlalchemy import delete, select

from trainer.game_providers.base import ProviderRateLimited
from trainer.models import AnalysisJob, ProviderCheckpoint, ProviderConnection, ProviderImport, now

log = logging.getLogger(__name__)


# A sync reads the newest games, whatever month they were played in.
def sync_scope(settings):
    return {"time_class": "all", "months": 0, "max_games": settings.sync_games}


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


def queue_sync(db, provider, settings, *, min_age=60):
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
        for key, value in sync_scope(settings).items():
            setattr(source, key, value)
        job.status, job.cancel_requested, job.error = "queued", False, None
        job.created_at = now()
    else:
        job = AnalysisJob(kind="sync")
        db.add(job)
        db.flush()
        db.add(
            ProviderImport(job_id=job.id, provider=provider, username=name, **sync_scope(settings))
        )
    db.commit()
    return job


def poll(runner, owners):
    """One polling round: ask each provider what changed, then sync only those.

    Provider traffic stays serial under the runner's host-wide provider lock,
    and a provider that rate limited us is skipped until its cooldown ends.
    """
    connections = {}  # provider -> {username: [(owner, poll_state), ...]}
    for owner in owners:
        try:
            with runner.workspaces.open(owner) as workspace, workspace.sessions() as db:
                for row in db.scalars(
                    select(ProviderConnection).where(ProviderConnection.username != "")
                ):
                    users = connections.setdefault(row.provider, {})
                    users.setdefault(row.username, []).append((owner, dict(row.poll_state or {})))
        except Exception:
            log.exception("sync_poll_failed", extra={"user_id": owner})
    for provider, users in connections.items():
        try:
            changes = detect(runner, provider, users)
        except Exception:
            log.exception("sync_change_check_failed", extra={"provider": provider})
            continue
        for name, (changed, state) in changes.items():
            for owner, _previous in users[name]:
                try:
                    record(runner, owner, provider, state, changed)
                except Exception:
                    log.exception("sync_poll_failed", extra={"user_id": owner})


def detect(runner, provider, users):
    if time.monotonic() < runner.provider_retry_at.get(provider, 0):
        return {}
    states = {name: owned[0][1] for name, owned in users.items()}
    with runner.provider_lock:
        client = runner.provider_factories[provider](runner.settings)
        try:
            results = client.changed(list(users), states)
        except ProviderRateLimited as exc:
            runner.provider_retry_at[provider] = time.monotonic() + exc.retry_after
            raise
        finally:
            client.close()
    return results


def record(runner, owner, provider, state, changed):
    with runner.workspaces.open(owner) as workspace:
        with workspace.mutation_lock, workspace.sessions() as db:
            row = db.get(ProviderConnection, (owner, provider))
            if row is None:
                return
            row.poll_state = state
            db.commit()
            if changed:
                queue_sync(db, provider, runner.settings, min_age=0)
