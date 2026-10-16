"""One bounded host provider, with disposable isolated native workers."""

import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from queue import Empty, Full, Queue
from time import monotonic
from typing import Protocol

from trainer.cancellation import WaitCancelled, WaitTimedOut
from trainer.human_models.preset import provenance
from trainer.human_models.types import (
    MESSAGE_LIMIT,
    HumanPolicy,
    HumanReadiness,
    ModelProvenance,
)
from trainer.lazy_pool import LazyPool, PoolClosed

# Positions per worker exchange: one forward pass each, and request and reply
# lines stay well under MESSAGE_LIMIT.
BATCH_POSITIONS = 32


class HumanUnavailable(RuntimeError):
    pass


class HumanCancelled(HumanUnavailable):
    pass


class HumanProvider(Protocol):
    provenance: ModelProvenance

    def snapshot(self) -> HumanReadiness: ...
    def predict(self, request, cancelled=lambda: False) -> HumanPolicy: ...
    def close(self): ...


class Worker:
    def __init__(self, command):
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            bufsize=1,
            env=os.environ | {"HF_HUB_OFFLINE": "1", "CUBLAS_WORKSPACE_CONFIG": ":4096:8"},
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        self.messages = Queue(maxsize=4)
        self.outgoing = Queue(maxsize=1)
        self.closed = threading.Event()
        self._close_lock = threading.Lock()
        self.reader = threading.Thread(target=self._read, name="human-model-output", daemon=True)
        self.writer = threading.Thread(target=self._write, name="human-model-input", daemon=True)
        self.reader.start()
        self.writer.start()
        self.initialized = False

    def _write(self):
        try:
            while not self.closed.is_set():
                try:
                    message = self.outgoing.get(timeout=0.05)
                except Empty:
                    continue
                self.process.stdin.write(message)
                self.process.stdin.flush()
        except (OSError, ValueError):
            try:
                self.messages.put_nowait({"error": "worker_io"})
            except Full:
                pass

    def _read(self):
        try:
            while not self.closed.is_set():
                line = self.process.stdout.readline(MESSAGE_LIMIT)
                if not line or not line.endswith("\n"):
                    break
                try:
                    self.messages.put_nowait(json.loads(line))
                except (Full, ValueError):
                    break
        except (OSError, ValueError):
            pass
        finally:
            try:
                self.messages.put_nowait({"error": "worker_exited"})
            except Full:
                pass

    def exchange(self, payload, deadline, cancelled):
        if self.closed.is_set():
            raise HumanUnavailable("worker_closed")
        message = json.dumps(payload, separators=(",", ":"), allow_nan=False) + "\n"
        if len(message.encode("utf-8")) >= MESSAGE_LIMIT:
            raise HumanUnavailable("history_too_large")
        try:
            # Pipe writes can themselves block. The caller's deadline must cover
            # a child that stops consuming input as well as slow inference.
            self.outgoing.put_nowait(message)
            while True:
                if cancelled():
                    raise HumanCancelled("cancelled")
                remaining = deadline - monotonic()
                if remaining <= 0:
                    raise HumanUnavailable("deadline")
                try:
                    response = self.messages.get(timeout=min(0.05, remaining))
                except Empty:
                    continue
                if not isinstance(response, dict) or "error" in response:
                    raise HumanUnavailable("worker_failed")
                return response
        except (Full, OSError, ValueError) as exc:
            raise HumanUnavailable("worker_io") from exc

    def close(self):
        with self._close_lock:
            if self.closed.is_set():
                return
            self.closed.set()
            if self.process.poll() is None:
                self.process.kill()
            self.process.wait(timeout=5)
            self.reader.join(timeout=5)
            self.writer.join(timeout=5)
            for stream in (self.process.stdin, self.process.stdout):
                stream.close()


