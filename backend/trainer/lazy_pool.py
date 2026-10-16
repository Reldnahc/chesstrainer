"""A fixed number of costly native resources, each built on first use and reused.

Stockfish engines and Maia workers share this pool and its one failure rule: a
lease that raises discards its resource (closed, never handed out again) and the
slot builds a fresh one on its next lease. A lease refused before the resource is
used hands it back untouched.
"""

import threading
from contextlib import contextmanager
from queue import Queue

from trainer.cancellation import taking, wait_until


class PoolClosed(Exception):
    """The pool is closed: no lease is handed a resource."""


class LazyPool:
    def __init__(self, slots, build):
        self.build = build
        self.available = Queue(maxsize=slots)
        for _ in range(slots):
            self.available.put(None)
        self.live = set()
        self._guard = threading.Lock()
        self.closed = False

    @contextmanager
    def lease(self, cancelled=None, *, deadline=None, admit=None, build_args=()):
        """Hold one slot's resource, building it with ``build(*build_args)`` on first use.

        Waiting raises WaitCancelled or WaitTimedOut. ``admit()`` may raise to refuse
        the lease: it runs before each try for a slot and once more on the slot taken,
        which then goes back unused.
        """
        take = taking(self.available)

        def attempt(timeout):
            if admit is not None:
                admit()
            return take(timeout)

        resource = wait_until(attempt, cancelled, deadline=deadline)
        try:
            if self.closed:
                raise PoolClosed()
            if admit is not None:
                admit()
        except BaseException:
            self.available.put(resource)
            raise
        try:
            if resource is None:
                with self._guard:
                    if self.closed:
                        raise PoolClosed()
                    resource = self.build(*build_args)
                    self.live.add(resource)
            yield resource
        except BaseException:
            if resource is not None:
                self._discard(resource)
                resource = None
            raise
        finally:
            self.available.put(resource)

    def _discard(self, resource):
        try:
            resource.close()
        finally:
            with self._guard:
                self.live.discard(resource)

    def close(self):
        """Close every resource, leased or idle; no lease builds another."""
        with self._guard:
            self.closed = True
            resources = list(self.live)
        for resource in resources:
            resource.close()
