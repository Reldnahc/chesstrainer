"""New authored Study lessons. Historical course endpoints remain archived."""

import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from trainer.contracts.study_lessons import (
    CourseFileSaved,
    LessonCommand,
    LessonCourseView,
    LessonLibrary,
    LessonSessionView,
    LessonStart,
)
from trainer.study_lessons import course_files, presentation, queries, sessions
from trainer.study_lessons.bundled import course_topic
from trainer.study_lessons.course_files import CourseFileError
from trainer.workspaces import CurrentWorkspace

MAX_COURSE_FILE_BYTES = 5_000_000


def can_manage(request):
    """Local single-user installs manage their own courses; with accounts, admins do."""
    if not request.app.state.settings.accounts_enabled:
        return True
    user = getattr(request.state, "user", None)
    return bool(user and user.get("admin"))


def require_manager(request):
    if not can_manage(request):
        raise HTTPException(403, "Only an administrator can change courses.")


def create_router(*, providers, installed=None):
    router = APIRouter()
    source = installed.source if installed else (lambda course_id: "built_in")

    def club():
        if installed is None:
            raise HTTPException(409, "This server does not keep club course files.")
        return installed.club

    @router.get("/api/study/courses", response_model=LessonLibrary)
    def library(workspace: CurrentWorkspace, request: Request):
        manager = can_manage(request)
        with workspace.mutation_lock, workspace.sessions() as db:
            result = queries.library(db, providers, source)
        problems = installed.club.problems() if installed and manager else []
        return {**result, "can_manage": manager, "problems": problems}

    @router.get("/api/study/courses/{course_id}", response_model=LessonCourseView)
    def course(
        workspace: CurrentWorkspace,
        request: Request,
        course_id: str,
        revision: str | None = None,
    ):
        with workspace.mutation_lock, workspace.sessions() as db:
            view = queries.course_view(db, providers, course_id, revision, source)
        return {**view, "can_manage": can_manage(request)}

    @router.get(
        "/api/study/courses/{course_id}/file",
        response_class=Response,
        responses={200: {"content": {"application/json": {}}}},
    )
    def export_course(workspace: CurrentWorkspace, course_id: str, revision: str | None = None):
        """Anyone may download a course as a course file."""
        with workspace.mutation_lock, workspace.sessions() as db:
            course = queries.course_for(db, providers, course_id, revision)
        text = json.dumps(
            course_files.dump(course, course_topic(course.id)), indent=2, ensure_ascii=False
        )
        return Response(
            text + "\n",
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{course.id}.json"'},
        )

    @router.post(
        "/api/study/course-files",
        response_model=CourseFileSaved,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {"schema": {"type": "object", "additionalProperties": True}}
                },
            }
        },
    )
    async def save_course(workspace: CurrentWorkspace, request: Request):
        """Import or save a course file. Administrators only."""
        require_manager(request)
        body = await request.body()
        if len(body) > MAX_COURSE_FILE_BYTES:
            raise HTTPException(413, "The course file is too large.")
        try:
            data = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HTTPException(422, f"The file is not valid JSON: {exc}") from exc
        folder = club()
        with workspace.mutation_lock, workspace.sessions() as db:
            current = {course.id: course for course in providers.courses(db)}
        try:
            course, _, changed = folder.save(data, current)
        except CourseFileError as exc:
            raise HTTPException(422, str(exc)) from exc
        return {
            "id": course.id,
            "revision": course.revision,
            "title": course.title,
            "revision_changed": changed,
        }

    @router.delete("/api/study/course-files/{course_id}", status_code=204)
    def delete_course(request: Request, course_id: str):
        """Remove a club course file. A built-in course it replaced comes back."""
        require_manager(request)
        if not club().delete(course_id):
            raise HTTPException(404, "No club course file has that id.")
        return Response(status_code=204)

    @router.post("/api/study/lesson-sessions", response_model=LessonSessionView)
    def start(workspace: CurrentWorkspace, data: LessonStart):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.start_session(db, providers, data)

    @router.get("/api/study/lesson-sessions/{session_id}", response_model=LessonSessionView)
    def get_session(workspace: CurrentWorkspace, session_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            return presentation.view(sessions.require_session(db, session_id))

    @router.post(
        "/api/study/lesson-sessions/{session_id}/command", response_model=LessonSessionView
    )
    def command(workspace: CurrentWorkspace, session_id: str, data: LessonCommand):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.command(db, session_id, data)

    return router