class MaiaProvider:
    def __init__(self, settings, *, command=None, identity=None):
        self.settings = settings
        self.provenance = identity or provenance(settings)
        self.command = command or [sys.executable, "-m", "trainer.human_models.worker"]
        self.workers = LazyPool(settings.human_model_workers, lambda: Worker(self.command))
        self._guard = threading.Lock()
        self._state = "unchecked"
        self._retry_after = 0.0

    def snapshot(self):
        if not self.settings.human_model_enabled:
            return HumanReadiness(status="disabled")
        if not Path(self.settings.human_model_path).is_file():
            return HumanReadiness(
                status="not_configured",
                message="Acquire the model with the explicit host setup command.",
            )
        if self.provenance.inference.get("torch") == "unavailable":
            return HumanReadiness(
                status="unavailable", message="The optional human-model runtime is not installed."
            )
        with self._guard:
            if self._state == "unavailable" and monotonic() >= self._retry_after:
                self._state = "unchecked"
            return HumanReadiness(
                status=self._state,
                message="Human insights are temporarily unavailable."
                if self._state == "unavailable"
                else None,
            )

    def predict(self, request, cancelled=lambda: False):
        return self.predict_many([request], cancelled)[0]

    def predict_many(self, requests, cancelled=lambda: False):
        """One worker exchange per BATCH_POSITIONS requests, in request order."""
        policies = []
        for start in range(0, len(requests), BATCH_POSITIONS):
            chunk = requests[start : start + BATCH_POSITIONS]
            payload = (
                chunk[0].model_dump(mode="json")
                if len(chunk) == 1
                else {"batch": [request.model_dump(mode="json") for request in chunk]}
            )
            reply = self._exchange(payload, cancelled)
            rows = [reply.get("policy")] if len(chunk) == 1 else reply.get("policies")
            if not isinstance(rows, list) or len(rows) != len(chunk):
                raise HumanUnavailable("prediction_unavailable")
            policies.extend(self._checked(row) for row in rows)
        return policies

    def _checked(self, row):
        try:
            policy = HumanPolicy.model_validate(row)
        except ValueError as exc:
            raise HumanUnavailable("prediction_unavailable") from exc
        if policy.provenance != self.provenance:
            raise HumanUnavailable("prediction_unavailable")
        return policy

    def _exchange(self, payload, cancelled):
        if self.snapshot().status in {"disabled", "not_configured"}:
            raise HumanUnavailable("not_configured")
        if self.provenance.inference.get("torch") == "unavailable":
            raise HumanUnavailable("runtime_unavailable")
        deadline = monotonic() + self.settings.human_model_timeout

        def admit():
            # Another request's failure started the cooldown; leave the worker idle.
            with self._guard:
                if monotonic() < self._retry_after:
                    raise HumanUnavailable("cooldown")

        def stopping():
            return self.workers.closed or cancelled()

        try:
            with self.workers.lease(stopping, deadline=deadline, admit=admit) as worker:
                if not worker.initialized:
                    reply = worker.exchange(
                        {
                            "checkpoint": str(Path(self.settings.human_model_path).resolve()),
                            "provenance": self.provenance.model_dump(mode="json"),
                        },
                        deadline,
                        stopping,
                    )
                    if reply.get("ready") is not True:
                        raise HumanUnavailable("invalid_initialization")
                    worker.initialized = True
                result = worker.exchange(payload, deadline, stopping)
        except (WaitCancelled, PoolClosed, HumanCancelled) as exc:
            raise HumanCancelled("cancelled") from exc
        except WaitTimedOut as exc:
            raise HumanUnavailable("busy") from exc
        except HumanUnavailable as exc:
            if exc.args == ("cooldown",):
                raise
            self._failed()
            raise HumanUnavailable("prediction_unavailable") from exc
        except Exception as exc:
            self._failed()
            raise HumanUnavailable("prediction_unavailable") from exc
        with self._guard:
            self._state = "ready"
        return result

    def _failed(self):
        # The pool has discarded the failed worker; the slot starts a new one.
        with self._guard:
            self._state = "unavailable"
            self._retry_after = monotonic() + 60

    def close(self):
        self.workers.close()
