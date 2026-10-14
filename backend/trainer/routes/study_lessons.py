"""New authored Study lessons. Historical course endpoints remain archived."""

import json

import chess
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from trainer.authz import administrator, is_administrator
from trainer.chess_core import legal_move_options
from trainer.contracts.study_lessons import (
    CourseFileCheck,
    CourseFileDeleted,
    CourseFileSaved,
    EditorPosition,
    EditorPositionRequest,
    HiddenCourse,
    LessonCommand,
    LessonCourseView,
    LessonLibrary,
    LessonSessionView,
    LessonStart,
)
from trainer.study_lessons import course_files, presentation, queries, sessions
from trainer.study_lessons.club import CourseConflict
from trainer.study_lessons.course_files import CourseFileError
from trainer.workspaces import CurrentWorkspace

MAX_COURSE_FILE_BYTES = 5_000_000


# Local single-user installs manage their own courses; with accounts, admins do.
course_admin = administrator("Only an administrator can change courses.")


async def read_course_json(request):
    """The request body as JSON, refusing anything over the size limit before reading it all."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_COURSE_FILE_BYTES:
        raise HTTPException(413, "The course file is too large.")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_COURSE_FILE_BYTES:
            raise HTTPException(413, "The course file is too large.")
    try:
        return json.loads(bytes(body))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(422, f"The file is not valid JSON: {exc}") from exc


def create_router(*, providers, installed=None):
    router = APIRouter()

    def club():
        if installed is None:
            raise HTTPException(409, "This server does not keep club course files.")
        return installed.club

    @router.get("/api/study/courses", response_model=LessonLibrary)
    def library(workspace: CurrentWorkspace, request: Request):
        manager = is_administrator(request)
        with workspace.sessions() as db:
            result = queries.library(db, providers)
        problems = installed.club.problems() if installed and manager else []
        hidden = installed.hidden_built_ins() if installed and manager else []
        return {**result, "can_manage": manager, "problems": problems, "hidden_built_ins": hidden}

    @router.get("/api/study/courses/{course_id}", response_model=LessonCourseView)
    def course(
        workspace: CurrentWorkspace,
        request: Request,
        course_id: str,
        revision: str | None = None,
    ):
        with workspace.sessions() as db:
            view = queries.course_view(db, providers, course_id, revision)
        return {**view, "can_manage": is_administrator(request)}

    @router.get(
        "/api/study/courses/{course_id}/file",
        response_class=Response,
        responses={
            200: {
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "description": "A course file; see docs/COURSE_FILES.md.",
                            "properties": {
                                "format": {"type": "string"},
                                "id": {"type": "string"},
                                "revision": {"type": "string"},
                            },
                            "additionalProperties": True,
                        }
                    }
                }
            }
        },
    )
    def export_course(workspace: CurrentWorkspace, course_id: str, revision: str | None = None):
        """Anyone may download a course as a course file."""
        with workspace.sessions() as db:
            course = queries.course_for(db, providers, course_id, revision)
        text = json.dumps(
            course_files.dump(course, providers.topic(course.id)), indent=2, ensure_ascii=False
        )
        return Response(
            text + "\n",
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{course.id}.json"'},
        )

    @router.post(
        "/api/study/course-files",
        dependencies=[course_admin],
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
    async def save_course(request: Request, base_revision: str | None = None, create: bool = False):
        """Import or save a course file. Administrators only.

        The editor sends ``create`` for a new course and ``base_revision`` for the
        revision it opened, so a save never silently replaces another course.
        """
        data = await read_course_json(request)
        folder = club()
        try:
            course, _, changed = await run_in_threadpool(
                folder.save, data, base_revision=base_revision, create=create
            )
        except CourseFileError as exc:
            raise HTTPException(422, str(exc)) from exc
        except CourseConflict as exc:
            raise HTTPException(409, str(exc)) from exc
        return {
            "id": course.id,
            "revision": course.revision,
            "title": course.title,
            "revision_changed": changed,
        }

    @router.post(
        "/api/study/course-files/check",
        dependencies=[course_admin],
        response_model=CourseFileCheck,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {"schema": {"type": "object", "additionalProperties": True}}
                },
            }
        },
    )
    async def check_course(request: Request):
        """The lesson editor's live check: the first problem and each step's board."""
        data = await read_course_json(request)
        return await run_in_threadpool(course_files.check, data)

    @router.post(
        "/api/study/course-files/position",
        response_model=EditorPosition,
        dependencies=[course_admin],
    )
    def editor_position(request: Request, data: EditorPositionRequest):
        """Play recorded editor moves; legality stays on the server."""
        try:
            board = chess.Board(data.fen or chess.STARTING_FEN)
            if not board.is_valid():
                raise ValueError("That FEN is not a legal position")
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        history = []
        for token in data.moves.split():
            try:
                move = board.parse_san(token)
            except ValueError as exc:
                raise HTTPException(422, f"{token} is not a legal move here") from exc
            history.append(board.san(move))
            board.push(move)
        san = None
        if data.move:
            uci = data.move.uci
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                raise HTTPException(422, "That move is not legal here")
            san = board.san(move)
            history.append(san)
            board.push(move)
        return {
            "fen": board.fen(),
            "moves": " ".join(history),
            "san": san,
            "turn": "white" if board.turn else "black",
            "legal_moves": legal_move_options(board),
        }

    @router.delete(
        "/api/study/course-files/{course_id}",
        response_model=CourseFileDeleted,
        dependencies=[course_admin],
    )
    def delete_course(request: Request, course_id: str):
        """Remove a club course file, or hide a built-in course for this install.

        Deleting a club file that replaced a built-in course brings the built-in
        back. Members' progress stays in the database either way.
        """
        folder = club()
        built_in = course_id in installed.built_in_ids()
        if folder.delete(course_id):
            return {
                "id": course_id,
                "built_in_restored": built_in and course_id not in folder.hidden(),
            }
        if built_in and folder.set_hidden(course_id, True):
            return {"id": course_id, "built_in_restored": False, "hidden": True}
        raise HTTPException(404, "No course has that id.")

    @router.post(
        "/api/study/course-files/{course_id}/restore",
        response_model=HiddenCourse,
        dependencies=[course_admin],
    )
    def restore_course(request: Request, course_id: str):
        """Bring back a deleted built-in course."""
        folder = club()
        course = next(
            (item for item in installed.hidden_built_ins() if item["id"] == course_id), None
        )
        if course is None:
            raise HTTPException(404, "No deleted built-in course has that id.")
        folder.set_hidden(course_id, False)
        return course

    @router.post("/api/study/lesson-sessions", response_model=LessonSessionView)
    def start(workspace: CurrentWorkspace, data: LessonStart):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.start_session(db, providers, data)

    @router.get("/api/study/lesson-sessions/{session_id}", response_model=LessonSessionView)
    def get_session(workspace: CurrentWorkspace, session_id: str):
        with workspace.sessions() as db:
            session = sessions.require_session(db, session_id)
            return presentation.view(session, providers.topic(session.course_id))

    @router.post(
        "/api/study/lesson-sessions/{session_id}/command", response_model=LessonSessionView
    )
    def command(workspace: CurrentWorkspace, session_id: str, data: LessonCommand):
        with workspace.mutation_lock, workspace.sessions() as db:
            return sessions.command(db, providers, session_id, data)

    return router
