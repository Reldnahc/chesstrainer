"""Host scheduling metadata; domain work always uses account-bound sessions."""

import threading

from sqlalchemy import select, update
from sqlalchemy.orm import aliased, sessionmaker

from trainer import job_lifecycle
from trainer.job_lifecycle import FETCH_KINDS, JobStatus
from trainer.models import AnalysisJob, Game, GameReview, User


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
        # Nothing runs before startup, so every running row is stale, disabled owners'
        # included: a stale row would otherwise block deleting that account. Claiming
        # still skips disabled owners.
        owner = AnalysisJob.user_id == self.user_id if self.user_id is not None else True
        with self.sessions() as db:
            db.execute(
                update(AnalysisJob)
                .where(owner, AnalysisJob.status == JobStatus.RUNNING)
                .values(status=JobStatus.QUEUED)
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
            running.status == JobStatus.RUNNING,
            running.kind.in_(FETCH_KINDS) if sync_only else running.kind.not_in(FETCH_KINDS),
        )
        with self.lock, self.sessions() as db:
            job = db.scalar(
                select(AnalysisJob)
                .outerjoin(GameReview, GameReview.job_id == AnalysisJob.id)
                .outerjoin(Game, Game.id == GameReview.game_id)
                .where(
                    AnalysisJob.user_id.in_(self.owners()),
                    AnalysisJob.user_id.not_in(busy_owners),
                    AnalysisJob.status == JobStatus.QUEUED,
                    AnalysisJob.kind.in_(FETCH_KINDS)
                    if sync_only
                    else AnalysisJob.kind.not_in(FETCH_KINDS),
                )
                # Within a priority level, the most recently played game goes first.
                .order_by(
                    AnalysisJob.priority,
                    Game.played_at.desc().nulls_last(),
                    AnalysisJob.created_at,
                    AnalysisJob.id,
                )
                .limit(1)
            )
            if job is None:
                return None
            started = job_lifecycle.start(job)
            db.commit()
            return (job.id, job.user_id) if started else None
