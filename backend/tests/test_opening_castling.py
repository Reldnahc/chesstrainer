"""Opening answer identity follows legal moves while source snapshots stay immutable."""

from copy import deepcopy
from datetime import timedelta

import chess
import pytest
from sqlalchemy import select
from test_opening_lifecycle import FixtureCourses, course_enroll
from trainer import reviews
from trainer.chess_core import digest
from trainer.models import (
    Exercise,
    ExerciseAnswer,
    OpeningCard,
    OpeningRecallSnapshot,
    OpeningStudy,
    OpeningStudyMove,
    SRSState,
    now,
)
from trainer.opening_studies import recall
from trainer.scheduling import FSRSScheduler, utc
from trainer.study_lessons.queries import fingerprint

CASTLES = [
    (color, f"e{rank}{rook}{rank}", f"e{rank}{king}{rank}")
    for color, rank in (("white", "1"), ("black", "8"))
    for rook, king in (("h", "g"), ("a", "c"))
]


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


@pytest.mark.parametrize("color,alias,canonical", CASTLES)
@pytest.mark.parametrize("submit_alias", [False, True])
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
        board = chess.Board(exercise.fen)
        board.push_uci(canonical)
        assert result["completed"] and result["grade"] == "correct"
        assert result["fen"] == board.fen()
        assert db.get(SRSState, exercise.id).reviews == 1
        assert study.snapshot == source and digest(study.snapshot) == source_hash
        assert study.snapshot["moves"] == [alias]
        assert fingerprint(provider.course) == content_hash


@pytest.mark.parametrize("color,alias,canonical", CASTLES)
@pytest.mark.parametrize("duplicate", [False, True])
def test_existing_alias_snapshot_accepts_canonical_castle_without_rewriting_it(
    settings, sessions, color, alias, canonical, duplicate
):
    with sessions() as db:
        course_enroll(db, settings, castle_course(color, alias), "0", color)
        exercise = db.scalar(select(Exercise).where(Exercise.source == "opening"))
        started = reviews.start_review(db, exercise.id)
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
        assert result["completed"] and result["grade"] == "correct"
        assert result["answers"] == [{"uci": canonical, "san": original[0]["san"], "primary": True}]
        assert db.get(OpeningRecallSnapshot, started["session_id"]).answers == original


@pytest.mark.parametrize("color,alias,canonical", CASTLES)
def test_legacy_alias_union_deduplicates_without_changing_retired_target(
    settings, sessions, color, alias, canonical
):
    provider = castle_course(color, alias, canonical)
    with sessions() as db:
        first = course_enroll(db, settings, provider, "0", color)
        contribution = db.scalar(select(OpeningStudyMove))
        exercise_id = contribution.exercise_id
        card = db.get(OpeningCard, exercise_id)
        state = db.get(SRSState, exercise_id)
        # Recreate a persisted projection from before canonical answer identities.
        contribution.move_uci = alias
        db.scalar(select(ExerciseAnswer)).uci = alias
        card.last_active_answers = [alias]
        state.due = now() + timedelta(days=150)
        state.retired_at = now()
        state.retired_interval_days = 150
        db.commit()
        before = (card.revision, utc(state.due), utc(state.retired_at))
        source = deepcopy(db.get(OpeningStudy, first["id"]).snapshot)

        course_enroll(db, settings, provider, "1", color)

        assert list(db.scalars(select(ExerciseAnswer.uci))) == [canonical]
        assert card.last_active_answers == [canonical]
        assert (card.revision, utc(state.due), utc(state.retired_at)) == before
        assert state.retired_interval_days == 150
        assert card.retirement_guard_revision is None
        assert db.get(OpeningStudy, first["id"]).snapshot == source
