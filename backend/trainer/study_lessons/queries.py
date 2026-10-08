"""Small course catalogue projections and saved revision fallback."""

import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import select

from trainer.models import StudyLessonProgress, StudyLessonSession
from trainer.study_lessons.bundled import course_topic
from trainer.study_lessons.content import CourseDefinition


def fingerprint(course):
    return hashlib.sha256(
        json.dumps(course.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()


def course_for(db, providers, course_id, revision=None, *, for_start=False, installed=None):
    """``installed`` is a course the caller already read from ``providers``,
    so a catalogue listing validates each course once rather than once per entry."""
    saved = select(StudyLessonSession.snapshot).where(StudyLessonSession.course_id == course_id)
    if revision is not None:
        saved = saved.where(StudyLessonSession.course_revision == revision)
    if installed is not None:
        course = installed
    else:
        try:
            course = providers.get(db, course_id, revision)
        except HTTPException as exc:
            snapshot = db.scalar(saved.order_by(StudyLessonSession.started_at.desc()).limit(1))
            if snapshot is None:
                raise exc
            return CourseDefinition.model_validate(snapshot)
    existing_hash = db.scalar(
        select(StudyLessonProgress.content_hash)
        .where(
            StudyLessonProgress.course_id == course.id,
            StudyLessonProgress.course_revision == course.revision,
        )
        .limit(1)
    )
    if existing_hash and existing_hash != fingerprint(course):
        # A revision is immutable even if a provider accidentally changes its file.
        if for_start:
            raise HTTPException(409, "Installed course changed without a new revision")
        snapshot = db.scalar(
            saved.where(StudyLessonSession.course_revision == course.revision).limit(1)
        )
        if snapshot is not None:
            return CourseDefinition.model_validate(snapshot)
        raise HTTPException(409, "Installed course changed without a new revision")
    return course


def completions(db):
    return set(
        tuple(row)
        for row in db.execute(
            select(
                StudyLessonProgress.course_id,
                StudyLessonProgress.course_revision,
                StudyLessonProgress.chapter_id,
            ).where(StudyLessonProgress.completed_at.is_not(None))
        )
    )


def library(db, providers):
    completed = completions(db)
    courses = []
    for candidate in providers.courses(db):
        course = course_for(db, providers, candidate.id, candidate.revision, installed=candidate)
        courses.append(
            {
                "id": course.id,
                "revision": course.revision,
                "title": course.title,
                "description": course.description,
                "learner_color": course.learner_color,
                "chapter_count": len(course.chapters),
                "completed_chapters": sum(
                    (course.id, course.revision, chapter.id) in completed
                    for chapter in course.chapters
                ),
                "topic": course_topic(course.id),
            }
        )
    resume = db.execute(
        select(
            StudyLessonSession.id,
            StudyLessonSession.course_id,
            StudyLessonSession.course_revision,
            StudyLessonSession.course_title,
            StudyLessonSession.chapter_id,
            StudyLessonSession.chapter_title,
            StudyLessonSession.updated_at,
        )
        .where(StudyLessonSession.status == "active")
        .order_by(StudyLessonSession.updated_at.desc())
        .limit(20)
    )
    return {
        "courses": courses,
        "resume": [
            {
                **row._mapping,
                "course_topic": course_topic(row.course_id),
                "updated_at": row.updated_at.isoformat(),
            }
            for row in resume
        ],
    }


def course_view(db, providers, course_id, revision=None):
    course = course_for(db, providers, course_id, revision)
    completed = completions(db)
    return {
        "id": course.id,
        "revision": course.revision,
        "title": course.title,
        "description": course.description,
        "learner_color": course.learner_color,
        "topic": course_topic(course.id),
        "chapters": [
            {
                "id": chapter.id,
                "title": chapter.title,
                "completed": (course.id, course.revision, chapter.id) in completed,
            }
            for chapter in course.chapters
        ],
        "attributions": [item.model_dump() for item in course.attributions],
        "lines": [
            {"id": line.id, "title": line.title, "repertoire": line.repertoire}
            for line in course.lines
        ],
    }
