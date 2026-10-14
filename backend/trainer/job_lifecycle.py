"""Job kinds, statuses and every state change a job goes through.

Routes, the queue, execution, sync and account administration all change job
state through these functions, so "retry" or "requeue" means the same thing
wherever it happens.
"""

from enum import StrEnum

from sqlalchemy import select

from trainer.errors import Conflict
from trainer.models import AnalysisJob


class JobKind(StrEnum):
    GAME_REVIEW = "game_review"  # One game: review, then training decisions.
    CLASSIFICATION = "classification"  # Re-label every saved decision.
    ENRICHMENT = "enrichment"  # Extra engine probes for unsettled classifications.
    PUZZLE_GENERATION = "puzzle_generation"  # Mine analyzed games for puzzles.
    SYNC = "sync"  # The poller's fetch of new provider games.
    CHESSCOM_FETCH = "chesscom_fetch"  # A manual Chess.com import.
    PROVIDER_FETCH = "provider_fetch"  # A manual import from another provider.
    LEVEL_FIT = "level_fit"  # Measure the learner's level for Play from their games.
    # Whole-import analysis from before per-game reviews. Nothing creates it now;
    # rows saved by older versions still run to completion.
    ANALYSIS = "analysis"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Fetches run in their own lane, so imports never wait behind analysis.
FETCH_KINDS = frozenset({JobKind.SYNC, JobKind.CHESSCOM_FETCH, JobKind.PROVIDER_FETCH})
ACTIVE = (JobStatus.QUEUED, JobStatus.RUNNING)
RETRYABLE = (JobStatus.FAILED, JobStatus.CANCELLED)
PROGRESS = (
    "games_processed",
    "positions_triaged",
    "deep_completed",
    "mistakes_identified",
    "classifications_completed",
)


def active_job(db, kind, *criteria):
    """This account's queued or running job of ``kind`` matching ``criteria``, if any."""
    return db.scalar(
        select(AnalysisJob)
        .where(AnalysisJob.kind == kind, AnalysisJob.status.in_(ACTIVE), *criteria)
        .order_by(AnalysisJob.created_at.desc())
        .limit(1)
    )


def ensure_job(db, kind, *criteria, **values):
    """Queue a job of ``kind`` unless one matching ``criteria`` is already active.

    Returns ``(job, created)``; a new job is added and flushed, not committed.
    """
    existing = active_job(db, kind, *criteria)
    if existing is not None:
        return existing, False
    job = AnalysisJob(kind=kind, **values)
    db.add(job)
    db.flush()
    return job, True


def requeue(job, *, reset_progress=False):
    """Put a job back in the queue as if new; its saved work stays."""
    job.status, job.cancel_requested, job.error = JobStatus.QUEUED, False, None
    if reset_progress:
        for name in PROGRESS:
            setattr(job, name, 0)


def retry(job):
    """The learner's retry of a failed or cancelled job."""
    if job.status not in RETRYABLE:
        raise Conflict("Only failed or cancelled jobs can be retried")
    requeue(job)


def request_cancel(job):
    """Cancel a queued job at once; a running one stops at its next checkpoint."""
    if job.status in ACTIVE:
        job.cancel_requested = True
        if job.status == JobStatus.QUEUED:
            job.status = JobStatus.CANCELLED


def start(job):
    """A claimed job starts with clean counters; returns False when it was cancelled first."""
    if job.cancel_requested:
        job.status = JobStatus.CANCELLED
        return False
    job.status, job.error = JobStatus.RUNNING, None
    for name in PROGRESS:
        setattr(job, name, 0)
    return True


def complete(job):
    job.status = JobStatus.COMPLETED


def finish_cancel(job):
    """A running job stopped: cancelled if the learner asked, otherwise back in the queue."""
    job.status = JobStatus.CANCELLED if job.cancel_requested else JobStatus.QUEUED


def fail(job, message):
    job.status, job.error = JobStatus.FAILED, message
