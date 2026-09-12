"""Server-owned lesson progression; chess authority stays in reviews/engine/python-chess."""

import math

from sqlalchemy import select

from trainer.chess_core import legal_move, position_key, valid_board
from trainer.curriculum import ensure_sequence, selected_exercises
from trainer.models import (
    CourseUnit,
    Decision,
    EngineAnalysis,
    Exercise,
    Lesson,
    LessonItem,
    SkillEvidence,
    SRSState,
    UnitEvidence,
)
from trainer.reviews import start_review

GUIDES = {
    "Tactical awareness": [
        "Look for your opponent's checks, captures and direct threats.",
        "Check loose pieces before committing to your own plan.",
        "Calculate the forcing reply to your candidate move.",
    ],
    "Opening and development": [
        "Check immediate threats before developing.",
        "Give undeveloped pieces useful squares.",
        "Consider your king's safety before opening the center.",
    ],
    "Material and conversion": [
        "Count the material before and after a proposed exchange.",
        "When ahead, look for safe ways to reduce counterplay.",
        "Check that a useful-looking move does not leave material exposed.",
    ],
    "Pawn play": [
        "Ask which squares a pawn move leaves behind.",
        "Check captures and promotion threats for both sides.",
        "Calculate the consequences before committing a pawn break.",
    ],
    "Endgames": [
        "Check immediate tactical and promotion threats.",
        "Look for useful king and piece activity.",
        "Calculate pawn races rather than guessing who promotes first.",
    ],
    "Decision making": [
        "Ask what changed with the opponent's last move.",
        "Compare a few forcing moves and defensive resources.",
        "Check the opponent's strongest reply before deciding.",
    ],
    "mixed": [
        "Identify the immediate threats without a concept label.",
        "Compare safe candidate moves.",
        "Check the opponent's forcing replies before committing.",
    ],
}


def ordered_lessons(db, unit_id):
    return db.scalars(
        select(Lesson).where(Lesson.unit_id == unit_id).order_by(Lesson.ordinal)
    ).all()


def lesson_items(db, lesson_id):
    return db.scalars(
        select(LessonItem).where(LessonItem.lesson_id == lesson_id).order_by(LessonItem.ordinal)
    ).all()


def current_lesson(db, unit_id):
    return next((lesson for lesson in ordered_lessons(db, unit_id) if not lesson.completed), None)


def unit_payload(db, unit, settings):
    lessons = ordered_lessons(db, unit.id)[-5:]
    current = next((lesson for lesson in lessons if not lesson.completed), None)
    items = db.scalars(select(LessonItem).join(Lesson).where(Lesson.unit_id == unit.id)).all()
    trained = {
        item.exercise_id
        for item in items
        if db.get(Lesson, item.lesson_id).stage in {"diagnose", "teach", "drill"}
    }
    checked = {
        item.exercise_id for item in items if db.get(Lesson, item.lesson_id).stage == "check"
    }
    evidence = db.scalars(
        select(SkillEvidence)
        .join(UnitEvidence)
        .where(UnitEvidence.unit_id == unit.id, SkillEvidence.active.is_(True))
    ).all()
    used = {position_key(valid_board(db.get(Exercise, item.exercise_id).fen)) for item in items}
    candidates = selected_exercises(db, list({e.decision_id for e in evidence}), 10000)
    fresh = [
        exercise for exercise in candidates if position_key(valid_board(exercise.fen)) not in used
    ]
    return {
        "new_examples": len(fresh),
        "sequence": len(ordered_lessons(db, unit.id)) // 5,
        "id": unit.id,
        "title": unit.title,
        "rationale": unit.rationale,
        "active": unit.active,
        "provisional": unit.provisional,
        "group": unit.group_key,
        "skills": sorted({e.skill_id for e in evidence}),
        "decision_ids": list(dict.fromkeys(e.decision_id for e in evidence)),
        "exercise_ids": list(dict.fromkeys(item.exercise_id for item in items)),
        "current_stage": current.stage if current else "completed",
        "completed": current is None,
        "check_reuses_examples": bool(trained & checked),
        "lessons": [
            {
                "id": lesson.id,
                "stage": lesson.stage,
                "completed": lesson.completed,
                "available": lesson == current or lesson.completed,
                "total": len(lesson_items(db, lesson.id)),
                "done": sum(item.completed for item in lesson_items(db, lesson.id)),
                "check_rounds": lesson.check_rounds,
                "last_check_correct": lesson.last_check_correct,
                "required": math.ceil(
                    len(lesson_items(db, lesson.id)) * settings.lesson_check_pass_fraction
                )
                if lesson.stage == "check"
                else None,
            }
            for lesson in lessons
        ],
    }


