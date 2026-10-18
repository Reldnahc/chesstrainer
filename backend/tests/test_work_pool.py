import threading
import time

from trainer.work_pool import WorkPool


def test_close_drops_tasks_that_have_not_started_and_frees_their_slots(caplog):
    gate, ran = threading.Event(), []
    pool = WorkPool(1, "test-pool", lambda: False)
    first = pool.submit(gate.wait)
    waiting = pool.submit(ran.append, "late")
    closing = threading.Thread(target=pool.close, kwargs={"cancel_waiting": True})
    closing.start()
    # The running task holds the only worker, so the waiting one is still queued.
    assert wait_for(waiting.cancelled)
    gate.set()
    closing.join(timeout=5)
    assert not closing.is_alive()
    assert first.result() is True and ran == []
    assert pool.snapshot() == {"active": 0, "pending": 0} and pool.errors == []
    assert "exception calling callback" not in caplog.text
    # Both slots came back.
    assert pool.slots.acquire(blocking=False) and pool.slots.acquire(blocking=False)


def wait_for(condition, timeout=5):
    deadline = time.monotonic() + timeout
    while not condition():
        if time.monotonic() > deadline:
            return False
        time.sleep(0.01)
    return True
