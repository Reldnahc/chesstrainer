"""A small thread-safe cache that keeps the most recently used entries."""

import threading
from collections import OrderedDict


class RecentCache:
    """At most ``size`` entries; the least recently used goes first.

    ``get_or_make`` builds a missing value outside the lock, so a slow build never
    blocks other readers; two threads that miss together may both build it, and
    the later result is kept. Values are shared, so callers must not mutate them.
    """

    def __init__(self, size):
        self.size = size
        self._entries = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            value = self._entries.get(key)
            if value is not None:
                self._entries.move_to_end(key)
            return value

    def put(self, key, value):
        with self._lock:
            self._entries[key] = value
            self._entries.move_to_end(key)
            while len(self._entries) > self.size:
                self._entries.popitem(last=False)
        return value

    def get_or_make(self, key, make):
        value = self.get(key)
        return value if value is not None else self.put(key, make())

    def clear(self):
        with self._lock:
            self._entries.clear()
