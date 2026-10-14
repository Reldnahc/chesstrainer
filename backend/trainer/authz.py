"""Who may do what, declared on the routes rather than remembered in each handler.

``administrator(message)`` is a FastAPI dependency: attach it to an endpoint with
``dependencies=[administrator(...)]`` and the handler never runs for anyone else.
``shared_links.route`` declares an endpoint that anyone holding a game's link may
call without signing in; the account middleware asks that registry, so there is no
separate list of paths to keep in step with the routes.
"""

from fastapi import Depends, HTTPException, Request
from starlette.routing import compile_path


def is_administrator(request: Request) -> bool:
    """The single user of a local install, or a signed-in administrator."""
    if not request.app.state.settings.accounts_enabled:
        return True
    user = getattr(request.state, "user", None)
    return bool(user and user.get("admin"))


def administrator(message="Only an administrator can do that."):
    def require(request: Request):
        if not is_administrator(request):
            raise HTTPException(403, message)

    return Depends(require)


class SharedLinks:
    """Endpoints a game's link opens without signing in, registered where they are declared."""

    def __init__(self):
        self._routes = set()

    def route(self, declare, path, **options):
        """``declare`` is ``router.get`` or ``router.post``; use as that decorator would be."""
        method = declare.__name__.upper()
        regex, _, _ = compile_path(path)
        self._routes |= {(method, regex)} | ({("HEAD", regex)} if method == "GET" else set())
        return declare(path, **options)

    def opens(self, method, path):
        return any(method == m and regex.fullmatch(path) for m, regex in self._routes)


# Each endpoint still resolves the game itself and refuses what it does not allow.
shared_links = SharedLinks()
