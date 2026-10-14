"""Every job state change goes through trainer.job_lifecycle."""

import pytest
from trainer import job_lifecycle
from trainer.errors import Conflict
from trainer.job_lifecycle import JobKind, JobStatus
from trainer.models import AnalysisJob


def job(**values):
    return AnalysisJob(kind=JobKind.CLASSIFICATION, **{"cancel_requested": False, **values})


def test_retry_requeues_only_failed_or_cancelled_jobs():
    failed = job(status=JobStatus.FAILED, error="Engine stopped")
    job_lifecycle.retry(failed)
    assert (failed.status, failed.error, failed.cancel_requested) == ("queued", None, False)
    with pytest.raises(Conflict):
        job_lifecycle.retry(job(status=JobStatus.RUNNING))


def test_cancel_stops_a_queued_job_now_and_a_running_one_at_its_checkpoint():
    queued, running = job(status=JobStatus.QUEUED), job(status=JobStatus.RUNNING)
    job_lifecycle.request_cancel(queued)
    job_lifecycle.request_cancel(running)
    assert (queued.status, queued.cancel_requested) == ("cancelled", True)
    assert (running.status, running.cancel_requested) == ("running", True)
    job_lifecycle.finish_cancel(running)
    assert running.status == "cancelled"
    interrupted = job(status=JobStatus.RUNNING)
    job_lifecycle.finish_cancel(interrupted)
    assert interrupted.status == "queued"  # Stopped by shutdown, not by the learner.


def test_a_claimed_job_starts_with_clean_counters_unless_cancelled_first():
    claimed = job(status=JobStatus.QUEUED, error="old", positions_triaged=7, games_processed=2)
    assert job_lifecycle.start(claimed)
    assert (claimed.status, claimed.error, claimed.positions_triaged) == ("running", None, 0)
    cancelled = job(status=JobStatus.QUEUED, cancel_requested=True)
    assert not job_lifecycle.start(cancelled) and cancelled.status == "cancelled"


def test_ensure_job_reuses_an_active_job(sessions):
    with sessions() as db:
        first, created = job_lifecycle.ensure_job(db, JobKind.ENRICHMENT)
        again, created_again = job_lifecycle.ensure_job(db, JobKind.ENRICHMENT)
        assert created and not created_again and again.id == first.id
        first.status = JobStatus.COMPLETED
        fresh, created = job_lifecycle.ensure_job(db, JobKind.ENRICHMENT)
        assert created and fresh.id != first.id
