"""Cancellable native search transport, without changing baseline search behavior."""

from contextlib import contextmanager
from time import monotonic, sleep

from trainer.cancellation import WaitCancelled, acquiring, throttled, wait_until
from trainer.search_limits import EngineCancelled


@contextmanager
def search_lock(lock, cancelled):
    if cancelled is None:
        with lock:
            yield
        return
    try:
        wait_until(acquiring(lock), cancelled)
    except WaitCancelled as exc:
        raise EngineCancelled() from exc
    try:
        if cancelled():
            raise EngineCancelled()
        yield
    finally:
        lock.release()


def cancellable_search(process, board, limit, *, multipv, root_moves, cancelled):
    cancelled = throttled(cancelled)
    deadline = monotonic() + limit.time + 15
    with process.analysis(
        board, limit, multipv=multipv, root_moves=root_moves, game=object()
    ) as stream:
        while True:
            if cancelled():
                raise EngineCancelled()
            if monotonic() >= deadline:
                raise TimeoutError("Native refinement exceeded its deadline")
            if stream.would_block():
                sleep(0.02)
            elif stream.next() is None:
                return stream.multipv
