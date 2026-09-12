from collections import defaultdict

from sqlalchemy import select

from trainer.chess_core import digest, position_key, valid_board
from trainer.diagnosis_types import CUES, OUTCOME_SKILLS
from trainer.models import (
    Course,
    CourseRevision,
    CourseUnit,
    Decision,
    Exercise,
    Lesson,
    LessonItem,
    Review,
    ReviewSession,
    SkillEvidence,
    SRSState,
    UnitEvidence,
    now,
)
from trainer.practice import focus_queue
from trainer.scheduling import utc
from trainer.taxonomy import SKILLS


def priorities(db, settings):
    rows = db.execute(
        select(SkillEvidence, Decision).join(Decision).where(SkillEvidence.active.is_(True))
    ).all()
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
                "independent_games": len(games),
                "occurrences": len(pairs),
                "priority": round(score, 1),
                "reviews": len(review_rows),
                "failures": failures,
                "lesson_attempts": len(practice),
                "lesson_failures": practice_failures,
                "retention": "improving"
                if len(review_rows) >= 5 and failures == 0
                else "needs_practice",
                "provisional": len(games) < settings.min_independent_games,
                "evidence_ids": [e.id for e, _ in pairs],
                "decision_ids": list(dict.fromkeys(d.id for _, d in pairs)),
            }
        )
    return sorted(
        result, key=lambda item: (item["provisional"], -item["priority"], item["skill_id"])
    )


STAGES = ("diagnose", "teach", "drill", "check", "retain")
GROUP_TITLES = {
    "Tactical awareness": "Notice threats and tactical opportunities",
    "Opening and development": "Develop your pieces and protect your king",
    "Material and conversion": "Keep and convert your material",
    "Pawn play": "Make purposeful pawn decisions",
    "Endgames": "Find a plan with fewer pieces",
    "Decision making": "Build a reliable decision routine",
    "mixed": "Mixed recall",
}


def selected_exercises(db, decisions, limit):
    """Round-robin games before taking another example from the same game; merge boards."""
    by_game = defaultdict(list)
    rows = db.execute(
        select(Exercise, Decision)
        .join(Decision)
        .join(SRSState, SRSState.exercise_id == Exercise.id)
        .where(Decision.id.in_(decisions), SRSState.retired_at.is_(None))
        .order_by(Decision.created_at.desc(), Decision.ply, Exercise.id)
    ).all()
    for exercise, decision in rows:
        by_game[decision.game_id].append(exercise)
    selected, seen = [], set()
    while by_game and len(selected) < limit:
        for game_id in list(by_game):
            exercise = by_game[game_id].pop(0)
            key = position_key(valid_board(exercise.fen))
            if key not in seen:
                selected.append(exercise)
                seen.add(key)
            if not by_game[game_id]:
                del by_game[game_id]
            if len(selected) == limit:
                break
    return selected


def mixed_exercises(db, groups, limit):
    pools = [
        selected_exercises(db, group["decisions"], limit)
        for group in groups
        if group["key"] != "mixed"
    ]
    result, seen = [], set()
    while any(pools) and len(result) < limit:
        for pool in pools:
            if not pool:
                continue
            exercise = pool.pop(0)
            key = position_key(valid_board(exercise.fen))
            if key not in seen:
                result.append(exercise)
                seen.add(key)
            if len(result) == limit:
                break
    return result


def ensure_sequence(db, unit, exercises, *, additional=False):
    if not exercises:
        return
    lessons = {
        lesson.stage: lesson
        for lesson in db.scalars(select(Lesson).where(Lesson.unit_id == unit.id))
    }
    base = max((lesson.ordinal for lesson in lessons.values()), default=-1) + 1 if additional else 0
    if additional:
        lessons = {}
    # Reserve unseen checks when at least six distinct real positions are available.
    held_out = exercises[-min(3, len(exercises) - 3) :] if len(exercises) >= 6 else []
    practice = exercises[: -len(held_out)] if held_out else exercises
    stages = {
        "diagnose": practice[:2],
        "teach": practice[:3],
        "drill": practice[:5],
        "check": held_out or exercises[-3:],
        "retain": [],
    }
    for ordinal, stage in enumerate(STAGES, start=base):
        lesson = lessons.get(stage)
        if lesson is None:
            lesson = Lesson(unit_id=unit.id, stage=stage, ordinal=ordinal)
            db.add(lesson)
            db.flush()
        lesson.ordinal = ordinal
        if stage == "retain":
            # Legacy manual Retain marks cannot bypass the new check.
            if "check" not in lessons:
                lesson.completed = False
            continue
        if db.scalar(select(LessonItem.id).where(LessonItem.lesson_id == lesson.id).limit(1)):
            continue
        for i, exercise in enumerate(stages[stage]):
            db.add(
                LessonItem(
                    lesson_id=lesson.id,
                    exercise_id=exercise.id,
                    ordinal=i,
                    completed=lesson.completed,
                    clean=False,
                )
            )
    db.flush()
    for exercise in exercises:
        state = db.get(SRSState, exercise.id)
        opened = db.scalar(
            select(ReviewSession.id)
            .where(
                ReviewSession.exercise_id == exercise.id,
                ReviewSession.lesson_item_id.is_(None),
                ReviewSession.completed.is_(False),
            )
            .limit(1)
        )
        if state and state.reviews == 0 and not opened:
            state.eligible = False