def teaching_example(db, item):
    exercise = db.get(Exercise, item.exercise_id)
    decision = db.get(Decision, exercise.decision_id)

    def continuation(analysis_id):
        analysis = db.get(EngineAnalysis, analysis_id)
        candidate = analysis.candidates[0]
        board = valid_board(exercise.fen)
        frames = [{"fen": board.fen(), "san": "Start", "uci": None}]
        for uci in candidate["pv"]:
            move = legal_move(board, uci)
            san = board.san(move)
            board.push(move)
            frames.append({"fen": board.fen(), "san": san, "uci": uci})
        return {"analysis_id": analysis.id, "score": candidate["score"], "frames": frames}

    return {
        "decision_id": decision.id,
        "orientation": exercise.orientation,
        "played_san": decision.move_san,
        "facts": decision.facts,
        "sound_line": continuation(decision.before_analysis_id),
        "played_line": continuation(decision.played_analysis_id),
        "interpretations": [
            {"explanation": e.explanation, "run_id": e.classification_run_id, "skill": e.skill_id}
            for e in db.scalars(
                select(SkillEvidence).where(
                    SkillEvidence.decision_id == decision.id, SkillEvidence.active.is_(True)
                )
            )
        ],
    }


def step(db, unit_id, settings):
    unit = db.get(CourseUnit, unit_id)
    if unit is None:
        raise ValueError("Course unit not found")
    lesson = current_lesson(db, unit_id)
    status = unit_payload(db, unit, settings)
    if lesson is None:
        return {"unit": status, "stage": "completed"}
    items = lesson_items(db, lesson.id)
    item = next((item for item in items if not item.completed), None)
    if item is None:
        raise ValueError("This unit needs a course refresh before starting")
    result = {
        "unit": status,
        "stage": lesson.stage,
        "item_id": item.id,
        "number": sum(i.completed for i in items) + 1,
        "total": len(items),
    }
    if lesson.stage != "teach":
        for key in ("title", "rationale", "skills", "decision_ids", "exercise_ids", "group"):
            result["unit"].pop(key, None)
    if lesson.stage == "teach":
        result["guide"] = GUIDES.get(unit.group_key, GUIDES["Decision making"])
        result["example"] = teaching_example(db, item)

    else:
        result["position"] = start_review(db, item.exercise_id, lesson_item_id=item.id)
    return result


def validate_current_item(db, item_id):
    item = db.get(LessonItem, item_id)
    if item is None:
        raise ValueError("Lesson position not found")
    lesson = db.get(Lesson, item.lesson_id)
    if item.completed:
        return item, lesson
    current = current_lesson(db, lesson.unit_id)
    first = next((i for i in lesson_items(db, lesson.id) if not i.completed), None)
    if current is None or current.id != lesson.id or first.id != item.id:
        raise ValueError("Complete the current lesson position first")
    return item, lesson


def acknowledge(db, item_id, settings):
    item, lesson = validate_current_item(db, item_id)
    if lesson.stage != "teach":
        raise ValueError("This stage requires a chess move")
    item.completed = True
    result = settle_stage(db, lesson, settings)
    db.commit()
    return result


def finish_item(db, session, settings):
    item, lesson = validate_current_item(db, session.lesson_item_id)
    if item.completed:
        return None
    item.completed = True
    item.clean = not session.failed and not session.revealed
    db.flush()
    return settle_stage(db, lesson, settings)


def settle_stage(db, lesson, settings):
    items = lesson_items(db, lesson.id)
    if not items or not all(item.completed for item in items):
        return {"stage_complete": False}
    result = {"stage_complete": True}
    if lesson.stage == "check":
        correct = sum(item.clean for item in items)
        required = math.ceil(len(items) * settings.lesson_check_pass_fraction)
        lesson.check_rounds += 1
        lesson.last_check_correct = correct
        passed = correct >= required
        result.update(check_passed=passed, correct=correct, required=required, total=len(items))
        if not passed:
            for item in items:
                item.completed = False
                item.clean = False
            result["stage_complete"] = False
            return result
        # Graduation adds no fabricated successful recall and never resets existing FSRS state.
        for item in db.scalars(
            select(LessonItem).join(Lesson).where(Lesson.unit_id == lesson.unit_id)
        ):
            db.get(SRSState, item.exercise_id).eligible = True
        for retain in ordered_lessons(db, lesson.unit_id):
            if retain.stage == "retain":
                retain.completed = True
    lesson.completed = True
    return result


def extend_unit(db, unit_id, settings):
    unit = db.get(CourseUnit, unit_id)
    if unit is None or not unit.active:
        raise ValueError("Current course unit not found")
    if current_lesson(db, unit_id) is not None:
        raise ValueError("Finish the current lesson sequence first")
    used = {
        position_key(valid_board(exercise.fen))
        for exercise in db.scalars(
            select(Exercise).join(LessonItem).join(Lesson).where(Lesson.unit_id == unit_id)
        )
    }
    decisions = db.scalars(
        select(SkillEvidence.decision_id)
        .join(UnitEvidence)
        .where(UnitEvidence.unit_id == unit_id, SkillEvidence.active.is_(True))
    ).all()
    fresh = [
        exercise
        for exercise in selected_exercises(db, decisions, 10000)
        if position_key(valid_board(exercise.fen)) not in used
    ][: settings.lesson_max_positions]
    if not fresh:
        raise ValueError("No new distinct examples are available yet")
    ensure_sequence(db, unit, fresh, additional=True)
    db.commit()
    return {"added": len(fresh)}
