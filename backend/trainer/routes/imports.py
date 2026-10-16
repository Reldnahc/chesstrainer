"""PGN uploads and filtered provider import requests."""

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from trainer.contracts.common import JobStarted
from trainer.contracts.jobs import PgnImportResult
from trainer.game_analysis import BACKFILL, queue_imported
from trainer.game_providers import get_provider
from trainer.game_providers.base import ProviderImportRequest
from trainer.imports import import_games
from trainer.job_lifecycle import JobKind, ensure_job
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
    ):
        pgn = await read_pgn(file)
        filename = Path(file.filename or "games.pgn").name

        def run_import():
            # Parsing is CPU-bound and the account lock may be held by a running job.
            # Neither may block the event loop, which would stall every account.
            with workspace.write() as db:
                result = import_games(
                    db,
                    filename,
                    pgn,
                    usernames.split(","),
                    None if side == "auto" else side,
                )
                if result["imported"]:
                    queue_imported(db, result["import_id"], BACKFILL)
                    db.flush()
                return result

        return await run_in_threadpool(run_import)

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
        # Fetch only; each new game then queues its own backfill analysis.
        kind = JobKind.CHESSCOM_FETCH if provider == "chesscom" else JobKind.PROVIDER_FETCH
        same_query = select(ProviderImport.job_id).where(
            ProviderImport.provider == provider,
            ProviderImport.username == data.username,
            ProviderImport.time_class == data.time_class,
            ProviderImport.months == data.months,
            ProviderImport.max_games == data.max_games,
            ProviderImport.start_date == data.start_date,
            ProviderImport.end_date == data.end_date,
        )
        with workspace.write() as db:
            job, created = ensure_job(db, kind, AnalysisJob.id.in_(same_query))
            if created:
                db.add(ProviderImport(job_id=job.id, provider=provider, **data.model_dump()))
            db.flush()
            return {"job_id": job.id, "status": job.status}

    return router
