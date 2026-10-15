"""Saved job progress and cancellation/retry controls."""

from fastapi import APIRouter
from sqlalchemy import func, select

from trainer import job_lifecycle
from trainer.contracts.common import JobStatus, from_row
from trainer.contracts.jobs import AnalysisQueue, Job, ProviderImportProgress
from trainer.errors import Gone, NotFound
from trainer.game_analysis import BACKFILL, FRESH, REQUESTED
from trainer.game_providers import get_provider
from trainer.job_lifecycle import JobKind
from trainer.job_lifecycle import JobStatus as JS
from trainer.models import AnalysisJob, ClassificationTask, Game, GameReview, ProviderImport
from trainer.workspaces import CurrentWorkspace


def create_router(*, runner) -> APIRouter:
    router = APIRouter()

    @router.get("/api/jobs", response_model=list[Job], response_model_exclude_unset=True)
    def jobs(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            # Per-game analysis has its own summary below and the level fit shows in Play;
            # either would crowd out imports here.
            rows = db.scalars(
                select(AnalysisJob)
                .where(AnalysisJob.kind.not_in([JobKind.GAME_REVIEW, JobKind.LEVEL_FIT]))
                .order_by(AnalysisJob.created_at.desc())
                .limit(50)
            ).all()
            ids = [row.id for row in rows]
            sources = {
                source.job_id: source
                for source in db.scalars(
                    select(ProviderImport).where(ProviderImport.job_id.in_(ids))
                )
            }
            probes = dict(
                db.execute(
                    select(ClassificationTask.job_id, func.count())
                    .where(ClassificationTask.job_id.in_(ids))
                    .group_by(ClassificationTask.job_id)
                ).all()
            )

            def provider_import(source):
                return from_row(
                    ProviderImportProgress,
                    source,
                    provider_name=get_provider(source.provider).name,
                )

            return [
                from_row(
                    Job,
                    row,
                    probe_total=probes.get(row.id, 0) if row.kind == JobKind.ENRICHMENT else None,
                    activity=runner.activity(row.id),
                    provider_import=provider_import(sources[row.id]) if row.id in sources else None,
                )
                for row in rows
            ]

    @router.get("/api/analysis/queue", response_model=AnalysisQueue)
    def analysis_queue(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            counts = {
                (status, priority): count
                for status, priority, count in db.execute(
                    select(AnalysisJob.status, AnalysisJob.priority, func.count())
                    .where(AnalysisJob.kind == JobKind.GAME_REVIEW)
                    .group_by(AnalysisJob.status, AnalysisJob.priority)
                )
            }
            running = db.scalar(
                select(Game)
                .join(GameReview, GameReview.game_id == Game.id)
                .join(AnalysisJob, AnalysisJob.id == GameReview.job_id)
                .where(AnalysisJob.status == JS.RUNNING)
            )

            def total(status, level=None):
                return sum(
                    count
                    for (state, priority), count in counts.items()
                    if state == status and (level is None or priority == level)
                )

            return {
                "running": {
                    "id": running.id,
                    "white": running.white,
                    "black": running.black,
                    "played_at": running.played_at,
                }
                if running
                else None,
                "requested": total(JS.QUEUED, REQUESTED),
                "fresh": total(JS.QUEUED, FRESH),
                "backfill": total(JS.QUEUED, BACKFILL),
                "completed": total(JS.COMPLETED),
                "failed": total(JS.FAILED),
            }

    def require_job(db, job_id):
        job = db.get(AnalysisJob, job_id)
        if job is None:
            raise NotFound("Job not found")
        return job

    @router.post(
        "/api/jobs/{job_id}/cancel", response_model=JobStatus, response_model_exclude_unset=True
    )
    def cancel_job(workspace: CurrentWorkspace, job_id: str):
        with workspace.sessions() as db:
            job = require_job(db, job_id)
            job_lifecycle.request_cancel(job)
            db.commit()
            return {"status": job.status}

    @router.post(
        "/api/jobs/{job_id}/retry", response_model=JobStatus, response_model_exclude_unset=True
    )
    def retry_job(workspace: CurrentWorkspace, job_id: str):
        with workspace.sessions() as db:
            job = require_job(db, job_id)
            if job.kind not in JobKind:
                raise Gone("This kind of job has been removed.")
            job_lifecycle.retry(job)
            db.commit()
            return {"status": job.status}

    return router
