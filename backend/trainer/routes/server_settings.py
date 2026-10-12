"""Server settings stored in the database, and restarting to apply them."""

import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from trainer import restart, site_settings
from trainer.contracts.common import Ok
from trainer.contracts.server_settings import ServerSettings, ServerSettingsChange
from trainer.routes.study_lessons import can_manage


def require_administrator(request):
    # Same rule as courses: the single user of a local install, or an administrator.
    if not can_manage(request):
        raise HTTPException(403, "Only an administrator can change server settings.")


def create_router(*, settings, sql_engine) -> APIRouter:
    router = APIRouter()
    # Changes with every start, so the page can tell the restarted server apart.
    boot_id = uuid.uuid4().hex

    def current():
        return {
            "boot_id": boot_id,
            "groups": site_settings.listing(sql_engine, settings),
            "restart_available": restart.available(),
        }

    @router.get("/api/server-settings", response_model=ServerSettings)
    def get_server_settings(request: Request):
        require_administrator(request)
        return current()

    @router.put("/api/server-settings", response_model=ServerSettings)
    def put_server_settings(data: ServerSettingsChange, request: Request):
        require_administrator(request)
        try:
            site_settings.save(sql_engine, data.values)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return current()

    @router.post("/api/server/restart", status_code=202, response_model=Ok)
    def restart_server(request: Request, tasks: BackgroundTasks):
        require_administrator(request)
        if not restart.available():
            raise HTTPException(409, "This server cannot restart itself. Restart it from the host.")
        # After the response, so the browser hears back before the server stops.
        tasks.add_task(restart.request)
        return {"ok": True}

    return router
