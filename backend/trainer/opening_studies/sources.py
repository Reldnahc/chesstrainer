"""Normalize approved sources before enrollment; no client-supplied move truth."""

from fastapi import HTTPException

from trainer.chess_core import digest
from trainer.contracts.opening_studies import OpeningLine, OpeningLineView
from trainer.opening_studies import catalogue
from trainer.study_lessons.content import Position
from trainer.study_lessons.queries import course_for


def course_key(course_id, line_id):
    return digest([course_id, line_id])


def line_view(line):
    position = Position(initial_fen=line.initial_fen, moves=tuple(line.moves))
    frames = position.frames()
    # Set-up positions may start with Black. Count learner decisions from the
    # actual side to move, not catalogue-specific White-first assumptions.
    first_white = Position(initial_fen=line.initial_fen).board().turn
    first_count, second_count = (len(frames) + 1) // 2, len(frames) // 2
    return OpeningLineView(
        line=line,
        frames=frames,
        white_positions=first_count if first_white else second_count,
        black_positions=second_count if first_white else first_count,
    )


def course_line(db, providers, course_id, revision, line_id):
    course = course_for(db, providers, course_id, revision, for_start=True)
    try:
        line = course.line(line_id)
    except StopIteration as exc:
        raise HTTPException(404, "Course repertoire line not found") from exc
    if not line.repertoire:
        raise HTTPException(422, "Only designated course repertoire lines can be studied")
    return OpeningLine(
        source="course_line",
        source_key=course_key(course.id, line.id),
        source_version=course.revision,
        course_id=course.id,
        line_id=line.id,
        name=f"{course.title}: {line.title}",
        eco=line.eco,
        initial_fen=line.position.initial_fen,
        moves=[*line.position.moves, *line.moves],
    )


def resolve_line(db, providers, request):
    if request.source == "lichess_catalogue":
        if request.course_id is not None or request.line_id is not None:
            raise HTTPException(422, "Catalogue enrollment cannot identify a course line")
        return catalogue.get(request.source_key, request.source_version)
    if request.course_id is None or request.line_id is None:
        raise HTTPException(422, "Course enrollment requires a course and repertoire line")
    if request.source_key != course_key(request.course_id, request.line_id):
        raise HTTPException(422, "Course line identity does not match its source key")
    return course_line(db, providers, request.course_id, request.source_version, request.line_id)
