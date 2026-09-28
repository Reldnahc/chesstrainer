"""Lightweight recent-game synchronization, independent of engine jobs."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select

from trainer.contracts.accounts import GameProvider, ProviderConnectionRequest, SyncStatus
from trainer.game_providers import PROVIDERS, get_provider
from trainer.game_providers.base import ProviderImportRequest
from trainer.models import AnalysisJob, ProviderCheckpoint, ProviderConnection, ProviderImport, now
from trainer.workspaces import CurrentWorkspace


def create_router():
    router = APIRouter()

    def connection(db, provider="chesscom"):
        saved = db.get(ProviderConnection, (db.info["user_id"], provider))
        name = saved.username if saved else ""
        job = (
            db.scalar(
                select(AnalysisJob)
                .join(ProviderImport)
                .where(
                    AnalysisJob.kind == "sync",
                    ProviderImport.username == name,
                    ProviderImport.provider == provider,
                )
                .order_by(AnalysisJob.created_at.desc())
            )
            if name
            else None
        )
        return name, job

    def status(db, name, job, provider="chesscom"):
        source = db.get(ProviderImport, job.id) if job else None
        return {
            "provider": provider,
            "username": name,
            "job_id": job.id if job else None,
            "status": job.status if job else "not_started",
            "checked_at": job.created_at.replace(tzinfo=timezone.utc).isoformat() if job else None,
            "imported": source.games_imported if source else 0,
            "error": job.error if job else None,
        }

    @router.get("/api/sync", response_model=SyncStatus, response_model_exclude_unset=True)
    def get_sync(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return status(db, *connection(db))

    @router.post(
        "/api/sync", status_code=202, response_model=SyncStatus, response_model_exclude_unset=True
    )
    def begin_sync(workspace: CurrentWorkspace):
        return queue_sync(workspace, "chesscom")

    def queue_sync(workspace, provider):
        with workspace.mutation_lock, workspace.sessions() as db:
            name, job = connection(db, provider)
            if not name:
                raise HTTPException(422, f"Save your {get_provider(provider).name} username first.")
            if job:
                age = (
                    datetime.now(timezone.utc) - job.created_at.replace(tzinfo=timezone.utc)
                ).total_seconds()
                if job.status in {"queued", "running"} or age < 60:
                    return status(db, name, job, provider)
                # Reuse this account's sync checkpoint instead of accumulating a job
                # and duplicate raw PGN archive on every periodic refresh.
                db.execute(delete(ProviderCheckpoint).where(ProviderCheckpoint.job_id == job.id))
                source = db.get(ProviderImport, job.id)
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
                    ProviderImport(
                        job_id=job.id,
                        provider=provider,
                        username=name,
                        time_class="all",
                        months=2,
                        max_games=50,
                    )
                )
            db.commit()
            return status(db, name, job, provider)

    def validated(provider):
        try:
            return get_provider(provider)
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc

    @router.get("/api/game-providers", response_model=list[GameProvider])
    def providers(workspace: CurrentWorkspace):
        return list(PROVIDERS.values())

    @router.get("/api/providers/{provider}/sync", response_model=SyncStatus)
    def provider_status(provider: str, workspace: CurrentWorkspace):
        validated(provider)
        with workspace.sessions() as db:
            return status(db, *connection(db, provider), provider)

    @router.post("/api/providers/{provider}/sync", status_code=202, response_model=SyncStatus)
    def provider_sync(provider: str, workspace: CurrentWorkspace):
        validated(provider)
        return queue_sync(workspace, provider)

    @router.put("/api/providers/{provider}/connection", response_model=SyncStatus)
    def save_connection(
        provider: str, data: ProviderConnectionRequest, workspace: CurrentWorkspace
    ):
        validated(provider)
        try:
            name = (
                ProviderImportRequest(username=data.username).username
                if data.username.strip()
                else ""
            )
        except ValueError as exc:
            raise HTTPException(422, "Enter a valid chess username.") from exc
        with workspace.mutation_lock, workspace.sessions() as db:
            key = (db.info["user_id"], provider)
            saved = db.get(ProviderConnection, key)
            if saved:
                saved.username = name
            else:
                db.add(ProviderConnection(provider=provider, username=name))
            db.commit()
            return status(db, *connection(db, provider), provider)

    return router
