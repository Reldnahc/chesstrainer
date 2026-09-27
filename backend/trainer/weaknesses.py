"""Active weakness priorities, including read-only historical attempt statistics."""

from collections import defaultdict

from sqlalchemy import select

from trainer.diagnosis_types import CUES, OUTCOME_SKILLS
from trainer.models import Decision, Exercise, Review, ReviewSession, SkillEvidence, now
from trainer.practice import focus_queue
from trainer.scheduling import utc
from trainer.taxonomy import SKILLS


def active_groups(db, *, skills=None, exclude_game_id=None):
    query = select(SkillEvidence, Decision).join(Decision).where(SkillEvidence.active.is_(True))
    if skills is not None:
        query = query.where(SkillEvidence.skill_id.in_(skills))
    if exclude_game_id is not None:
        query = query.where(Decision.game_id != exclude_game_id)
    rows = db.execute(query.order_by(Decision.game_id, Decision.ply, SkillEvidence.id)).all()
    grouped = defaultdict(list)
    for evidence, decision in rows:
        grouped[evidence.skill_id].append((evidence, decision))
    return grouped


def recurrence(pairs, minimum):
    games = {d.game_id for _, d in pairs}
    return dict(
        independent_games=len(games),
        occurrences=len(pairs),
        provisional=len(games) < minimum,
        evidence_ids=[e.id for e, _ in pairs],
        decision_ids=list(dict.fromkeys(d.id for _, d in pairs)),
    )


def priorities(db, settings):
    grouped = active_groups(db)
    result = []
    for skill, pairs in grouped.items():
        # At most one severity contribution per game: correlated blunders are not independent.
        per_game = defaultdict(float)
        for evidence, decision in pairs:
            age_days = max(0, (now() - utc(decision.created_at)).days)
            severity = (
                3
                if decision.mate_lost or decision.allows_mate
                else min(3, (decision.loss_cp or 0) / 150)
            )
            per_game[decision.game_id] = max(
                per_game[decision.game_id], evidence.confidence * severity * 0.5 ** (age_days / 90)
            )
        review_rows = db.scalars(
            select(Review)
            .join(Exercise)
            .where(Exercise.decision_id.in_([d.id for _, d in pairs]))
            .order_by(Review.created_at.desc())
            .limit(30)
        ).all()
        failures = sum(r.failed or r.revealed for r in review_rows)
        slow = sum(r.response_ms > settings.slow_answer_seconds * 1000 for r in review_rows)
        practice = db.scalars(
            select(ReviewSession)
            .join(Exercise)
            .where(
                Exercise.decision_id.in_([d.id for _, d in pairs]),
                ReviewSession.lesson_item_id.is_not(None),
                ReviewSession.completed.is_(True),
            )
            .order_by(ReviewSession.started_at.desc())
            .limit(30)
        ).all()
        practice_failures = sum(session.failed or session.revealed for session in practice)
        focused = db.scalars(
            select(ReviewSession)
            .where(
                ReviewSession.mode == "focus",
                ReviewSession.focus_skill_id == skill,
                ReviewSession.completed.is_(True),
            )
            .order_by(ReviewSession.started_at.desc())
            .limit(30)
        ).all()
        foundation = skill in {
            "material_loss",
            "missed_material_gain",
            "allowed_mate",
            "missed_mate",
            "hanging_piece",
            "opponent_threat_recognition",
            "material_awareness",
            "basic_mates",
            "king_safety",
        }
        rating_weight = 1.4 if foundation and settings.target_rating <= 1600 else 1.0
        score = (
            sum(per_game.values())
            * rating_weight
            * (1 + failures / max(1, len(review_rows)) + 0.2 * slow / max(1, len(review_rows)))
        )
        score *= 1 + 0.25 * practice_failures / max(1, len(practice))
        score *= 0.8 if len(review_rows) >= 5 and failures == 0 else 1
        result.append(
            {
                "skill_id": skill,
                "kind": "outcome" if skill in OUTCOME_SKILLS else "mechanism",
                "cue": CUES.get(skill, ""),
                "practice_positions": len(focus_queue(db, skill)),
                "focused_attempts": len(focused),
                "focused_failures": sum(s.failed or s.revealed for s in focused),
                "unique_positions": len({d.position_key for _, d in pairs}),
                "title": SKILLS[skill]["title"],
                **recurrence(pairs, settings.min_independent_games),
                "priority": round(score, 1),
                "reviews": len(review_rows),
                "failures": failures,
                "lesson_attempts": len(practice),
                "lesson_failures": practice_failures,
                "retention": "improving"
                if len(review_rows) >= 5 and failures == 0
                else "needs_practice",
            }
        )
    return sorted(
        result, key=lambda item: (item["provisional"], -item["priority"], item["skill_id"])
    )
