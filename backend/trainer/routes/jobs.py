"""Saved job progress and cancellation/retry controls."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from trainer.contracts.common import JobStatus
from trainer.contracts.jobs import Job
from trainer.game_providers import get_provider
from trainer.models import AnalysisJob, ClassificationTask, ProviderImport
from trainer.workspaces import CurrentWorkspace


def create_router(*, runner) -> APIRouter:
    router = APIRouter()

    @router.get("/api/jobs", response_model=list[Job], response_model_exclude_unset=True)
    def jobs(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            rows = db.scalars(
                select(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(50)
            ).all()
            sources = {
                source.job_id: source
                for source in db.scalars(
                    select(ProviderImport).where(
                        ProviderImport.job_id.in_([row.id for row in rows])
                    )
                )
            }
            return [
                {c.name: getattr(row, c.name) for c in AnalysisJob.__table__.columns}
                | {
                    "probe_total": db.scalar(
                        select(func.count())
                        .select_from(ClassificationTask)
                        .where(ClassificationTask.job_id == row.id)
                    )
                    if row.kind == "enrichment"
                    else None,
                    "activity": runner.activity(row.id),
                    "provider_import": {
                        c.name: getattr(sources[row.id], c.name)
                        for c in ProviderImport.__table__.columns
                    }
                    | {"provider_name": get_provider(sources[row.id].provider).name}
                    if row.id in sources
                    else None,
                    "chesscom": {
                        c.name: getattr(sources[row.id], c.name)
                        for c in ProviderImport.__table__.columns
                    }
                    if row.id in sources and sources[row.id].provider == "chesscom"
                    else None,
                }
                for row in rows
            ]

    @router.post(
        "/api/jobs/{job_id}/cancel", response_model=JobStatus, response_model_exclude_unset=True
    )
    def cancel_job(workspace: CurrentWorkspace, job_id: str):
        with workspace.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            if job is None:
                raise HTTPException(404, "Job not found")
            if job.status in {"queued", "running"}:
                job.cancel_requested = True
                if job.status == "queued":
                    job.status = "cancelled"
                db.commit()
            return {"status": job.status}

    @router.post(
        "/api/jobs/{job_id}/retry", response_model=JobStatus, response_model_exclude_unset=True
    )
    def retry_job(workspace: CurrentWorkspace, job_id: str):
        with workspace.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            if job is None:
                raise HTTPException(404, "Job not found")
            if job.kind == "teaching":
                raise HTTPException(410, "Model teaching generation has been removed.")
            if job.status not in {"failed", "cancelled"}:
                raise HTTPException(409, "Only failed or cancelled jobs can be retried")
            job.status, job.cancel_requested, job.error = "queued", False, None
            db.commit()
            return {"status": job.status}

    return router
