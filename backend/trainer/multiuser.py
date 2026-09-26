"""Cookie authentication and account-bound services sharing one database."""

import asyncio
import secrets
import threading
import time
from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from trainer.accounts import (
    COOKIE,
    SESSION_SECONDS,
    Accounts,
    csrf_token,
    password_hash,
    password_matches,
)
from trainer.chesscom import ChessComRequest
from trainer.db import database, migrate
from trainer.engine_pool import EnginePool
from trainer.ownership import account_sessions
from trainer.web import serve_frontend


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=10, max_length=128)


class Profile(BaseModel):
    chesscom_username: str = Field(default="", max_length=50)


def create_multiuser_app(settings, *, workers, engine_factory, chesscom_factory, classifier):
    from trainer.api import create_app

    sql_engine, _ = database(settings.database_path)
    accounts = Accounts(settings.database_path)
    pool = EnginePool(engine_factory, settings.engine_slots)
    tenants = {}
    opening = asyncio.Lock()
    stack = AsyncExitStack()
    password_lock = threading.Lock()
    provider_lock = threading.Lock()
    attempts = {}
    attempts_lock = threading.Lock()
    # A real dummy hash makes unknown usernames take the same password-check path.
    dummy = password_hash(secrets.token_urlsafe(24))

    async def workspace(user):
        async with opening:
            if user["id"] not in tenants:
                private = settings.model_copy(
                    update={
                        "accounts_enabled": False,
                        "lan_access_token": "",
                    }
                )
                # model_copy does not validate SecretStr; keep its original type.
                from pydantic import SecretStr

                private.lan_access_token = SecretStr("")
                tenant = create_app(
                    private,
                    workers=workers,
                    engine_factory=pool.handle,
                    chesscom_factory=chesscom_factory,
                    classifier=classifier,
                    start_engine=False,
                    session_factory=account_sessions(sql_engine, user["id"]),
                    provider_lock=provider_lock,
                )
                await stack.enter_async_context(tenant.router.lifespan_context(tenant))
                tenants[user["id"]] = tenant
            return tenants[user["id"]]

    @asynccontextmanager
    async def lifespan(app):
        migrate(sql_engine)
        async with stack:
            # Resume persisted jobs after a restart, even before their owner logs in.
            with accounts.connect() as db:
                existing = [dict(row) for row in db.execute("SELECT * FROM users WHERE disabled=0")]
            for user in existing:
                await workspace(user)
            yield
            for tenant in tenants.values():
                tenant.state.runner.stop_event.set()
        pool.close()
        sql_engine.dispose()

    app = FastAPI(title="Fieldwork accounts", lifespan=lifespan)
    app.state.accounts = accounts
    app.state.tenants = tenants
    app.state.settings = settings

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/"):
            token = request.cookies.get(COOKIE, "")
            user = accounts.resolve(token) if token else None
            request.state.user = user
            public = path in {"/api/auth/me", "/api/auth/login", "/api/auth/signup"}
            if not public and not user:
                return JSONResponse({"detail": "Sign in to your account."}, status_code=401)
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                expected = settings.public_origin.rstrip("/") or str(request.base_url).rstrip("/")
                if request.headers.get("origin") != expected:
                    return JSONResponse(
                        {
                            "detail": f"Open Fieldwork at {expected}. This address does not match "
                            "PUBLIC_ORIGIN; the server administrator can correct that setting."
                        },
                        status_code=403,
                    )
                if not public and not secrets.compare_digest(
                    request.headers.get("x-csrf-token", ""), csrf_token(token)
                ):
                    return JSONResponse(
                        {"detail": "Refresh the page before trying again."}, status_code=403
                    )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ValueError)
    async def invalid(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=422)

    def throttle(request, name):
        now = time.monotonic()
        host = request.client.host if request.client else "unknown"
        with attempts_lock:
            for key in list(attempts):
                attempts[key] = [t for t in attempts[key] if now - t < 60]
                if not attempts[key]:
                    del attempts[key]
            for key, limit in (("global", 30), ("ip:" + host, 15), ("user:" + name.lower(), 6)):
                if len(attempts.get(key, [])) >= limit:
                    raise HTTPException(429, "Too many sign-in attempts. Try again in a minute.")
            for key in ("global", "ip:" + host, "user:" + name.lower()):
                attempts.setdefault(key, []).append(now)

    def authenticate(data, signup):
        # Bound memory consumption of password hashing, independently of Stockfish.
        if not password_lock.acquire(blocking=False):
            raise HTTPException(429, "Another sign-in is processing. Please try again shortly.")
        try:
            if signup:
                return accounts.create(data.username, data.password)
            user = accounts.by_name(data.username)
            valid = password_matches(data.password, user["password"] if user else dummy)
            if not valid or not user or user["disabled"]:
                raise HTTPException(401, "Incorrect username or password.")
            return user
        finally:
            password_lock.release()

    def signed_in(user, response):
        token = accounts.issue(user["id"])
        response.set_cookie(
            COOKIE,
            token,
            max_age=SESSION_SECONDS,
            httponly=True,
            secure=settings.session_secure,
            samesite="lax",
            path="/",
        )
        return {"enabled": True, "user": accounts.public(user), "csrf": csrf_token(token)}

    @app.get("/api/auth/me")
    def me(request: Request):
        user = request.state.user
        return {
            "enabled": True,
            "user": accounts.public(user) if user else None,
            "csrf": csrf_token(request.cookies[COOKIE]) if user else None,
        }

    @app.post("/api/auth/signup", status_code=201)
    async def signup(data: Credentials, request: Request, response: Response):
        throttle(request, data.username)
        user = await run_in_threadpool(authenticate, data, True)
        return signed_in(user, response)

    @app.post("/api/auth/login")
    async def login(data: Credentials, request: Request, response: Response):
        throttle(request, data.username)
        user = await run_in_threadpool(authenticate, data, False)
        return signed_in(user, response)

    @app.post("/api/auth/logout")
    def logout(request: Request, response: Response):
        accounts.revoke(request.cookies.get(COOKIE, ""))
        response.delete_cookie(
            COOKIE, path="/", secure=settings.session_secure, httponly=True, samesite="lax"
        )
        return {"ok": True}

    @app.post("/api/auth/profile")
    def profile(data: Profile, request: Request):
        name = data.chesscom_username.strip()
        if name:
            name = ChessComRequest(username=name).username
        with accounts.connect() as db:
            db.execute(
                "UPDATE users SET chesscom_username=? WHERE id=?", (name, request.state.user["id"])
            )
        user = accounts.by_name(request.state.user["username"])
        return {"user": accounts.public(user)}

    @app.post("/api/auth/logout-all")
    def logout_all(request: Request, response: Response):
        with accounts.connect() as db:
            db.execute("DELETE FROM auth_sessions WHERE user_id=?", (request.state.user["id"],))
        response.delete_cookie(COOKIE, path="/")
        return {"ok": True}

    frontend = FastAPI()
    serve_frontend(frontend)

    class Dispatch:
        async def __call__(self, scope, receive, send):
            if scope["path"].startswith("/api/"):
                user = scope.get("state", {}).get("user")
                if not user:
                    await JSONResponse({"detail": "Sign in to your account."}, status_code=401)(
                        scope, receive, send
                    )
                    return
                tenant = await workspace(user)
                await tenant(scope, receive, send)
            else:
                await frontend(scope, receive, send)

    app.mount("/", Dispatch())
    return app
