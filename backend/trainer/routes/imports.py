"""PGN uploads and filtered Chess.com import requests."""

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import select

from trainer.chesscom import ChessComRequest
from trainer.contracts.common import JobStarted
from trainer.contracts.jobs import PgnImportResult
from trainer.game_providers import get_provider
from trainer.game_providers.base import ProviderImportRequest
from trainer.imports import import_games
from trainer.models import AnalysisJob, ProviderImport
from trainer.workspaces import CurrentWorkspace


def create_router(*, settings) -> APIRouter:
    router = APIRouter()

    async def read_pgn(file):
        content = await file.read(settings.max_import_bytes + 1)
        await file.close()
        if len(content) > settings.max_import_bytes:
            raise HTTPException(413, "PGN exceeds configured MAX_IMPORT_BYTES")
        try:
            return content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(422, "Save PGN as UTF-8 before importing")

    @router.post("/api/imports", response_model=PgnImportResult, response_model_exclude_unset=True)
    async def upload_pgn(
        workspace: CurrentWorkspace,
        file: UploadFile = File(...),
        usernames: str = Form(""),
        side: Literal["auto", "white", "black"] = Form("auto"),
        analyze: bool = Form(True),
    ):
        pgn = await read_pgn(file)
        with workspace.mutation_lock, workspace.sessions() as db:
            return import_games(
                db,
                Path(file.filename or "games.pgn").name,
                pgn,
                usernames.split(","),
                None if side == "auto" else side,
                queue_analysis=analyze,
            )

    @router.post(
        "/api/imports/chesscom",
        status_code=202,
        response_model=JobStarted,
        response_model_exclude_unset=True,
    )
    def import_chesscom(workspace: CurrentWorkspace, data: ChessComRequest):
        return queue_provider(workspace, data, "chesscom")

    @router.post(
        "/api/imports/provider/{provider}",
        status_code=202,
        response_model=JobStarted,
        response_model_exclude_unset=True,
    )
    def import_provider(provider: str, workspace: CurrentWorkspace, data: ProviderImportRequest):
        try:
            get_provider(provider).validate(data)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return queue_provider(workspace, data, provider)

    def queue_provider(workspace, data, provider):
        with workspace.mutation_lock, workspace.sessions() as db:
            existing = db.scalar(
                select(AnalysisJob)
                .join(ProviderImport)
                .where(
                    AnalysisJob.status.in_(["queued", "running"]),
                    AnalysisJob.kind
                    == (
                        ("chesscom" if provider == "chesscom" else "provider_import")
                        if data.analyze
                        else ("chesscom_fetch" if provider == "chesscom" else "provider_fetch")
                    ),
                    ProviderImport.provider == provider,
                    ProviderImport.username == data.username,
                    ProviderImport.time_class == data.time_class,
                    ProviderImport.months == data.months,
                    ProviderImport.max_games == data.max_games,
                    ProviderImport.start_date == data.start_date,
                    ProviderImport.end_date == data.end_date,
                )
            )
            if existing:
                return {"job_id": existing.id, "status": existing.status}
            job = AnalysisJob(
                kind=("chesscom" if provider == "chesscom" else "provider_import")
                if data.analyze
                else ("chesscom_fetch" if provider == "chesscom" else "provider_fetch")
            )
            db.add(job)
            db.flush()
            db.add(
                ProviderImport(
                    job_id=job.id, provider=provider, **data.model_dump(exclude={"analyze"})
                )
            )
            db.commit()
            return {"job_id": job.id, "status": job.status}

    return router
