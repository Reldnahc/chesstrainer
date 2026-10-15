"""Short-lived, explicitly account-bound resources for requests and jobs."""

import threading
from contextlib import contextmanager
from dataclasses import dataclass
from functools import cached_property
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from trainer.ownership import LOCAL_USER_ID, account_sessions
from trainer.presence import touch


@dataclass
class _Locks:
    mutation: object
    variation: object
    users: int = 0


@dataclass
class Workspace:
    user_id: str
    sessions: object
    mutation_lock: object
    variation_lock: object
    settings: object
    engine_factory: object
    shared_engine: object = None
    human_models: object = None

    @cached_property
    def engine(self):
        return (
            self.shared_engine
            if self.shared_engine is not None
            else self.engine_factory(self.settings, self.sessions)
        )


class Workspaces:
    """Retain locks only while their account has an active request or job.

    Leasing a lock does not acquire it. The account's mutation lock is taken around
    short writes only, before the session, by requests and background jobs alike:
    never around engine or Maia work, and never by read-only handlers. Engine and
    model work reads first, searches outside the lock, then re-checks and writes
    under it. The variation lock serializes an account's interactive engine searches.
    """

    def __init__(
        self,
        sql_engine,
        settings,
        engine_factory,
        *,
        local_engine=None,
        local_mutation_lock=None,
        human_models=None,
    ):
        self.sql_engine, self.settings = sql_engine, settings
        self.engine_factory, self.local_engine = engine_factory, local_engine
        self.human_models = human_models
        self.local_mutation_lock = (
            local_mutation_lock if local_mutation_lock is not None else threading.RLock()
        )
        self._guard = threading.Lock()
        self._locks = {}

    def sessions(self, user_id):
        return account_sessions(self.sql_engine, user_id)

    @contextmanager
    def open(self, user_id):
        if not user_id:
            raise ValueError("An account identity is required")
        with self._guard:
            if user_id not in self._locks:
                self._locks[user_id] = _Locks(
                    self.local_mutation_lock if user_id == LOCAL_USER_ID else threading.RLock(),
                    threading.Lock(),
                )
            lease = self._locks[user_id]
            lease.users += 1
        try:
            yield Workspace(
                user_id,
                self.sessions(user_id),
                lease.mutation,
                lease.variation,
                self.settings,
                self.engine_factory,
                self.local_engine,
                self.human_models,
            )
        finally:
            with self._guard:
                lease.users -= 1
                if not lease.users:
                    del self._locks[user_id]


def request_workspace(request: Request):
    if request.app.state.settings.accounts_enabled:
        user = getattr(request.state, "user", None)
        if user is None:
            raise HTTPException(401, "Sign in to your account.")
        user_id = user["id"]
    else:
        user_id = LOCAL_USER_ID
    workspaces = request.app.state.workspaces
    touch(workspaces.sql_engine, user_id, request.app.state.settings)
    with workspaces.open(user_id) as workspace:
        yield workspace


CurrentWorkspace = Annotated[Workspace, Depends(request_workspace)]
