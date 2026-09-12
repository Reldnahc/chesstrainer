from collections import defaultdict

from sqlalchemy import select, update

from trainer.models import (
    Course,
    CourseUnit,
    Decision,
    Exercise,
    Lesson,
    Review,
    SkillEvidence,
    UnitEvidence,
    now,
)
from trainer.scheduling import utc
from trainer.taxonomy import SKILLS


def priorities(db, settings):
    rows = db.execute(select(SkillEvidence, Decision).join(Decision)).all()
    grouped = defaultdict(list)
    for evidence, decision in rows:
        grouped[evidence.skill_id].append((evidence, decision))
    result = []
    for skill, pairs in grouped.items():
        games = {d.game_id for _, d in pairs}
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
        foundation = skill in {
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
        score *= 0.8 if len(review_rows) >= 5 and failures == 0 else 1
        result.append(
            {
                "skill_id": skill,
                "title": SKILLS[skill]["title"],
                "independent_games": len(games),
                "occurrences": len(pairs),
                "priority": round(score, 1),
                "reviews": len(review_rows),
                "failures": failures,
                "provisional": len(games) < settings.min_independent_games,
                "evidence_ids": [e.id for e, _ in pairs],
                "decision_ids": list(dict.fromkeys(d.id for _, d in pairs)),
            }
        )
    return sorted(
        result, key=lambda item: (item["provisional"], -item["priority"], item["skill_id"])
    )


def build_course(db, settings):
    ranked = priorities(db, settings)
    if not ranked:
        return None
    db.execute(update(Course).where(Course.active.is_(True)).values(active=False))
    course = Course(title="Your practice course", target_rating=settings.target_rating)
    db.add(course)
    db.flush()
    for ordinal, item in enumerate(ranked[:6]):
        provisional = item["provisional"]
        rationale = (
            f"{item['occurrences']} verified example(s) across {item['independent_games']} game(s). "
            + (
                "Exploratory practice; there is not enough independent evidence to call this a recurring weakness."
                if provisional
                else "Repeated independent evidence makes this a teaching priority."
            )
        )
        unit = CourseUnit(
            course_id=course.id,
            skill_id=item["skill_id"],
            title=item["title"],
            rationale=rationale,
            ordinal=ordinal,
            provisional=provisional,
        )
        db.add(unit)
        db.flush()
        for evidence_id in item["evidence_ids"]:
            db.add(UnitEvidence(unit_id=unit.id, evidence_id=evidence_id))
        for order, stage in enumerate(["diagnose", "teach", "drill", "retain"]):
            db.add(Lesson(unit_id=unit.id, stage=stage, ordinal=order))
    db.commit()
    return course
