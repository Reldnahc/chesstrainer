"""LAN access, error translation and same-origin frontend delivery."""

import secrets
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from trainer.config import Settings
from trainer.engine import EngineUnavailable


def configure_http(app: FastAPI, settings: Settings):
    @app.middleware("http")
    async def local_access(request: Request, call_next):
        if request.url.path.startswith("/api/"):
            token = settings.lan_access_token.get_secret_value()
            if (
                token
                and request.url.path != "/api/auth/me"
                and not secrets.compare_digest(
                    request.headers.get("authorization", ""), f"Bearer {token}"
                )
            ):
                return JSONResponse(
                    {"detail": "Enter the configured LAN access token."}, status_code=401
                )
            origin = request.headers.get("origin")
            if request.method not in {"GET", "HEAD", "OPTIONS"} and origin:
                if urlsplit(origin).netloc != request.headers.get("host"):
                    return JSONResponse(
                        {"detail": "Cross-origin writes are disabled."}, status_code=403
                    )
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(ValueError)
    async def invalid_input(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=422)

    @app.exception_handler(EngineUnavailable)
    async def unavailable_engine(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=503)


def serve_frontend(app: FastAPI):
    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "API endpoint not found")
            return FileResponse(dist / "index.html")
