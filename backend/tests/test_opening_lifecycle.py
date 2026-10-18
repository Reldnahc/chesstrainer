"""Content-authority changes preserve memory while invalidating old recall authority."""

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from test_opening_journey import (
    app_for,
    enroll_catalogue,
    exercise_at,
    response_json,
    start,
    submit,
)
from trainer import reviews
from trainer.contracts.opening_studies import OpeningEnrollment, OpeningPracticeStart
from trainer.models import (
    Exercise,
    ExerciseAnswer,
    OpeningStudy,
    OpeningStudyMove,
    SRSState,
    now,
)
from trainer.opening_studies import service, sources
from trainer.scheduling import FSRSScheduler
from trainer.study_lessons.content import CourseDefinition
from trainer.study_lessons.providers import CourseProviders
from trainer.study_lessons.queries import course_for
from trainer.study_lessons.sessions import require_session


class FixtureCourses:
    def __init__(self, lines):
        self.course = CourseDefinition.model_validate(
            {
                "id": "lifecycle",
                "revision": "one",
                "title": "Opening lifecycle fixture",
                "learner_color": "white",
                "attributions": [{"text": "Hand-authored legal test positions"}],
                "lines": lines,
                "chapters": [
                    {
                        "id": "intro",
                        "title": "Context",
                        "entry_step": "intro",
                        "steps": [{"id": "intro", "kind": "explanation", "title": "Context"}],
                    }
                ],
            }
        )

    def courses(self, db):
        return (self.course,)


def course_enroll(db, settings, provider, line_id, color="white"):
    return service.enroll_line(
        db,
        CourseProviders((provider,)),
        OpeningEnrollment(
            source="course_line",
            source_key=sources.course_key("lifecycle", line_id),
            source_version="one",
            course_id="lifecycle",
            line_id=line_id,
            color=color,
        ),
        FSRSScheduler(settings),
    )


def test_transpositions_share_one_position_and_duplicate_enrollment_is_idempotent(
    settings, sessions
):
    provider = FixtureCourses(
        [
            {
                "id": "a",
                "title": "Knight first",
                "repertoire": True,
                "moves": ["g1f3", "d7d5", "d2d4", "g8f6", "c2c4"],
            },
            {
                "id": "b",
                "title": "Pawn first",
                "repertoire": True,
                "moves": ["d2d4", "g8f6", "g1f3", "d7d5", "c2c4"],
            },
        ]
    )
    with sessions() as db:
        a = course_enroll(db, settings, provider, "a")
        b = course_enroll(db, settings, provider, "b")
        repeated = course_enroll(db, settings, provider, "a")
        assert repeated["id"] == a["id"]
        contributions = list(db.scalars(select(OpeningStudyMove)))
        assert len(contributions) == 6
        final = [row for row in contributions if row.ply == 4]
        assert final[0].fen != final[1].fen  # Halfmove counters differ.
        assert final[0].exercise_id == final[1].exercise_id
        assert {row.study_id for row in final} == {a["id"], b["id"]}
        answers = list(
            db.scalars(
                select(ExerciseAnswer).where(ExerciseAnswer.exercise_id == final[0].exercise_id)
            )
        )
        assert [row.uci for row in answers] == ["c2c4"]
        assert db.get(SRSState, final[0].exercise_id).reviews == 0


SPECIALS = [
    ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1", False),
    ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", "e5d6", True),
    ("7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8n", False),
]


@pytest.mark.parametrize("fen,uci,mirror", SPECIALS)
def test_curated_recall_grades_special_moves_for_both_colors(settings, sessions, fen, uci, mirror):
    board, move = chess.Board(fen), chess.Move.from_uci(uci)
    if mirror:
        board = board.mirror()
        move = chess.Move(
            chess.square_mirror(move.from_square),
            chess.square_mirror(move.to_square),
            promotion=move.promotion,
        )
    color = "white" if board.turn else "black"
    provider = FixtureCourses(
        [
            {
                "id": "special",
                "title": "Legal special move",
                "repertoire": True,
                "position": {"initial_fen": board.fen()},
                "moves": [move.uci()],
            }
        ]
    )
    with sessions() as db:
        course_enroll(db, settings, provider, "special", color)
        exercise = db.scalar(select(Exercise).where(Exercise.source == "opening"))
        cold = reviews.start_review(db, exercise.id)
        db.commit()
        assert cold["orientation"] == color and cold["fen"] == board.fen()
        san = board.san(move)
        result = reviews.submit_move(
            db, cold["session_id"], move.uci(), None, FSRSScheduler(settings), settings
        )
        db.commit()
        board.push(move)
        assert result["completed"] and result["grade"] == "correct"
        assert result["submitted_san"] == san
        assert result["continuations"][0]["moves"][0].after_fen == board.fen()


def test_failed_current_attempt_counts_as_due_in_study_library(settings):
    app = app_for(settings)
    with TestClient(app) as client:
        study = enroll_catalogue(client, "e2e4")
        cold = start(client, exercise_at(app))
        submit(client, cold["session_id"], "d2d4")
        with app.state.sessions() as db:
            state = db.get(SRSState, cold["exercise_id"])
            assert state.due > now()
        library = response_json(client.get("/api/opening-studies"))
        assert library["due_positions"] == 1
        assert library["items"][0]["due_positions"] == 1
        assert (
            response_json(client.get(f"/api/opening-studies/{study['id']}"))["due_positions"] == 1
        )
        assert response_json(client.get("/api/review/count"))["due"] == 1


def test_saved_source_restores_and_dedicated_practice_resolves_after_provider_disappears(
    settings, sessions
):
    provider = FixtureCourses(
        [
            {
                "id": "a",
                "title": "Saved line",
                "repertoire": True,
                "moves": ["e2e4", "e7e5"],
            }
        ]
    )
    with sessions() as db:
        study = course_enroll(db, settings, provider, "a")
        service.toggle(db, study["id"], False)
        db.commit()
        provider.courses = lambda db: ()
        restored = course_enroll(db, settings, provider, "a")
        assert restored["id"] == study["id"] and restored["line"].moves == ["e2e4", "e7e5"]
        assert db.scalar(select(OpeningStudy)).snapshot == study["line"].model_dump(mode="json")
        practiced = service.practice(db, study["id"], OpeningPracticeStart(request_id="practice"))
        db.commit()
        practice_id = practiced["id"]
        course_id, revision = practiced["course_id"], practiced["course_revision"]
    with sessions() as db:
        course = course_for(db, CourseProviders(()), course_id, revision)
        assert course.lines[0].moves == ("e2e4", "e7e5")
        assert require_session(db, practice_id).course_revision == revision
