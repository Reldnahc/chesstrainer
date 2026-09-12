"""Focused practice selects real evidence without changing the FSRS recall stream."""

from collections import defaultdict

from sqlalchemy import select

from trainer.models import Decision, Exercise, SkillEvidence, SRSState
from trainer.taxonomy import SKILLS


def require_focus(db, exercise, skill_id):
    if skill_id not in SKILLS or skill_id == "unclassified":
        raise ValueError("Unknown practice skill")
    if exercise.source != "game" or not db.scalar(
        select(SkillEvidence.id).where(
            SkillEvidence.decision_id == exercise.decision_id,
            SkillEvidence.skill_id == skill_id,
            SkillEvidence.active.is_(True),
        )
    ):
        raise ValueError("This position does not have active evidence for that practice skill")


def focus_queue(db, skill_id, limit=12):
    if skill_id not in SKILLS or skill_id == "unclassified":
        raise ValueError("Unknown practice skill")
    rows = db.execute(
        select(Exercise.id, Decision.position_key, Decision.game_id)
        .join(Decision, Decision.id == Exercise.decision_id)
        .join(SkillEvidence, SkillEvidence.decision_id == Decision.id)
        .join(SRSState, SRSState.exercise_id == Exercise.id)
        .where(
            SkillEvidence.skill_id == skill_id,
            SkillEvidence.active.is_(True),
            Exercise.source == "game",
            SRSState.retired_at.is_(None),
            SRSState.eligible.is_(True),
        )
        .order_by(SRSState.lapses.desc(), Decision.created_at.desc(), Decision.ply, Exercise.id)
    ).all()
    by_game = defaultdict(list)
    for row in rows:
        by_game[row.game_id].append(row)
    selected, seen = [], set()
    while by_game and len(selected) < limit:
        for game in list(by_game):
            row = by_game[game].pop(0)
            if row.position_key not in seen:
                selected.append({"exercise_id": row.id})
                seen.add(row.position_key)
            if not by_game[game]:
                del by_game[game]
            if len(selected) == limit:
                break
    return selected
