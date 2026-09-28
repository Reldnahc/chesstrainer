"""A host-wide native engine budget shared by every account and job."""

from queue import Empty, Queue

from trainer.search_limits import EngineCancelled


class EnginePool:
    def __init__(self, factory, slots):
        self.factory = factory
        self.available = Queue()
        for _ in range(slots):
            self.available.put(None)

    def handle(self, settings, sessions):
        pool = self

        class Handle:
            version = ""
            binary_hash = ""

            def __init__(self):
                self.settings = settings

            def run(self, method, *args, **kwargs):
                cancelled = kwargs.get("cancelled")
                while True:
                    if cancelled and cancelled():
                        raise EngineCancelled()
                    try:
                        engine = pool.available.get(timeout=0.05)
                        break
                    except Empty:
                        continue
                try:
                    if engine is None:
                        engine = pool.factory(settings, sessions)
                    # Lease exclusively: native process shared, account's cache stays private.
                    engine.sessions = sessions
                    result = getattr(engine, method)(*args, **kwargs)
                    self.version = engine.version
                    self.binary_hash = getattr(engine, "binary_hash", "")
                    return result
                finally:
                    pool.available.put(engine)

            def start(self, cancelled=None):
                if cancelled is None:
                    self.run("start")
                else:
                    self.run("start", cancelled=cancelled)

            def analyze(self, *args, **kwargs):
                return self.run("analyze", *args, **kwargs)

            def close(self):
                pass  # The host owns pooled processes; handles own no native resources.

        return Handle()

    def close(self):
        while not self.available.empty():
            engine = self.available.get_nowait()
            if engine is not None:
                engine.close()
