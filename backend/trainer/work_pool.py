"""Bounded thread work with explicit draining; never an unbounded executor backlog."""

import threading
from concurrent.futures import ThreadPoolExecutor

from trainer.cancellation import WaitCancelled, acquiring, wait_until


class WorkPool:
    """At most ``workers`` tasks run and as many again wait; ``submit`` blocks for a
    slot, returns the task's Future, or None once ``cancelled()``."""

    def __init__(self, workers, name, cancelled):
        self.executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix=name)
        self.cancelled = cancelled
        self.slots = threading.BoundedSemaphore(workers * 2)
        self.lock = threading.Lock()
        self.active = 0
        self.pending = 0
        self.errors = []

    def submit(self, function, *args):
        try:
            wait_until(acquiring(self.slots), self.cancelled, interval=0.1)
        except WaitCancelled:
            return None
        if self.cancelled():
            self.slots.release()
            return None
        with self.lock:
            self.pending += 1
        try:
            future = self.executor.submit(self._run, function, args)
        except BaseException:
            with self.lock:
                self.pending -= 1
            self.slots.release()
            raise
        future.add_done_callback(self._finished)
        return future

    def _run(self, function, args):
        with self.lock:
            self.active += 1
        try:
            return function(*args)
        finally:
            with self.lock:
                self.active -= 1

    def _finished(self, future):
        try:
            with self.lock:
                self.pending -= 1
                # A task dropped by close(cancel_waiting=True) has no exception to read.
                if not future.cancelled() and (error := future.exception()):
                    self.errors.append(error)
        finally:
            self.slots.release()

    def snapshot(self):
        with self.lock:
            return {"active": self.active, "pending": self.pending}

    def close(self, *, cancel_waiting=False):
        """Wait for running tasks; ``cancel_waiting`` drops tasks not yet started."""
        self.executor.shutdown(wait=True, cancel_futures=cancel_waiting)


class GameCompletion:
    """A game is complete only once its producer and submitted classifications finish."""

    def __init__(self, on_complete):
        self.on_complete = on_complete
        self.lock = threading.Lock()
        self.pending = 1  # The game producer itself.
        self.aborted = False

    def add(self):
        with self.lock:
            self.pending += 1

    def finish(self, success):
        with self.lock:
            self.aborted |= not success
            self.pending -= 1
            complete = self.pending == 0 and not self.aborted
        if complete:
            self.on_complete()
