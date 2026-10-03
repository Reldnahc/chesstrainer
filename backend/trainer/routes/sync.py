"""Connections and on-demand checks; the server also polls them on its own."""

from datetime import timezone

from fastapi import APIRouter, HTTPException, Request

from trainer.contracts.accounts import (
    GameProvider,
    ProviderConnectionRequest,
    SyncStatus,
    WelcomeBack,
)
from trainer.game_providers import PROVIDERS, get_provider
from trainer.game_providers.base import ProviderImportRequest
from trainer.game_sync import connected_username, latest_sync
from trainer.game_sync import queue_sync as queue
from trainer.models import ProviderConnection, ProviderImport
from trainer.presence import dismiss_welcome_back, welcome_back
from trainer.workspaces import CurrentWorkspace


def create_router():
    router = APIRouter()

    def connection(db, provider="chesscom"):
        name = connected_username(db, provider)
        return name, latest_sync(db, provider, name)

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
            if queue(db, provider, workspace.settings) is None:
                raise HTTPException(422, f"Save your {get_provider(provider).name} username first.")
            return status(db, *connection(db, provider), provider)

    def validated(provider):
        try:
            return get_provider(provider)
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc

    @router.get("/api/welcome-back", response_model=WelcomeBack)
    def get_welcome_back(workspace: CurrentWorkspace, request: Request):
        return welcome_back(request.app.state.workspaces.sql_engine, workspace.user_id)

    @router.post("/api/welcome-back/dismiss", response_model=WelcomeBack)
    def post_welcome_back(workspace: CurrentWorkspace, request: Request):
        engine = request.app.state.workspaces.sql_engine
        dismiss_welcome_back(engine, workspace.user_id)
        return welcome_back(engine, workspace.user_id)

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
