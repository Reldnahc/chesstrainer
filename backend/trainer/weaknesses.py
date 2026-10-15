"""Active weakness priorities, including read-only historical attempt statistics."""

from collections import defaultdict

from sqlalchemy import select

from trainer.diagnosis_types import CUES, OUTCOME_SKILLS
from trainer.models import Decision, Exercise, Game, Review, ReviewSession, SkillEvidence, now
from trainer.practice import focus_queue
from trainer.taxonomy import SKILLS

# Priority scoring. A decision's severity is its loss in units of SEVERITY_CP,
# capped at MAX_SEVERITY (a lost or allowed mate is the cap); older evidence
# counts less, halving every HALF_LIFE_DAYS. FOUNDATION skills weigh more for
# learners targeting FOUNDATION_RATING or below. Review failures raise the
# score, slow answers a little (SLOW_WEIGHT), failed lesson attempts by up to
# LESSON_WEIGHT, and RETAINED (at least RETAINED_REVIEWS clean reviews) lowers it.
SEVERITY_CP = 150
MAX_SEVERITY = 3
HALF_LIFE_DAYS = 90
FOUNDATION = frozenset(
    {
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
)
FOUNDATION_RATING = 1600
FOUNDATION_WEIGHT = 1.4
SLOW_WEIGHT = 0.2
LESSON_WEIGHT = 0.25
RETAINED = 0.8
RETAINED_REVIEWS = 5
# Recent reviews, lesson attempts and focused sessions read per skill.
HISTORY = 30


def severity(decision, age_days):
    loss = (
        MAX_SEVERITY
        if decision.mate_lost or decision.allows_mate
        else min(MAX_SEVERITY, (decision.loss_cp or 0) / SEVERITY_CP)
    )
    return loss * 0.5 ** (age_days / HALF_LIFE_DAYS)


def priority_score(
    per_game, *, foundation, target_rating, reviews, failures, slow, lessons, lesson_failures
):
    """One skill's priority from its per-game severities and practice history."""
    weight = FOUNDATION_WEIGHT if foundation and target_rating <= FOUNDATION_RATING else 1.0
    seen = max(1, reviews)
    score = sum(per_game) * weight * (1 + failures / seen + SLOW_WEIGHT * slow / seen)
    score *= 1 + LESSON_WEIGHT * lesson_failures / max(1, lessons)
    return score * (RETAINED if retained(reviews, failures) else 1)


def retained(reviews, failures):
    return reviews >= RETAINED_REVIEWS and failures == 0


def active_groups(db, *, skills=None, exclude_game_id=None, stats_only=False):
    query = select(SkillEvidence, Decision).join(Decision).where(SkillEvidence.active.is_(True))
    if skills is not None:
        query = query.where(SkillEvidence.skill_id.in_(skills))
    if exclude_game_id is not None:
        query = query.where(Decision.game_id != exclude_game_id)
    if stats_only:
        query = query.join(Game, Game.id == Decision.game_id).where(Game.counts_in_stats())
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
    # Weakness rankings are stats, so casual games do not count; their drills remain.
    grouped = active_groups(db, stats_only=True)
    result = []
    for skill, pairs in grouped.items():
        # At most one severity contribution per game: correlated blunders are not independent.
        per_game = defaultdict(float)
        for evidence, decision in pairs:
            age_days = max(0, (now() - decision.created_at).days)
            per_game[decision.game_id] = max(
                per_game[decision.game_id], evidence.confidence * severity(decision, age_days)
            )
        review_rows = db.scalars(
            select(Review)
            .join(Exercise)
            .where(Exercise.decision_id.in_([d.id for _, d in pairs]))
            .order_by(Review.created_at.desc())
            .limit(HISTORY)
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
            .limit(HISTORY)
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
            .limit(HISTORY)
        ).all()
        score = priority_score(
            per_game.values(),
            foundation=skill in FOUNDATION,
            target_rating=settings.target_rating,
            reviews=len(review_rows),
            failures=failures,
            slow=slow,
            lessons=len(practice),
            lesson_failures=practice_failures,
        )
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
                if retained(len(review_rows), failures)
                else "needs_practice",
            }
        )
    return sorted(
        result, key=lambda item: (item["provisional"], -item["priority"], item["skill_id"])
    )
