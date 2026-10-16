"""Account-owned lesson snapshots, progress and exactly-once player commands."""

from sqlalchemy import select

from trainer.errors import NotFound
from trainer.models import StudyLessonCommand, StudyLessonProgress, StudyLessonSession, now
from trainer.session_commands import (
    answered_before,
    claim_revision,
    require_revision,
    started_before,
)
from trainer.study_lessons.content import CourseDefinition, Position
from trainer.study_lessons.player import initial_state, transition
from trainer.study_lessons.presentation import view
from trainer.study_lessons.queries import course_for, fingerprint

CHANGED = "Lesson changed. Reload the session before continuing."


def require_session(db, session_id):
    session = db.get(StudyLessonSession, session_id)
    if session is None:
        raise NotFound("Lesson session not found")
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
    previous = started_before(
        db,
        StudyLessonSession,
        request.request_id,
        (request.course_id, request.course_revision, request.chapter_id),
        lambda row: (row.course_id, row.course_revision, row.chapter_id),
        "Request ID already used for another lesson",
    )
    if previous:
        return view(previous, providers.topic(previous.course_id))
    course = course_for(db, providers, request.course_id, request.course_revision, for_start=True)
    try:
        chapter = course.chapter(request.chapter_id)
    except StopIteration as exc:
        raise NotFound("Course chapter not found") from exc
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
    result = view(session, providers.topic(course.id), playback)
    db.flush()
    return result


def command(db, providers, session_id, request):
    session = require_session(db, session_id)
    payload = request.model_dump(mode="json")
    answered = answered_before(
        db,
        StudyLessonCommand,
        session,
        request.request_id,
        payload,
        "Request ID already used for another lesson action",
    )
    if answered is not None:
        return answered
    require_revision(session, request.revision, CHANGED)
    course = CourseDefinition.model_validate(session.snapshot)
    chapter = course.chapter(session.chapter_id)
    state, playback = transition(course, chapter, session.state, request)
    claim_revision(db, session, request.revision, CHANGED)
    progress = progress_for(db, session)
    progress.viewed_steps = sorted(set(progress.viewed_steps) | {state["step_id"]})
    if request.action in {"move", "show_move"}:
        progress.attempted_steps = sorted(
            set(progress.attempted_steps) | {session.state["step_id"]}
        )
    session.state = state
    session.status = state["status"]
    moment = now()  # One transition, one time.
    session.updated_at = progress.updated_at = moment
    if state["status"] == "completed":
        if session.completed_at is None:
            session.completed_at = moment
        if progress.completed_at is None:
            progress.completed_at = moment
    result = view(session, providers.topic(session.course_id), playback)
    db.add(
        StudyLessonCommand(
            session_id=session.id, request_id=request.request_id, request=payload, response=result
        )
    )
    db.flush()
    return result
