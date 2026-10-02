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

from trainer.cancellation import throttled
from trainer.human_models.preset import provenance
from trainer.human_models.types import HumanPolicy, HumanReadiness, ModelProvenance


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
                line = self.process.stdout.readline(262144)
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
        if len(message.encode("utf-8")) >= 262144:
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
        self.available = Queue(maxsize=settings.human_model_workers)
        for _ in range(settings.human_model_workers):
            self.available.put(None)
        self._workers = set()
        self._guard = threading.Lock()
        self._closed = threading.Event()
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
        if self.snapshot().status in {"disabled", "not_configured"}:
            raise HumanUnavailable("not_configured")
        if self.provenance.inference.get("torch") == "unavailable":
            raise HumanUnavailable("runtime_unavailable")
        deadline = monotonic() + self.settings.human_model_timeout
        waiting = throttled(cancelled)
        while True:
            if waiting() or self._closed.is_set():
                raise HumanCancelled("cancelled")
            if monotonic() >= deadline:
                raise HumanUnavailable("busy")
            with self._guard:
                if monotonic() < self._retry_after:
                    raise HumanUnavailable("cooldown")
            try:
                worker = self.available.get(timeout=0.05)
                break
            except Empty:
                continue
        with self._guard:
            cooling = monotonic() < self._retry_after
        if cooling:
            # Another request's failure started the cooldown; keep this healthy worker.
            self.available.put(worker)
            raise HumanUnavailable("cooldown")
        try:
            if worker is None:
                with self._guard:
                    if self._closed.is_set():
                        raise HumanCancelled("cancelled")
                    worker = Worker(self.command)
                    self._workers.add(worker)

            def stopping():
                return self._closed.is_set() or cancelled()

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
            result = worker.exchange(request.model_dump(mode="json"), deadline, stopping)
            policy = HumanPolicy.model_validate(result.get("policy"))
            if policy.provenance != self.provenance:
                raise HumanUnavailable("provenance_mismatch")
            with self._guard:
                self._state = "ready"
            return policy
        except Exception as exc:
            if worker is not None:
                worker.close()
                with self._guard:
                    self._workers.discard(worker)
                worker = None
            if isinstance(exc, HumanCancelled):
                raise
            with self._guard:
                self._state = "unavailable"
                self._retry_after = monotonic() + 60
            raise HumanUnavailable("prediction_unavailable") from exc
        finally:
            self.available.put(worker)

    def close(self):
        self._closed.set()
        with self._guard:
            workers = list(self._workers)
        for worker in workers:
            worker.close()
