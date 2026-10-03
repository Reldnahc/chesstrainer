"""Enrollment and dedicated rehearsal reuse existing Exercise and lesson machinery."""

from fastapi import HTTPException
from sqlalchemy import func, select

from trainer.chess_core import digest
from trainer.contracts.opening_studies import OpeningLine
from trainer.contracts.study_lessons import LessonStart
from trainer.models import OpeningCard, OpeningStudy, OpeningStudyMove, SRSState
from trainer.opening_studies import projection, sources
from trainer.study_lessons.content import CourseDefinition
from trainer.study_lessons.providers import CourseProviders
from trainer.study_lessons.sessions import start_session


def line_identity(snapshot):
    """The content that must match between enrollments of one pinned line.

    Additive presentation fields on OpeningLine must not make an existing study's
    other-colour enrollment fail forever.
    """
    return {key: snapshot.get(key) for key in ("initial_fen", "moves", "name", "eco")}


def require_study(db, study_id):
    study = db.get(OpeningStudy, study_id)
    if study is None:
        raise HTTPException(404, "Opening study not found")
    return study


def enroll_line(db, providers, request, scheduler):
    study = db.scalar(
        select(OpeningStudy).where(
            OpeningStudy.source == request.source,
            OpeningStudy.source_key == request.source_key,
            OpeningStudy.source_version == request.source_version,
            OpeningStudy.color == request.color,
        )
    )
    if study is not None:
        if (study.snapshot.get("course_id"), study.snapshot.get("line_id")) != (
            request.course_id,
            request.line_id,
        ):
            raise HTTPException(422, "Opening source identity does not match the saved study")
        projection.set_active(db, study, True)
    else:
        line = sources.resolve_line(db, providers, request)
        # Course revision identity also covers first-time enrollment without any lesson progress.
        siblings = db.scalars(
            select(OpeningStudy).where(
                OpeningStudy.source == line.source,
                OpeningStudy.source_key == line.source_key,
                OpeningStudy.source_version == line.source_version,
            )
        )
        current = line_identity(line.model_dump(mode="json"))
        if any(line_identity(row.snapshot) != current for row in siblings):
            raise HTTPException(409, "Opening content changed without a new source revision")
        study = OpeningStudy(
            source=line.source,
            source_key=line.source_key,
            source_version=line.source_version,
            name=line.name,
            eco=line.eco,
            color=request.color,
            snapshot=line.model_dump(mode="json"),
        )
        db.add(study)
        db.flush()
        for exercise_id in projection.contribute(db, study, scheduler):
            projection.rebuild(db, exercise_id)
    db.commit()
    return study_view(db, study)


def due_ids(db):
    from trainer.reviews import queue

    opening_ids = set(db.scalars(select(OpeningCard.exercise_id)))
    return {item["exercise_id"] for item in queue(db, limit=None)} & opening_ids


def summary(db, study, *, due=None):
    exercise_ids = set(
        db.scalars(
            select(OpeningStudyMove.exercise_id).where(OpeningStudyMove.study_id == study.id)
        )
    )
    due = due_ids(db) if due is None else due
    return {
        "id": study.id,
        "source": study.source,
        "source_key": study.source_key,
        "source_version": study.source_version,
        "name": study.name,
        "eco": study.eco,
        "color": study.color,
        "active": study.active,
        "positions": len(exercise_ids),
        "due_positions": len(exercise_ids & due) if study.active else 0,
    }


def study_view(db, study):
    line = OpeningLine.model_validate(study.snapshot)
    projection = sources.line_view(line)
    return {**summary(db, study), "line": line, "frames": projection.frames}


def library(db):
    studies = list(db.scalars(select(OpeningStudy).order_by(OpeningStudy.created_at.desc())))
    due = due_ids(db)
    eligible = (
        select(SRSState)
        .join(OpeningCard, OpeningCard.exercise_id == SRSState.exercise_id)
        .where(
            OpeningCard.active.is_(True), SRSState.eligible.is_(True), SRSState.retired_at.is_(None)
        )
    )
    return {
        "items": [summary(db, study, due=due) for study in studies],
        "active_studies": sum(study.active for study in studies),
        "learning_positions": db.scalar(select(func.count()).select_from(eligible.subquery())),
        "due_positions": len(due),
    }


def toggle(db, study_id, active):
    study = require_study(db, study_id)
    projection.set_active(db, study, active)
    db.commit()
    return study_view(db, study)


def practice(db, study_id, request):
    study = require_study(db, study_id)
    line = OpeningLine.model_validate(study.snapshot)
    course = CourseDefinition.model_validate(
        {
            "id": f"opening-practice-{study.id}",
            "revision": digest(study.snapshot),
            "title": study.name,
            "description": "Dedicated line rehearsal; your review schedule is unchanged.",
            "learner_color": study.color,
            "attributions": [{"text": f"Selected {line.source} line: {line.name}"}],
            "lines": [
                {
                    "id": "selected",
                    "title": line.name,
                    "position": {"initial_fen": line.initial_fen},
                    "moves": line.moves,
                }
            ],
            "chapters": [
                {
                    "id": "practice",
                    "title": "Practice the selected line",
                    "entry_step": "rehearsal",
                    "steps": [
                        {
                            "id": "rehearsal",
                            "kind": "rehearsal",
                            "title": "Play your studied moves",
                            "position": {"initial_fen": line.initial_fen},
                            "line_id": "selected",
                        }
                    ],
                }
            ],
        }
    )

    class SelectedLine:
        def courses(self, db):
            return (course,)

    return start_session(
        db,
        CourseProviders((SelectedLine(),)),
        LessonStart(
            course_id=course.id,
            course_revision=course.revision,
            chapter_id="practice",
            request_id=request.request_id,
        ),
    )
