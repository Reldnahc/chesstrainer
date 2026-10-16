"""A host-wide native engine budget shared by every account and job."""

from trainer.cancellation import WaitCancelled
from trainer.engine import EngineUnavailable
from trainer.lazy_pool import LazyPool, PoolClosed
from trainer.search_limits import EngineCancelled


def engine_broken(engine):
    """Stockfish closes its own process when an error leaves it unusable, so a failed
    engine with its process still open is sound. One with no process is rebuilt:
    that costs nothing until the next search starts one."""
    return getattr(engine, "process", None) is None


class EnginePool:
    """Stockfish engines on one LazyPool, with its one failure rule."""

    def __init__(self, factory, slots):
        self.engines = LazyPool(slots, factory, engine_broken)

    def handle(self, settings, sessions):
        pool = self

        class Handle:
            version = ""
            binary_hash = ""

            def __init__(self):
                self.settings = settings

            def run(self, method, *args, **kwargs):
                lease = pool.engines.lease(kwargs.get("cancelled"), build_args=(settings, sessions))
                try:
                    with lease as engine:
                        # Lease exclusively: native process shared, account's cache private.
                        engine.sessions = sessions
                        result = getattr(engine, method)(*args, **kwargs)
                        self.version = engine.version
                        self.binary_hash = getattr(engine, "binary_hash", "")
                        return result
                except WaitCancelled as exc:
                    # Only the wait for a free engine raises this; searches raise their own.
                    raise EngineCancelled() from exc
                except PoolClosed as exc:
                    raise EngineUnavailable("The server is shutting down.") from exc

            def start(self, cancelled=None):
                if cancelled is None:
                    self.run("start")
                else:
                    self.run("start", cancelled=cancelled)

            def analyze(self, *args, **kwargs):
                return self.run("analyze", *args, **kwargs)

            def play_limited(self, *args, **kwargs):
                return self.run("play_limited", *args, **kwargs)

            def close(self):
                pass  # The host owns pooled processes; handles own no native resources.

        return Handle()

    def close(self):
        self.engines.close()
