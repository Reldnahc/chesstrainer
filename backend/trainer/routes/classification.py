"""Local classification jobs, weakness evidence and immutable audits."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from trainer.classification import reject_run
from trainer.contracts.classification import ClassificationAudit, Evidence, Weaknesses
from trainer.contracts.common import JobCreated, Rejected
from trainer.coverage import coverage
from trainer.job_lifecycle import JobKind, ensure_job
from trainer.models import ClassificationRun, Decision, EngineAnalysis, SkillEvidence
from trainer.weaknesses import priorities
from trainer.workspaces import CurrentWorkspace


def create_router(*, settings, classifier) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/api/classifications/retry", response_model=JobCreated, response_model_exclude_unset=True
    )
    def retry_classifications(workspace: CurrentWorkspace):
        with workspace.mutation_lock, workspace.sessions() as db:
            job, _ = ensure_job(db, JobKind.CLASSIFICATION)
            db.commit()
            return {"job_id": job.id}

    @router.post(
        "/api/classifications/enrich",
        status_code=202,
        response_model=JobCreated,
        response_model_exclude_unset=True,
    )
    def enrich_classifications(workspace: CurrentWorkspace):
        with workspace.mutation_lock, workspace.sessions() as db:
            job, created = ensure_job(db, JobKind.ENRICHMENT)
            if created:
                workspace.engine.start()  # Probes need Stockfish; fail now, not in the job.
            db.commit()
            return {"job_id": job.id}

    @router.get("/api/weaknesses", response_model=Weaknesses, response_model_exclude_unset=True)
    def weaknesses(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
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

    @router.get(
        "/api/evidence/{decision_id}", response_model=Evidence, response_model_exclude_unset=True
    )
    def evidence(workspace: CurrentWorkspace, decision_id: str):
        with workspace.sessions() as db:
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

    @router.get(
        "/api/classification-runs/{run_id}",
        response_model=ClassificationAudit,
        response_model_exclude_unset=True,
    )
    def classification_run(workspace: CurrentWorkspace, run_id: str):
        with workspace.sessions() as db:
            run = db.get(ClassificationRun, run_id)
            if run is None:
                raise HTTPException(404, "Classification run not found")
            return {c.name: getattr(run, c.name) for c in ClassificationRun.__table__.columns}

    @router.post(
        "/api/classification-runs/{run_id}/reject",
        response_model=Rejected,
        response_model_exclude_unset=True,
    )
    def reject_classification(workspace: CurrentWorkspace, run_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            result = reject_run(db, run_id)
            return result

    return router
