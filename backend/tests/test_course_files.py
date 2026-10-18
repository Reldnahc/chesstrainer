"""Readable course files load into the same lessons the app already plays."""

import json

import chess
import pytest
from trainer.chess_core import position_key
from trainer.opening_book import _index
from trainer.study_lessons import course_files
from trainer.study_lessons.bundled import BundledCourses
from trainer.study_lessons.course_files import CourseFileError
from trainer.study_lessons.queries import fingerprint


def sample(**changes):
    data = {
        "format": "fieldwork-course-1",
        "id": "sample",
        "revision": "1",
        "title": "Sample",
        "side": "white",
        "credits": [{"text": "Written for a test."}],
        "lines": [{"id": "main", "title": "Main", "moves": "e4 e5 Nf3", "repertoire": True}],
        "chapters": [
            {
                "id": "start",
                "title": "Start",
                "steps": [
                    {"id": "intro", "title": "Intro", "text": "The center.", "arrows": ["e2-e4"]},
                    {"id": "push", "title": "Push", "move": "e4", "reply": "e5", "hint": "e4"},
                    {"id": "watch", "title": "Watch", "show": "Nf3 Nc6"},
                    {"id": "again", "title": "Again", "rehearse": "main"},
                ],
            }
        ],
    }
    data.update(changes)
    return data


def test_positions_carry_forward_and_defaults_fill_in():
    course, topic = course_files.load(sample())
    assert topic == "opening"
    steps = course.chapters[0].steps
    assert [step.kind for step in steps] == [
        "explanation",
        "decision",
        "demonstration",
        "rehearsal",
    ]
    assert steps[1].choices[0].uci == "e2e4" and steps[1].choices[0].reply == ("e7e5",)
    assert steps[1].choices[0].next_step == "watch"
    assert steps[2].position.moves == ("e2e4", "e7e5")
    assert steps[2].moves == ("g1f3", "b8c6")
    assert steps[3].position.moves == () and steps[3].next_step is None
    assert steps[0].annotations.arrows[0].to_square == "e4"


@pytest.mark.parametrize("course", BundledCourses().courses(None), ids=lambda course: course.id)
def test_every_bundled_course_survives_the_file_format(course):
    data = json.loads(json.dumps(course_files.dump(course, BundledCourses().topic(course.id))))
    loaded, topic = course_files.load(data)
    assert loaded == course and fingerprint(loaded) == fingerprint(course)
    assert topic == BundledCourses().topic(course.id)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda data: data["chapters"][0]["steps"][1].update(move="e5"), "e5 is not a legal move"),
        (lambda data: data["chapters"][0]["steps"][3].update(rehearse="other"), "unknown line"),
        (lambda data: data.update(side="green"), "side"),
    ],
)
def test_mistakes_name_the_place(change, message):
    data = sample()
    change(data)
    with pytest.raises(CourseFileError, match=message):
        course_files.load(data)


def _unreachable(data):
    data["chapters"][0]["steps"][2]["next"] = None
    data["chapters"][0]["steps"].insert(
        3, {"id": "aside", "title": "Aside", "text": "Unlinked.", "next": None}
    )


@pytest.mark.parametrize(
    ("change", "location"),
    [
        (
            lambda data: data["chapters"][0]["steps"][1].update(move="e5"),
            {"chapter": "start", "step": "push"},
        ),
        (
            lambda data: data["chapters"][0]["steps"][3].update(rehearse="other"),
            {"chapter": "start", "step": "again"},
        ),
        (_unreachable, {"chapter": "start", "step": "aside"}),
        # Problems the course record's own validation finds are located too.
        (
            lambda data: data["chapters"][0]["steps"][2].update(next="gone"),
            {"chapter": "start", "step": "watch"},
        ),
        (lambda data: data.update(side="green"), None),
        (lambda data: data["lines"][0].update(moves="e4 e4"), None),
    ],
)
def test_the_editor_check_says_where_a_problem_is(change, location):
    data = sample()
    change(data)
    result = course_files.check(data)
    assert result["error"] and result["location"] == location


# Lines whose last catalogued position is shallower than the code they carry.
# COURSE_SOURCES.md records why each code is right.
ECO_BEYOND_CATALOGUE = {
    # Castled before 8.Be3 Nc6: the B73 position of 6.Be3 Bg7 7.Be2 Nc6 8.O-O O-O.
    ("sicilian-dragon", "dragon-classical"): "B73",
    # 2.Nc3 Nc6 3.Bc4 Nf6 4.d3 is C28; Lichess files that position as C24.
    ("vienna-gambit", "vienna-second-knights-pin"): "C28",
}


def test_course_line_codes_match_their_deepest_catalogued_position():
    _, names = _index()
    for course in BundledCourses().courses(None):
        for line in course.lines:
            if line.eco is None:
                continue
            board = chess.Board(line.position.initial_fen)
            deepest = None
            for uci in (*line.position.moves, *line.moves):
                board.push_uci(uci)
                deepest = names.get(position_key(board), deepest)
            exception = ECO_BEYOND_CATALOGUE.get((course.id, line.id))
            # An exception the catalogue now agrees with is stale.
            assert exception != deepest[0], (course.id, line.id)
            assert line.eco == (exception or deepest[0]), (course.id, line.id, deepest)


@pytest.mark.parametrize(
    "name",
    ["chess-fundamentals.json"],
)
def test_the_editor_boards_follow_the_course_position_rule(name):
    from pathlib import Path

    from trainer.study_lessons.validation import step_result

    data = json.loads(
        (Path(course_files.__file__).parent / "courses" / name).read_text(encoding="utf-8")
    )
    course, _ = course_files.load(data)
    boards = course_files.check(data)["steps"]
    for chapter in course.chapters:
        for step in chapter.steps:
            choice = step.choices[0] if step.kind == "decision" and step.choices else None
            end = step_result(course, step, choice)
            assert boards[f"{chapter.id}/{step.id}"]["end_fen"] == end.board().fen(), step.id
