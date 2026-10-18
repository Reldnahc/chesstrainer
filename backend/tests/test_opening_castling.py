"""Opening answer identity follows legal moves while source snapshots stay immutable."""

from copy import deepcopy

import chess
import pytest
from sqlalchemy import select
from test_opening_lifecycle import FixtureCourses, course_enroll
from trainer import reviews
from trainer.chess_core import digest
from trainer.models import (
    Exercise,
    ExerciseAnswer,
    OpeningRecallSnapshot,
    OpeningStudy,
    OpeningStudyMove,
    SRSState,
)
from trainer.opening_studies import recall
from trainer.scheduling import FSRSScheduler
from trainer.study_lessons.queries import fingerprint


def castle_course(color, *moves):
    fen = f"r3k2r/8/8/8/8/8/8/R3K2R {'w' if color == 'white' else 'b'} KQkq - 0 1"
    return FixtureCourses(
        [
            {
                "id": str(index),
                "title": f"Castle {index}",
                "repertoire": True,
                "position": {"initial_fen": fen},
                "moves": [move],
            }
            for index, move in enumerate(moves)
        ]
    )


@pytest.mark.parametrize(
    "color,alias,canonical,submit_alias",
    [("white", "e1h1", "e1g1", True), ("black", "e8a8", "e8c8", False)],
)
def test_castling_projection_and_recall_share_legal_move_identity(
    settings, sessions, color, alias, canonical, submit_alias
):
    provider = castle_course(color, alias)
    content_hash = fingerprint(provider.course)
    with sessions() as db:
        enrolled = course_enroll(db, settings, provider, "0", color)
        study = db.get(OpeningStudy, enrolled["id"])
        source = deepcopy(study.snapshot)
        source_hash = digest(source)
        contribution = db.scalar(select(OpeningStudyMove))
        exercise = db.get(Exercise, contribution.exercise_id)
        assert contribution.move_uci == canonical
        assert list(db.scalars(select(ExerciseAnswer.uci))) == [canonical]
        started = reviews.start_review(db, exercise.id)
        db.commit()
        saved = db.get(OpeningRecallSnapshot, started["session_id"])
        assert saved.studies[0]["line"] == source
        result = reviews.submit_move(
            db,
            started["session_id"],
            alias if submit_alias else canonical,
            None,
            FSRSScheduler(settings),
            settings,
        )
        db.commit()
        board = chess.Board(exercise.fen)
        board.push_uci(canonical)
        assert result["completed"] and result["grade"] == "correct"
        assert result["fen"] == board.fen()
        assert db.get(SRSState, exercise.id).reviews == 1
        assert study.snapshot == source and digest(study.snapshot) == source_hash
        assert study.snapshot["moves"] == [alias]
        assert fingerprint(provider.course) == content_hash


@pytest.mark.parametrize("color,alias,canonical,duplicate", [("white", "e1h1", "e1g1", True)])
def test_existing_alias_snapshot_accepts_canonical_castle_without_rewriting_it(
    settings, sessions, color, alias, canonical, duplicate
):
    with sessions() as db:
        course_enroll(db, settings, castle_course(color, alias), "0", color)
        exercise = db.scalar(select(Exercise).where(Exercise.source == "opening"))
        started = reviews.start_review(db, exercise.id)
        db.commit()
        snapshot = db.get(OpeningRecallSnapshot, started["session_id"])
        snapshot.answers = [row | {"uci": alias} for row in snapshot.answers]
        if duplicate:
            snapshot.answers += [snapshot.answers[0] | {"uci": canonical, "primary": False}]
        original = deepcopy(snapshot.answers)
        db.commit()
    with sessions() as db:
        snapshot = db.get(OpeningRecallSnapshot, started["session_id"])
        assert recall.answer(snapshot, primary=True).uci == canonical
        result = reviews.submit_move(
            db, started["session_id"], canonical, None, FSRSScheduler(settings), settings
        )
        db.commit()
        assert result["completed"] and result["grade"] == "correct"
        assert result["answers"] == [{"uci": canonical, "san": original[0]["san"], "primary": True}]
        assert db.get(OpeningRecallSnapshot, started["session_id"]).answers == original
