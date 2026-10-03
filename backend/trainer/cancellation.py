"""Cancellation callbacks read the job row; hot loops must not pay that on every tick."""

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
