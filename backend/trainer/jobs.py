import logging
import threading

from sqlalchemy import select, update

from trainer.chesscom import ChessComClient, ChessComError, ImportCancelled, fetch_import
from trainer.engine import Stockfish
from trainer.models import AnalysisJob, Game, ImportGame
from trainer.pipeline import JobPipeline

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
        import_lock=None,
    ):
        self.settings, self.sessions = settings, sessions
        self.scheduler, self.classifier = scheduler, classifier
        self.engine_factory = engine_factory
        self.chesscom_factory = chesscom_factory
        self.chesscom_lock = threading.Lock()
        self.import_lock = import_lock if import_lock is not None else threading.Lock()
        self.stop_event = threading.Event()
        self.claim_lock = threading.Lock()
        self.course_lock = self.import_lock
        self.threads = []
        self.pipeline = None
        self.active_job_id = None

    def recover(self):
        with self.sessions() as db:
            db.execute(
                update(AnalysisJob).where(AnalysisJob.status == "running").values(status="queued")
            )
            db.commit()

    def start(self):
        self.recover()
        # Jobs remain ordered; parallelism is inside each job across its games/decisions.
        for sync_only in (False, True):
            thread = threading.Thread(
                target=self.loop,
                args=(sync_only,),
                name="sync-coordinator" if sync_only else "job-coordinator",
                daemon=True,
            )
            thread.start()
            self.threads.append(thread)

    def stop(self):
        self.stop_event.set()
        for thread in self.threads:
            thread.join()

    def claim(self, sync_only=False):
        with self.claim_lock, self.sessions() as db:
            job = db.scalar(
                select(AnalysisJob)
                .where(AnalysisJob.status == "queued")
                .where(
                    AnalysisJob.kind.in_(["sync", "chesscom_fetch"])
                    if sync_only
                    else AnalysisJob.kind.not_in(["sync", "chesscom_fetch"])
                )
                .order_by(AnalysisJob.created_at)
            )
            if job is None:
                return None
            if job.cancel_requested:
                job.status = "cancelled"
                db.commit()
                return None
            job.status = "running"
            job.error = None
            for key in (
                "games_processed",
                "positions_triaged",
                "deep_completed",
                "mistakes_identified",
                "classifications_completed",
            ):
                setattr(job, key, 0)
            db.commit()
            return job.id

    def cancelled(self, job_id):
        with self.sessions() as db:
            return self.stop_event.is_set() or db.get(AnalysisJob, job_id).cancel_requested

    def loop(self, sync_only=False):
        while not self.stop_event.is_set():
            job_id = self.claim(sync_only)
            if job_id:
                self.run_job(job_id)
            else:
                self.stop_event.wait(0.5)

    def run_job(self, job_id, engine=None):
        log.info("job_started", extra={"job_id": job_id})
        try:
            with self.sessions() as db:
                kind = db.get(AnalysisJob, job_id).kind
            if kind == "game_review":
                from trainer.game_review import run_review

                run_review(self, job_id, engine)
                if self.cancelled(job_id):
                    self.finish_cancel(job_id)
                else:
                    with self.sessions() as db:
                        db.get(AnalysisJob, job_id).status = "completed"
                        db.commit()
                return
            if kind == "teaching":
                raise ValueError("Model teaching generation has been removed")
            if kind in {"chesscom", "chesscom_fetch", "sync"}:
                # Serialize all provider traffic even when multiple analysis workers run.
                with self.chesscom_lock:
                    client = self.chesscom_factory(self.settings)
                    try:
                        fetch_import(
                            job_id,
                            self.sessions,
                            self.settings,
                            client,
                            lambda: self.cancelled(job_id),
                            self.import_lock,
                        )
                    finally:
                        client.close()
                if kind in {"sync", "chesscom_fetch"}:
                    if self.cancelled(job_id):
                        self.finish_cancel(job_id)
                    else:
                        with self.sessions() as db:
                            db.get(AnalysisJob, job_id).status = "completed"
                            db.commit()
                    return
            with self.sessions() as db:
                job = db.get(AnalysisJob, job_id)
                kind = job.kind
                if kind == "classification":
                    game_ids = db.scalars(select(Game.id)).all()
                else:
                    game_ids = db.scalars(
                        select(ImportGame.game_id).where(
                            ImportGame.import_id == job.import_id, ImportGame.is_new.is_(True)
                        )
                    ).all()
                job.games_total = len(game_ids)
                db.commit()
            self.active_job_id = job_id
            self.pipeline = JobPipeline(self, job_id, engine)
            if kind == "enrichment":
                self.pipeline.run_enrichment()
            else:
                self.pipeline.run(game_ids, classification_only=kind == "classification")
            with self.course_lock, self.sessions() as db:
                if self.cancelled(job_id):
                    self.finish_cancel(job_id)
                    return
                job = db.get(AnalysisJob, job_id)
                job.status = "completed"
                db.commit()
            log.info("job_completed", extra={"job_id": job_id})
        except ImportCancelled:
            self.finish_cancel(job_id)
        except Exception as exc:
            with self.sessions() as db:
                job = db.get(AnalysisJob, job_id)
                job.status = "failed"
                from trainer.engine import EngineUnavailable

                job.error = (
                    str(exc)
                    if isinstance(exc, (EngineUnavailable, ChessComError))
                    else f"{type(exc).__name__}: analysis interrupted; completed work retained."
                )
                db.commit()
            log.error("job_failed", extra={"job_id": job_id, "error_type": type(exc).__name__})
            if engine:
                engine.close()
        finally:
            if self.active_job_id == job_id:
                self.pipeline = None
                self.active_job_id = None

    def activity(self, job_id):
        pipeline = self.pipeline
        return pipeline.snapshot() if pipeline and self.active_job_id == job_id else None

    def finish_cancel(self, job_id):
        with self.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            job.status = "cancelled" if job.cancel_requested else "queued"
            db.commit()
