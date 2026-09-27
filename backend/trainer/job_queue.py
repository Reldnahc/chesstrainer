"""Host scheduling metadata; domain work always uses account-bound sessions."""

import threading

from sqlalchemy import select, update
from sqlalchemy.orm import aliased, sessionmaker

from trainer.models import AnalysisJob, User

FETCH_KINDS = ("sync", "chesscom_fetch")


class JobQueue:
    def __init__(self, sql_engine, *, user_id=None):
        self.sessions = sessionmaker(sql_engine)
        self.user_id = user_id
        self.lock = threading.Lock()

    def owners(self):
        return select(User.id).where(
            User.id == self.user_id if self.user_id is not None else User.disabled.is_(False)
        )

    def recover(self):
        with self.sessions() as db:
            db.execute(
                update(AnalysisJob)
                .where(AnalysisJob.user_id.in_(self.owners()), AnalysisJob.status == "running")
                .values(status="queued")
            )
            db.commit()

    def owner(self, job_id):
        with self.sessions() as db:
            return db.scalar(
                select(AnalysisJob.user_id).where(
                    AnalysisJob.id == job_id, AnalysisJob.user_id.in_(self.owners())
                )
            )

    def claim(self, sync_only=False):
        # Keep one analysis job per account, while other accounts can use free
        # workers. The fetch lane has its own ordering and never runs analysis.
        running = aliased(AnalysisJob)
        busy_owners = select(running.user_id).where(
            running.status == "running",
            running.kind.in_(FETCH_KINDS) if sync_only else running.kind.not_in(FETCH_KINDS),
        )
        with self.lock, self.sessions() as db:
            job = db.execute(
                select(AnalysisJob.id, AnalysisJob.user_id, AnalysisJob.cancel_requested)
                .where(
                    AnalysisJob.user_id.in_(self.owners()),
                    AnalysisJob.user_id.not_in(busy_owners),
                    AnalysisJob.status == "queued",
                    AnalysisJob.kind.in_(FETCH_KINDS)
                    if sync_only
                    else AnalysisJob.kind.not_in(FETCH_KINDS),
                )
                .order_by(AnalysisJob.created_at, AnalysisJob.id)
                .limit(1)
            ).first()
            if job is None:
                return None
            values = (
                {"status": "cancelled"}
                if job.cancel_requested
                else {
                    "status": "running",
                    "error": None,
                    "games_processed": 0,
                    "positions_triaged": 0,
                    "deep_completed": 0,
                    "mistakes_identified": 0,
                    "classifications_completed": 0,
                }
            )
            db.execute(update(AnalysisJob).where(AnalysisJob.id == job.id).values(**values))
            db.commit()
            return None if job.cancel_requested else (job.id, job.user_id)
