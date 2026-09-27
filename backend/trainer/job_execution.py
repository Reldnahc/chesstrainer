"""One job's execution, with its owner's resources captured before any work starts."""

import logging

from sqlalchemy import select

from trainer.chesscom import ChessComError, ImportCancelled, fetch_import
from trainer.models import AnalysisJob, Game, ImportGame
from trainer.pipeline import JobPipeline

log = logging.getLogger(__name__)


class JobExecution:
    def __init__(self, runner, workspace):
        self.runner = runner
        self.settings, self.sessions = runner.settings, workspace.sessions
        self.scheduler, self.classifier = runner.scheduler, runner.classifier
        self.engine_factory, self.chesscom_factory = runner.engine_factory, runner.chesscom_factory
        self.import_lock = self.course_lock = workspace.mutation_lock
        self.chesscom_lock = runner.chesscom_lock
        self.pipeline = None

    def cancelled(self, job_id):
        return self.runner.cancelled(job_id)

    def run(self, job_id, engine=None):
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
            log.exception("job_failed", extra={"job_id": job_id, "error_type": type(exc).__name__})
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
            if engine:
                engine.close()
        finally:
            self.pipeline = None

    def finish_cancel(self, job_id):
        with self.sessions() as db:
            job = db.get(AnalysisJob, job_id)
            job.status = "cancelled" if job.cancel_requested else "queued"
            db.commit()