def build_course(db, settings):
    ranked = priorities(db, settings)
    current = db.scalar(
        select(Course).where(Course.active.is_(True)).order_by(Course.created_at.desc())
    )
    if not ranked and current is None:
        return None
    if current is None:
        current = Course(title="Your practice course", target_rating=settings.target_rating)
        db.add(current)
        db.flush()
    current.target_rating = settings.target_rating
    groups = {}
    for item in ranked:
        key = SKILLS[item["skill_id"]]["category"]
        group = groups.setdefault(
            key,
            {
                "key": key,
                "skills": [],
                "decisions": [],
                "evidence": [],
                "priority": 0,
                "provisional": True,
            },
        )
        group["skills"].append(item["skill_id"])
        group["decisions"].extend(item["decision_ids"])
        group["evidence"].extend(item["evidence_ids"])
        group["priority"] += item["priority"]
        group["provisional"] &= item["provisional"]
    chosen = sorted(groups.values(), key=lambda g: (g["provisional"], -g["priority"], g["key"]))[
        : settings.course_max_units
    ]
    if len(chosen) > 1:
        chosen.append(
            {
                "key": "mixed",
                "skills": [s for g in chosen for s in g["skills"]],
                "decisions": [d for g in chosen for d in g["decisions"]],
                "evidence": [e for g in chosen for e in g["evidence"]],
                "priority": 0,
                "provisional": all(g["provisional"] for g in chosen),
            }
        )
    existing = db.scalars(
        select(CourseUnit).where(CourseUnit.course_id == current.id).order_by(CourseUnit.ordinal)
    ).all()
    used = set()
    for ordinal, group in enumerate(chosen):
        unit = next((u for u in existing if u.id not in used and u.group_key == group["key"]), None)
        if unit is None:
            unit = next(
                (
                    u
                    for u in existing
                    if u.id not in used
                    and not u.group_key
                    and SKILLS[u.skill_id]["category"] == group["key"]
                ),
                None,
            )
        if unit is None:
            unit = CourseUnit(
                course_id=current.id,
                skill_id=group["skills"][0],
                title=GROUP_TITLES[group["key"]],
                rationale="",
                ordinal=ordinal,
                provisional=group["provisional"],
                group_key=group["key"],
            )
            db.add(unit)
            db.flush()
        used.add(unit.id)
        unit.group_key, unit.active, unit.ordinal = group["key"], True, ordinal
        unit.title, unit.provisional = GROUP_TITLES[group["key"]], group["provisional"]
        decisions = list(dict.fromkeys(group["decisions"]))
        games = db.scalars(
            select(Decision.game_id).where(Decision.id.in_(decisions)).distinct()
        ).all()
        unit.rationale = f"{len(decisions)} examples across {len(games)} independent games. " + (
            "Exploratory practice: more independent evidence is needed."
            if group["provisional"]
            else "Repeated evidence supports practicing these related skills together."
        )
        existing_links = set(
            db.scalars(select(UnitEvidence.evidence_id).where(UnitEvidence.unit_id == unit.id))
        )
        for evidence_id in dict.fromkeys(group["evidence"]):
            if evidence_id not in existing_links:
                db.add(UnitEvidence(unit_id=unit.id, evidence_id=evidence_id))
        has_items = db.scalar(
            select(LessonItem.id).join(Lesson).where(Lesson.unit_id == unit.id).limit(1)
        )
        if not has_items:
            examples = (
                mixed_exercises(db, chosen, settings.lesson_max_positions)
                if group["key"] == "mixed"
                else selected_exercises(db, decisions, settings.lesson_max_positions)
            )
            ensure_sequence(db, unit, examples)
    for unit in existing:
        if unit.id not in used:
            unit.active = False
    db.flush()
    # Never strand a withheld card after its evidence/unit is retired.
    active_cards = (
        select(LessonItem.exercise_id)
        .join(Lesson)
        .join(CourseUnit)
        .where(CourseUnit.active.is_(True))
    )
    for state in db.scalars(
        select(SRSState).where(
            SRSState.eligible.is_(False), ~SRSState.exercise_id.in_(active_cards)
        )
    ):
        state.eligible = True
    snapshot = {
        "target_rating": settings.target_rating,
        "groups": chosen,
        "evidence_runs": {
            e.id: e.classification_run_id
            for e in db.scalars(select(SkillEvidence).where(SkillEvidence.active.is_(True)))
        },
    }
    fingerprint = digest(snapshot)
    previous = db.scalar(
        select(CourseRevision)
        .where(CourseRevision.course_id == current.id)
        .order_by(CourseRevision.created_at.desc())
    )
    if previous is None or previous.fingerprint != fingerprint:
        db.add(CourseRevision(course_id=current.id, fingerprint=fingerprint, snapshot=snapshot))
    db.commit()
    return current
