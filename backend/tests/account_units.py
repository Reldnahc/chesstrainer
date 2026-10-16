"""Read and write units for tests that hold their own session."""

import threading

from trainer.db import Units
from trainer.ownership import account_sessions


def units_for(db):
    """Units on ``db``'s database and account. Commit ``db`` first: a unit's write
    waits for any write ``db`` still holds."""
    return Units(account_sessions(db.get_bind(), db.info["user_id"]), threading.RLock())
