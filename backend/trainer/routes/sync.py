"""Lightweight recent-game synchronization, independent of engine jobs."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select

from trainer.models import AnalysisJob, ChessComArchive, ChessComImport, User, now
from trainer.workspaces import CurrentWorkspace


def create_router():
    router = APIRouter()

    def connection(db):
        user = db.scalar(select(User))
        name = user.chesscom_username if user else ""
        job = (
            db.scalar(
                select(AnalysisJob)
                .join(ChessComImport)
                .where(
                    AnalysisJob.kind == "sync",
                    ChessComImport.username == name,
                )
                .order_by(AnalysisJob.created_at.desc())
            )
            if name
            else None
        )
        return name, job

    def status(db, name, job):
        source = db.get(ChessComImport, job.id) if job else None
        return {
            "username": name,
            "job_id": job.id if job else None,
            "status": job.status if job else "not_started",
            "checked_at": job.created_at.replace(tzinfo=timezone.utc).isoformat() if job else None,
            "imported": source.games_imported if source else 0,
            "error": job.error if job else None,
        }

    @router.get("/api/sync")
    def get_sync(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return status(db, *connection(db))

    @router.post("/api/sync", status_code=202)
    def begin_sync(workspace: CurrentWorkspace):
        with workspace.mutation_lock, workspace.sessions() as db:
            name, job = connection(db)
            if not name:
                raise HTTPException(422, "Save your Chess.com username first.")
            if job:
                age = (
                    datetime.now(timezone.utc) - job.created_at.replace(tzinfo=timezone.utc)
                ).total_seconds()
                if job.status in {"queued", "running"} or age < 60:
                    return status(db, name, job)
                # Reuse this account's sync checkpoint instead of accumulating a job
                # and duplicate raw PGN archive on every periodic refresh.
                db.execute(delete(ChessComArchive).where(ChessComArchive.job_id == job.id))
                source = db.get(ChessComImport, job.id)
                source.fetch_completed = False
                source.errors = []
                for key in (
                    "archives_total",
                    "archives_processed",
                    "games_fetched",
                    "games_imported",
                    "duplicates",
                    "filtered",
                    "rejected",
                ):
                    setattr(source, key, 0)
                job.status, job.cancel_requested, job.error = "queued", False, None
                job.created_at = now()
            else:
                job = AnalysisJob(kind="sync")
                db.add(job)
                db.flush()
                db.add(
                    ChessComImport(
                        job_id=job.id, username=name, time_class="all", months=2, max_games=50
                    )
                )
            db.commit()
            return status(db, name, job)

    return router
