import threading

from trainer.work_pool import WorkPool


def test_submit_returns_the_task_future_and_none_once_cancelled():
    stopped = threading.Event()
    pool = WorkPool(1, "test-pool", stopped.is_set)
    try:
        future = pool.submit(lambda value: value * 2, 21)
        assert future is not None and future.result() == 42
        stopped.set()
        assert pool.submit(lambda: None) is None
    finally:
        pool.close()


def test_close_can_drop_tasks_that_have_not_started():
    gate, ran = threading.Event(), []
    pool = WorkPool(1, "test-pool", lambda: False)
    first = pool.submit(gate.wait)
    waiting = pool.submit(ran.append, "late")
    gate.set()
    pool.close(cancel_waiting=True)
    assert first.result() is True
    # The waiting task either never started or finished; it was never left running.
    assert waiting.cancelled() or ran == ["late"]
