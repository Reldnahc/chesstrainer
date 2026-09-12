"""Bounded thread work with explicit draining; never an unbounded executor backlog."""

import threading
from concurrent.futures import ThreadPoolExecutor


class WorkPool:
    def __init__(self, workers, name, cancelled):
        self.executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix=name)
        self.cancelled = cancelled
        self.slots = threading.BoundedSemaphore(workers * 2)
        self.lock = threading.Lock()
        self.active = 0
        self.pending = 0
        self.errors = []

    def submit(self, function, *args):
        while not self.slots.acquire(timeout=0.1):
            if self.cancelled():
                return False
        if self.cancelled():
            self.slots.release()
            return False
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
        return True

    def _run(self, function, args):
        with self.lock:
            self.active += 1
        try:
            return function(*args)
        finally:
            with self.lock:
                self.active -= 1

    def _finished(self, future):
        with self.lock:
            self.pending -= 1
            if error := future.exception():
                self.errors.append(error)
        self.slots.release()

    def snapshot(self):
        with self.lock:
            return {"active": self.active, "pending": self.pending}

    def close(self):
        self.executor.shutdown(wait=True)


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
