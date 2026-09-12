"""Current evidence coverage. These counts are not accuracy estimates."""

from collections import Counter, defaultdict

from sqlalchemy import select

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
    latest = {}
    for run in db.scalars(
        select(ClassificationRun)
        .where(ClassificationRun.provider == "local_rules")
        .order_by(ClassificationRun.created_at.desc(), ClassificationRun.id)
    ):
        if run.decision_id in ids:
            latest.setdefault(run.decision_id, run)
    reasons = Counter(
        reason
        for run in latest.values()
        if run.status == "completed"
        for reason in (run.response or {}).get("abstention_reasons", [])
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
