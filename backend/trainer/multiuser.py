"""Cookie authentication and account-bound services sharing one database."""

import secrets
import sqlite3
import threading
import time
from datetime import UTC, datetime
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, Response
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
from trainer.contracts.accounts import (
    AccountAccess,
    AccountProfile,
    Identity,
    ManagedAccounts,
    PasswordChange,
    PasswordReset,
)
from trainer.contracts.common import Ok


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=10, max_length=128)


def configure_accounts(app, settings):
    accounts = Accounts(settings.database_path)
    app.state.accounts = accounts
    password_lock = threading.Lock()
    attempts = {}
    attempts_lock = threading.Lock()
    # A real dummy hash makes unknown usernames take the same password-check path.
    dummy = password_hash(secrets.token_urlsafe(24))

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/"):
            token = request.cookies.get(COOKIE, "")
            user = await run_in_threadpool(accounts.resolve, token) if token else None
            request.state.user = user
            public = path in {"/api/auth/me", "/api/auth/login", "/api/auth/signup"}
            if not public and not user:
                return JSONResponse({"detail": "Sign in to your account."}, status_code=401)
            if (
                user
                and user["password_change_required"]
                and not public
                and path not in {"/api/auth/password", "/api/auth/logout"}
            ):
                return JSONResponse(
                    {"detail": "Choose a new password to continue."}, status_code=403
                )
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                denied = origin_denied(request.headers.get("origin"), request)
                if denied:
                    return JSONResponse({"detail": denied}, status_code=403)
                if not public and not secrets.compare_digest(
                    request.headers.get("x-csrf-token", "").encode(), csrf_token(token).encode()
                ):
                    return JSONResponse(
                        {"detail": "Refresh the page before trying again."}, status_code=403
                    )
        return await call_next(request)

    def origin_denied(origin, request):
        """Explain a write whose Origin is not this site, or return None.

        PUBLIC_ORIGIN pins the address when set. Otherwise the browser's Origin must
        name the Host it sent the request to, which a reverse proxy has to preserve;
        the scheme is not compared because TLS usually ends at that proxy.
        """
        if settings.public_origin:
            if origin == settings.public_origin:
                return None
            return (
                f"Open Fieldwork at {settings.public_origin}. This address does not match "
                "PUBLIC_ORIGIN; the server administrator can correct that setting."
            )
        host = request.headers.get("host", "").lower()
        try:
            parts = urlsplit(origin or "")
            netloc = parts.netloc.lower()
        except ValueError:
            netloc = ""
        if netloc and netloc == host:
            # Browsers drop Secure cookies on plain HTTP except at loopback addresses,
            # so sign-in would silently fail; PUBLIC_ORIGIN catches this at startup.
            if (
                settings.session_secure
                and parts.scheme == "http"
                and parts.hostname not in {"localhost", "127.0.0.1", "::1"}
            ):
                return (
                    "Fieldwork accounts need HTTPS. For trusted-LAN HTTP, the server "
                    "administrator can set SESSION_SECURE=false."
                )
            return None
        return (
            "This request did not come from this Fieldwork address. If a reverse proxy "
            "changes the Host header, the server administrator can set PUBLIC_ORIGIN."
        )

    def throttle(request, name):
        """Refuse when recent attempts exceed a limit; return the keys to charge afterwards.

        Every attempt counts toward the host-wide limit, which bounds password hashing.
        Only failures count per address and per username, so a busy household or a
        proxy address shared by every visitor (see FORWARDED_ALLOW_IPS) cannot lock
        everyone out by signing in successfully.
        """
        now = time.monotonic()
        host = request.client.host if request.client else "unknown"
        keys = ("global", "ip:" + host, "user:" + name.lower())
        with attempts_lock:
            for key in list(attempts):
                attempts[key] = [t for t in attempts[key] if now - t < 60]
                if not attempts[key]:
                    del attempts[key]
            for key, limit in zip(keys, (60, 15, 6)):
                if len(attempts.get(key, [])) >= limit:
                    raise HTTPException(429, "Too many sign-in attempts. Try again in a minute.")
        return keys

    def charge(keys, failed):
        now = time.monotonic()
        with attempts_lock:
            for key in keys if failed else keys[:1]:
                attempts.setdefault(key, []).append(now)

    async def attempt(data, request, signup):
        keys = throttle(request, data.username)
        try:
            user = await run_in_threadpool(authenticate, data, signup)
        except HTTPException as exc:
            charge(keys, exc.status_code == 401)
            raise
        except ValueError:
            charge(keys, True)
            raise
        charge(keys, False)
        return user

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

    @app.get(
        "/api/auth/me",
        response_model=Identity,
        response_model_exclude_unset=True,
        operation_id="get_identity",
        summary="Identity",
    )
    def me(request: Request):
        user = request.state.user
        return {
            "enabled": True,
            "user": accounts.public(user) if user else None,
            "csrf": csrf_token(request.cookies[COOKIE]) if user else None,
        }

    @app.post(
        "/api/auth/signup",
        status_code=201,
        response_model=Identity,
        response_model_exclude_unset=True,
    )
    async def signup(data: Credentials, request: Request, response: Response):
        user = await attempt(data, request, True)
        return signed_in(user, response)

    @app.post("/api/auth/login", response_model=Identity, response_model_exclude_unset=True)
    async def login(data: Credentials, request: Request, response: Response):
        user = await attempt(data, request, False)
        return signed_in(user, response)

    @app.post("/api/auth/logout", response_model=Ok, response_model_exclude_unset=True)
    def logout(request: Request, response: Response):
        accounts.revoke(request.cookies.get(COOKIE, ""))
        response.delete_cookie(
            COOKIE, path="/", secure=settings.session_secure, httponly=True, samesite="lax"
        )
        return {"ok": True}

    @app.post("/api/auth/onboarding/complete", response_model=AccountProfile)
    def complete_onboarding(request: Request):
        with accounts.connect() as db:
            db.execute(
                "UPDATE users SET onboarding_completed=1 WHERE id=?", (request.state.user["id"],)
            )
        return {"user": accounts.public(accounts.by_name(request.state.user["username"]))}

    @app.post("/api/auth/logout-all", response_model=Ok, response_model_exclude_unset=True)
    def logout_all(request: Request, response: Response):
        with accounts.connect() as db:
            db.execute("DELETE FROM auth_sessions WHERE user_id=?", (request.state.user["id"],))
        response.delete_cookie(COOKIE, path="/")
        return {"ok": True}

    # Administration lives under /api/auth so local single-user mode, which has no
    # accounts to manage, leaves these routes out of its contract.
    def managed(request, account_id, *, not_self=None):
        if not request.state.user["admin"]:
            raise HTTPException(403, "Only an administrator can manage accounts.")
        user = accounts.by_id(account_id)
        if not user or user["username"] == "__local__":
            raise HTTPException(404, "Account not found.")
        if not_self and user["id"] == request.state.user["id"]:
            raise HTTPException(409, not_self)
        return user

    def administer(action, *args):
        try:
            action(*args)
        except (ValueError, sqlite3.IntegrityError) as exc:
            raise HTTPException(409, str(exc).rstrip(".") + ".") from exc
        return {"ok": True}

    @app.get("/api/auth/accounts", response_model=ManagedAccounts)
    def list_accounts(request: Request):
        if not request.state.user["admin"]:
            raise HTTPException(403, "Only an administrator can manage accounts.")
        return {
            "accounts": [
                {
                    **row,
                    "admin": bool(row["admin"]),
                    "disabled": bool(row["disabled"]),
                    "created": datetime.fromtimestamp(row["created"], UTC),
                }
                for row in accounts.listing()
            ]
        }

    @app.post("/api/auth/accounts/{account_id}/password", response_model=Ok)
    def reset_password(account_id: str, data: PasswordReset, request: Request):
        """Set a new password and sign that account out everywhere."""
        user = managed(
            request,
            account_id,
            not_self="Change your own password in Settings, under Account.",
        )
        # Shares the sign-in slot so hashing stays memory-bounded.
        with password_lock:
            return administer(lambda: accounts.set_password(user, data.password, temporary=True))

    @app.post("/api/auth/accounts/{account_id}/admin", response_model=Ok)
    def promote_account(account_id: str, request: Request):
        return administer(accounts.promote, managed(request, account_id))

    @app.post("/api/auth/accounts/{account_id}/access", response_model=Ok)
    def account_access(account_id: str, data: AccountAccess, request: Request):
        user = managed(request, account_id, not_self="You cannot disable your own account.")
        return administer(accounts.set_disabled, user, data.disabled)

    @app.delete("/api/auth/accounts/{account_id}", response_model=Ok)
    def delete_account(account_id: str, request: Request):
        user = managed(request, account_id, not_self="You cannot delete your own account.")
        return administer(accounts.delete, user)

    @app.post("/api/auth/password", response_model=AccountProfile)
    def change_password(data: PasswordChange, request: Request):
        """Choose a new password; other devices are signed out, this one stays."""
        user = request.state.user
        keys = throttle(request, user["username"])
        with password_lock:
            valid = password_matches(data.current_password, user["password"])
            charge(keys, not valid)
            if not valid:
                raise HTTPException(403, "Your current password is incorrect.")
            if data.new_password == data.current_password:
                raise HTTPException(422, "Choose a password different from your current one.")
            accounts.set_password(user, data.new_password, keep_session=request.cookies[COOKIE])
        return {"user": accounts.public(accounts.by_id(user["id"]))}
