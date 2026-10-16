"""Read and write units for tests that hold their own session."""

import threading

from trainer.db import Units
from trainer.ownership import account_sessions


def units_for(db):
    """Units on ``db``'s database and account. Commit ``db`` first: a unit's write
    waits for any write ``db`` still holds."""
    return Units(account_sessions(db.get_bind(), db.info["user_id"]), threading.RLock())


def job_context(sessions, job_id, settings, cancelled=lambda: False):
    """A JobContext for calling one job step directly, with no runner."""
    from trainer.job_context import JobContext

    units = Units(sessions, threading.RLock())
    with sessions() as db:
        user_id = db.info["user_id"]
    return JobContext(
        job_id=job_id,
        user_id=user_id,
        settings=settings,
        sessions=sessions,
        read=units.read,
        write=units.write,
        engine_factory=None,
        scheduler=None,
        classifier=None,
        human_models=None,
        providers=None,
        cancelled=cancelled,
        stopping=lambda: False,
    )
