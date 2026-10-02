"""Current evidence coverage. These counts are not accuracy estimates."""

from collections import Counter, defaultdict

from sqlalchemy import func, select

from trainer.diagnosis_types import CUES, OUTCOME_SKILLS
from trainer.models import ClassificationRun, Decision, SkillEvidence

MECHANISM_SKILLS = set(CUES) - OUTCOME_SKILLS


def coverage(db):
    ids = set(db.scalars(select(Decision.id).where(Decision.meaningful.is_(True))))
    labels = defaultdict(set)
    for decision_id, skill in db.execute(
        select(SkillEvidence.decision_id, SkillEvidence.skill_id).where(
            SkillEvidence.active.is_(True)
        )
    ):
        if decision_id in ids:
            labels[decision_id].add(skill)
    outcomes = {key for key, skills in labels.items() if skills & OUTCOME_SKILLS}
    mechanisms = {key for key, skills in labels.items() if skills & MECHANISM_SKILLS}
    # Only each decision's latest local run matters. Rank in SQL rather than loading
    # every historical run with its full response JSON on each request.
    ranked = (
        select(
            ClassificationRun.decision_id,
            ClassificationRun.status,
            ClassificationRun.response,
            func.row_number()
            .over(
                partition_by=ClassificationRun.decision_id,
                order_by=(ClassificationRun.created_at.desc(), ClassificationRun.id),
            )
            .label("rank"),
        )
        .where(ClassificationRun.provider == "local_rules")
        .subquery()
    )
    latest = {}
    for decision_id, status, response in db.execute(
        select(ranked.c.decision_id, ranked.c.status, ranked.c.response).where(ranked.c.rank == 1)
    ):
        if decision_id in ids:
            latest[decision_id] = (status, response)
    reasons = Counter(
        reason
        for status, response in latest.values()
        if status == "completed"
        for reason in (response or {}).get("abstention_reasons", [])
    )
    return {
        "total": len(ids),
        "labeled": len(labels),
        "outcomes": len(outcomes),
        "mechanisms": len(mechanisms),
        "outcome_only": len(outcomes - mechanisms),
        "unclassified": len(ids - labels.keys()),
        "pending": len(ids - latest.keys()),
        "abstention_reasons": dict(reasons),
    }
