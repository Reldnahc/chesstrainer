"""Last observed host engine result; reading health never starts a native process."""

import logging
from threading import Lock

from trainer.engine import EngineReferenceMismatch, EngineUnavailable

log = logging.getLogger(__name__)


class EngineHealth:
    def __init__(self):
        self._lock = Lock()
        self._state = {
            "engine_status": "unchecked",
            "engine_available": None,
            "engine_error": None,
            "engine_version": None,
        }

    def snapshot(self):
        with self._lock:
            return dict(self._state)

    def ready(self, version):
        with self._lock:
            self._state.update(
                engine_status="ready",
                engine_available=True,
                engine_error=None,
                engine_version=version or None,
            )

    def failed(self):
        # Exception text belongs in administrator logs, not cross-account health.
        log.exception("engine_unavailable")
        with self._lock:
            self._state.update(
                engine_status="unavailable",
                engine_available=False,
                engine_error="Stockfish is unavailable. Check STOCKFISH_PATH and the server logs.",
                engine_version=None,
            )

    def observe(self, factory):
        def create(settings, sessions):
            try:
                engine = factory(settings, sessions)
            except EngineUnavailable:
                self.failed()
                raise
            return ObservedEngine(engine, self)

        return create


class ObservedEngine:
    """Observe native calls while preserving the pool's account-session rebinding."""

    def __init__(self, engine, health):
        self._engine, self._health = engine, health

    def __getattr__(self, name):
        return getattr(self._engine, name)

    @property
    def sessions(self):
        return self._engine.sessions

    @sessions.setter
    def sessions(self, value):
        self._engine.sessions = value

    def _run(self, method, *args, **kwargs):
        try:
            result = getattr(self._engine, method)(*args, **kwargs)
        except EngineReferenceMismatch:
            # The engine started successfully; only this saved evidence is incompatible.
            self._health.ready(self._engine.version)
            raise
        except EngineUnavailable:
            self._health.failed()
            raise
        self._health.ready(self._engine.version)
        return result

    def start(self, **kwargs):
        return self._run("start", **kwargs)

    def analyze(self, *args, **kwargs):
        return self._run("analyze", *args, **kwargs)

    def close(self):
        # Normal idle/shutdown cleanup does not mean that the executable failed.
        self._engine.close()
