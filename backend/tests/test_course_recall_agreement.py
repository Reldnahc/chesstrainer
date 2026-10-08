"""A course must give one answer per position across its lessons and recall lines."""

import chess
import pytest
from trainer.chess_core import position_key
from trainer.study_lessons.bundled import BundledCourses
from trainer.study_lessons.courses.authoring import position
from trainer.study_lessons.courses.italian_positions import KNIGHT_ROUTE

COURSES = BundledCourses().courses(None)
# The White Italian deliberately teaches two plans from one position: chapter 2
# exchanges bishops with Be3, and chapter 3 prepares d4 with Ng3.
TWO_PLANS = {
    ("italian-foundations", position_key(position(KNIGHT_ROUTE).board())): {"c1e3", "f1g3"},
}


def taught_answers(course):
    learner = course.learner_color == "white"
    answers = {}

    def add(board, uci, source):
        if board.turn == learner:
            move = chess.Move.from_uci(uci)
            answers.setdefault(position_key(board), {}).setdefault(move.uci(), source)

    for chapter in course.chapters:
        for step in chapter.steps:
            if step.kind == "decision":
                for choice in step.choices:
                    add(step.position.board(), choice.uci, f"{chapter.id}/{step.id}")
    for line in course.lines:
        if line.repertoire:
            board = line.position.board()
            for uci in line.moves:
                add(board, uci, f"line {line.id}")
                board.push_uci(uci)
    return answers


@pytest.mark.parametrize("course", COURSES, ids=lambda course: course.id)
def test_lessons_and_recall_lines_agree_wherever_they_meet(course):
    # Recall merges every enrolled line's move at a position into its accepted
    # answers, so two different moves would quietly accept both.
    conflicts = {
        key: set(moves)
        for key, moves in taught_answers(course).items()
        if len(moves) > 1 and set(moves) != TWO_PLANS.get((course.id, key))
    }
    assert not conflicts
