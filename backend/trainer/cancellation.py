"""Cancellation callbacks read the job row; hot loops must not pay that on every tick.

Also the small waiting primitives every engine, Maia and job loop shares: a
cancellable wait for a lock, a queue or a semaphore, and striped locks.
"""

import threading
from queue import Empty
from time import monotonic

CHECK_INTERVAL = 0.25


def throttled(cancelled, interval=CHECK_INTERVAL):
    """Check immediately, then at most once per interval; a cancellation is final.

    Task boundaries keep calling the exact callback. Only loops that poll while
    waiting for a lock, a pooled process or a running native search use this.
    """
    if cancelled is None:
        return None
    state = {"at": None, "value": False}

    def check():
        if state["value"]:
            return True
        now = monotonic()
        if state["at"] is None or now - state["at"] >= interval:
            state["at"] = now
            state["value"] = bool(cancelled())
        return state["value"]

    return check


class WaitCancelled(Exception):
    """The caller's cancellation fired while it waited."""


class WaitTimedOut(Exception):
    """The wait's deadline passed."""


def wait_until(attempt, cancelled=None, *, deadline=None, interval=0.05):
    """Retry ``attempt(timeout)``, which returns ``(done, value)``, until done.

    Between tries it checks ``cancelled`` (throttled) and ``deadline`` (a
    monotonic time), raising WaitCancelled or WaitTimedOut; callers turn those
    into their own errors.
    """
    waiting = throttled(cancelled)
    while True:
        done, value = attempt(interval)
        if done:
            return value
        if waiting is not None and waiting():
            raise WaitCancelled()
        if deadline is not None and monotonic() >= deadline:
            raise WaitTimedOut()


def acquiring(lock):
    """An attempt that acquires ``lock`` (or a semaphore)."""
    return lambda timeout: (lock.acquire(timeout=timeout), None)


def taking(queue):
    """An attempt that takes the next item from ``queue``; the item may be None."""

    def attempt(timeout):
        try:
            return True, queue.get(timeout=timeout)
        except Empty:
            return False, None

    return attempt


class StripedLocks:
    """A fixed set of locks chosen by key, so equal keys serialize and others rarely meet."""

    def __init__(self, count):
        self.locks = tuple(threading.Lock() for _ in range(count))

    def for_key(self, key: str):
        return self.locks[int(key[:8], 16) % len(self.locks)]
