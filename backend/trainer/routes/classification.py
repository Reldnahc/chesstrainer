"""Local classification jobs, weakness evidence and immutable audits."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from trainer.classification import reject_run
from trainer.coverage import coverage
from trainer.curriculum import priorities
from trainer.models import AnalysisJob, ClassificationRun, Decision, EngineAnalysis, SkillEvidence


def create_router(*, settings, sessions, engine, classifier, runner, mutation_lock) -> APIRouter:
    router = APIRouter()

    @router.post("/api/classifications/retry")
    def retry_classifications():
        with mutation_lock, sessions() as db:
            existing = db.scalar(
                select(AnalysisJob).where(
                    AnalysisJob.kind == "classification",
                    AnalysisJob.status.in_(["queued", "running"]),
                )
            )
            if existing:
                return {"job_id": existing.id}
            job = AnalysisJob(kind="classification")
            db.add(job)
            db.commit()
            return {"job_id": job.id}

    @router.post("/api/classifications/enrich", status_code=202)
    def enrich_classifications():
        with mutation_lock, sessions() as db:
            existing = db.scalar(
                select(AnalysisJob).where(
                    AnalysisJob.kind == "enrichment",
                    AnalysisJob.status.in_(["queued", "running"]),
                )
            )
            if existing:
                return {"job_id": existing.id}
            engine.start()
            job = AnalysisJob(kind="enrichment")
            db.add(job)
            db.commit()
            return {"job_id": job.id}

    @router.get("/api/weaknesses")
    def weaknesses():
        with sessions() as db:
            return {
                "skills": priorities(db, settings),
                "coverage": coverage(db),
                "unclassified": db.scalar(
                    select(func.count())
                    .select_from(Decision)
                    .where(
                        Decision.meaningful.is_(True),
                        ~Decision.id.in_(
                            select(SkillEvidence.decision_id).where(SkillEvidence.active.is_(True))
                        ),
                    )
                ),
                "classification_available": classifier is not None,
            }

    @router.get("/api/evidence/{decision_id}")
    def evidence(decision_id: str):
        with sessions() as db:
            decision = db.get(Decision, decision_id)
            if decision is None:
                raise HTTPException(404, "Decision not found")
            rows = db.scalars(
                select(SkillEvidence).where(
                    SkillEvidence.decision_id == decision_id, SkillEvidence.active.is_(True)
                )
            ).all()
            return {
                "id": decision.id,
                "fen": decision.fen,
                "ply": decision.ply,
                "played_san": decision.move_san,
                "loss_cp": decision.loss_cp,
                "mate_lost": decision.mate_lost,
                "allows_mate": decision.allows_mate,
                "facts": decision.facts,
                "candidates": db.get(EngineAnalysis, decision.before_analysis_id).candidates,
                "classifications": [
                    {
                        "skill": e.skill_id,
                        "explanation": e.explanation,
                        "confidence": e.confidence,
                        "run_id": e.classification_run_id,
                        "provider": db.get(ClassificationRun, e.classification_run_id).provider,
                        "findings": [
                            f
                            for f in (
                                db.get(ClassificationRun, e.classification_run_id).response or {}
                            ).get("findings", [])
                            if f["skill_id"] == e.skill_id
                        ],
                    }
                    for e in rows
                ],
            }

    @router.get("/api/classification-runs/{run_id}")
    def classification_run(run_id: str):
        with sessions() as db:
            run = db.get(ClassificationRun, run_id)
            if run is None:
                raise HTTPException(404, "Classification run not found")
            return {c.name: getattr(run, c.name) for c in ClassificationRun.__table__.columns}

    @router.post("/api/classification-runs/{run_id}/reject")
    def reject_classification(run_id: str):
        with mutation_lock, runner.course_lock, sessions() as db:
            result = reject_run(db, run_id)
            return result

    return router
