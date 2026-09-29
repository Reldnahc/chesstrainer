"""Account-owned lesson snapshots, progress and exactly-once player commands."""

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm.attributes import set_committed_value

from trainer.models import StudyLessonCommand, StudyLessonProgress, StudyLessonSession, now
from trainer.study_lessons.content import CourseDefinition, Position
from trainer.study_lessons.player import initial_state, transition
from trainer.study_lessons.presentation import view
from trainer.study_lessons.queries import course_for, fingerprint


def require_session(db, session_id):
    session = db.get(StudyLessonSession, session_id)
    if session is None:
        raise HTTPException(404, "Lesson session not found")
    return session


def progress_for(db, session):
    progress = db.scalar(
        select(StudyLessonProgress).where(
            StudyLessonProgress.course_id == session.course_id,
            StudyLessonProgress.course_revision == session.course_revision,
            StudyLessonProgress.chapter_id == session.chapter_id,
        )
    )
    if progress is None:
        progress = StudyLessonProgress(
            course_id=session.course_id,
            course_revision=session.course_revision,
            chapter_id=session.chapter_id,
            content_hash=session.content_hash,
            viewed_steps=[],
            attempted_steps=[],
        )
        db.add(progress)
    return progress


def start_session(db, providers, request):
    previous = db.scalar(
        select(StudyLessonSession).where(StudyLessonSession.request_id == request.request_id)
    )
    identity = (request.course_id, request.course_revision, request.chapter_id)
    if previous:
        if (previous.course_id, previous.course_revision, previous.chapter_id) != identity:
            raise HTTPException(409, "Request ID already used for another lesson")
        return view(previous)
    course = course_for(db, providers, request.course_id, request.course_revision, for_start=True)
    try:
        chapter = course.chapter(request.chapter_id)
    except StopIteration as exc:
        raise HTTPException(404, "Course chapter not found") from exc
    session = StudyLessonSession(
        request_id=request.request_id,
        course_id=course.id,
        course_revision=course.revision,
        course_title=course.title,
        chapter_id=chapter.id,
        chapter_title=chapter.title,
        content_hash=fingerprint(course),
        snapshot=course.model_dump(mode="json"),
        state=initial_state(course, chapter),
    )
    db.add(session)
    db.flush()
    progress = progress_for(db, session)
    progress.viewed_steps = sorted(set(progress.viewed_steps) | {chapter.entry_step})
    start = chapter.step(chapter.entry_step).position
    current = Position.model_validate(session.state["position"])
    playback = current.frames()[len(start.moves) :]
    result = view(session, playback)
    db.commit()
    return result


def command(db, session_id, request):
    session = require_session(db, session_id)
    payload = request.model_dump(mode="json")
    previous = db.scalar(
        select(StudyLessonCommand).where(
            StudyLessonCommand.session_id == session.id,
            StudyLessonCommand.request_id == request.request_id,
        )
    )
    if previous:
        if previous.request != payload:
            raise HTTPException(409, "Request ID already used for another lesson action")
        return previous.response
    if session.revision != request.revision:
        raise HTTPException(409, "Lesson changed. Reload the session before continuing.")
    course = CourseDefinition.model_validate(session.snapshot)
    chapter = course.chapter(session.chapter_id)
    state, playback = transition(course, chapter, session.state, request)
    changed = db.execute(
        update(StudyLessonSession)
        .where(
            StudyLessonSession.id == session.id,
            StudyLessonSession.revision == request.revision,
        )
        .values(revision=request.revision + 1)
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        raise HTTPException(409, "Lesson changed. Reload the session before continuing.")
    set_committed_value(session, "revision", request.revision + 1)
    progress = progress_for(db, session)
    progress.viewed_steps = sorted(set(progress.viewed_steps) | {state["step_id"]})
    if request.action in {"move", "show_move"}:
        progress.attempted_steps = sorted(
            set(progress.attempted_steps) | {session.state["step_id"]}
        )
    session.state = state
    session.status = state["status"]
    session.updated_at = progress.updated_at = now()
    if state["status"] == "completed":
        if session.completed_at is None:
            session.completed_at = now()
        if progress.completed_at is None:
            progress.completed_at = now()
    result = view(session, playback)
    db.add(
        StudyLessonCommand(
            session_id=session.id, request_id=request.request_id, request=payload, response=result
        )
    )
    db.commit()
    return result
