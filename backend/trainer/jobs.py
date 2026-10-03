"""A bounded host-wide scheduler; account resources exist only during execution."""

import logging
import threading
import time

from trainer.chesscom import ChessComClient
from trainer.engine import Stockfish
from trainer.game_sync import poll as poll_connections
from trainer.job_execution import JobExecution
from trainer.job_queue import JobQueue
from trainer.models import AnalysisJob, User
from trainer.presence import active_cutoff
from trainer.workspaces import Workspaces

log = logging.getLogger(__name__)


class JobRunner:
    def __init__(
        self,
        settings,
        sessions,
        scheduler,
        classifier=None,
        engine_factory=Stockfish,
        *,
        chesscom_factory=ChessComClient,
        provider_factories=None,
        import_lock=None,
        workspaces=None,
    ):
        self.settings, self.scheduler, self.classifier = settings, scheduler, classifier
        self.engine_factory, self.chesscom_factory = engine_factory, chesscom_factory
        self.workspaces = workspaces or Workspaces(
            sessions.kw["bind"], settings, engine_factory, local_lock=import_lock
        )
        self.queue = JobQueue(
            self.workspaces.sql_engine,
            user_id=None if settings.accounts_enabled else sessions.kw["info"]["user_id"],
        )
        self.import_lock = self.course_lock = self.workspaces.local_lock
        from trainer.game_providers import client_factories

        self.provider_factories = (
            client_factories() | {"chesscom": chesscom_factory} | (provider_factories or {})
        )
        self.provider_retry_at = {}
        self.provider_lock = threading.Lock()  # One active provider request per host.

        self.stop_event = threading.Event()
        self.threads = []
        self._active = {}
        self._active_lock = threading.Lock()

    def recover(self):
        self.queue.recover()

    def claim(self, sync_only=False):
        claimed = self.queue.claim(sync_only)
        return claimed[0] if claimed else None

    def start(self):
        self.recover()
        analysis_workers = self.settings.engine_slots if self.settings.accounts_enabled else 1
        for index, sync_only in enumerate([False] * analysis_workers + [True]):
            thread = threading.Thread(
                target=self.loop,
                args=(sync_only,),
                name="sync-coordinator" if sync_only else f"job-coordinator-{index}",
                daemon=True,
            )
            thread.start()
            self.threads.append(thread)
        if self.settings.sync_interval_seconds:
            thread = threading.Thread(target=self.poll, name="sync-poller", daemon=True)
            thread.start()
            self.threads.append(thread)

    def stop(self):
        self.stop_event.set()
        for thread in self.threads:
            thread.join()

    def loop(self, sync_only=False):
        while not self.stop_event.is_set():
            claimed = self.queue.claim(sync_only)
            if claimed:
                try:
                    self._run(claimed[0], claimed[1])
                except Exception:
                    # A coordinator must outlive any one job's unexpected failure.
                    log.exception("job_coordinator_error", extra={"job_id": claimed[0]})
            else:
                self.stop_event.wait(0.5)

    def poll(self):
        interval = self.settings.sync_interval_seconds
        while not self.stop_event.is_set():
            started = time.monotonic()
            with self.queue.sessions() as db:
                # A week without requests pauses polling until the learner returns.
                owners = db.scalars(
                    self.queue.owners().where(User.last_seen_at >= active_cutoff())
                ).all()
            poll_connections(self, owners)
            # Rounds never overlap: a slow round is followed by the next at once.
            self.stop_event.wait(max(0, interval - (time.monotonic() - started)))

    def run_job(self, job_id, engine=None):
        # Explicit synchronous entry point used by offline tools and tests.
        owner = self.queue.owner(job_id)
        if owner is None:
            raise ValueError("Job owner is unavailable")
        self._run(job_id, owner, engine)

    def _run(self, job_id, owner, engine=None):
        with self.workspaces.open(owner) as workspace:
            execution = JobExecution(self, workspace)
            with self._active_lock:
                if job_id in self._active:
                    # Requeued while still finishing: that execution records the outcome.
                    log.warning("job_already_executing", extra={"job_id": job_id})
                    return
                self._active[job_id] = execution
            try:
                execution.run(job_id, engine)
            finally:
                with self._active_lock:
                    del self._active[job_id]

    def cancelled(self, job_id):
        if self.stop_event.is_set():
            return True
        with self._active_lock:
            execution = self._active.get(job_id)
        if execution is None:
            return True
        with execution.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            return job is None or job.cancel_requested

    def activity(self, job_id):
        with self._active_lock:
            execution = self._active.get(job_id)
            pipeline = execution.pipeline if execution else None
        return pipeline.snapshot() if pipeline else None
