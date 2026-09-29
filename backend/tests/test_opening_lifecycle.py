"""Content-authority changes preserve memory while invalidating old recall authority."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone

import chess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select
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
    OpeningCard,
    OpeningContentChange,
    OpeningStudy,
    OpeningStudyMove,
    Review,
    ReviewSession,
    SRSState,
    now,
)
from trainer.opening_studies import projection, recall, service, sources
from trainer.retirement import retire_existing, retire_if_ready
from trainer.scheduling import FSRSScheduler, utc
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
    ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1"),
    ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", "e5d6"),
    ("7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8n"),
]


@pytest.mark.parametrize("fen,uci", SPECIALS)
@pytest.mark.parametrize("mirror", [False, True])
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
        assert cold["orientation"] == color and cold["fen"] == board.fen()
        san = board.san(move)
        result = reviews.submit_move(
            db, cold["session_id"], move.uci(), None, FSRSScheduler(settings), settings
        )
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
            assert utc(state.due) > now()
        library = response_json(client.get("/api/opening-studies"))
        assert library["due_positions"] == 1
        assert library["items"][0]["due_positions"] == 1
        assert (
            response_json(client.get(f"/api/opening-studies/{study['id']}"))["due_positions"] == 1
        )
        assert response_json(client.get("/api/review/count"))["due"] == 1


@pytest.mark.parametrize("stale_sessions", [1, 25])
def test_queue_filters_stale_opening_sessions_without_per_session_queries(
    settings, sessions, stale_sessions
):
    provider = FixtureCourses(
        [
            {
                "id": "a",
                "title": "Three opening decisions",
                "repertoire": True,
                "moves": ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"],
            }
        ]
    )
    with sessions() as db:
        enrolled = course_enroll(db, settings, provider, "a")
        study = db.get(OpeningStudy, enrolled["id"])
        exercise_ids = list(
            db.scalars(
                select(OpeningStudyMove.exercise_id)
                .where(OpeningStudyMove.study_id == study.id)
                .order_by(OpeningStudyMove.ordinal)
            )
        )
        stale_id, active_id, due_id = exercise_ids
        for _ in range(stale_sessions):
            reviews.start_review(db, stale_id)
            projection.set_active(db, study, False)
            projection.set_active(db, study, True)
            db.commit()
        reviews.start_review(db, active_id)
        for exercise_id in (stale_id, active_id):
            db.get(SRSState, exercise_id).due = now() + timedelta(days=1)
        db.commit()
        engine = db.get_bind()

    statements = []

    def count_statement(*args):
        statements.append(args[2])

    event.listen(engine, "before_cursor_execute", count_statement)
    try:
        with sessions() as db:
            queue = reviews.queue(db, limit=None)
        assert [item["exercise_id"] for item in queue] == [active_id, due_id]
        assert len(statements) == 3
        statements.clear()
        with sessions() as db:
            limited = reviews.queue(db, limit=1)
        assert limited == queue[:1]
        assert len(statements) == 3
    finally:
        event.remove(engine, "before_cursor_execute", count_statement)


def test_start_skips_stale_sessions_in_one_query_and_reuses_most_recent_current_session(
    settings, sessions
):
    provider = FixtureCourses(
        [{"id": "a", "title": "One decision", "repertoire": True, "moves": ["e2e4"]}]
    )
    with sessions() as db:
        enrolled = course_enroll(db, settings, provider, "a")
        study = db.get(OpeningStudy, enrolled["id"])
        exercise_id = db.scalar(select(OpeningStudyMove.exercise_id))
        stale_ids = set()
        for _ in range(25):
            stale_ids.add(reviews.start_review(db, exercise_id)["session_id"])
            projection.set_active(db, study, False)
            projection.set_active(db, study, True)
            db.commit()
        engine = db.get_bind()

    statements = []

    def count_statement(*args):
        statements.append(args[2])

    event.listen(engine, "before_cursor_execute", count_statement)
    try:
        with sessions() as db:
            fresh = reviews.start_review(db, exercise_id)
        assert fresh["session_id"] not in stale_ids
        # Includes the new session/snapshot inserts and ownership validation.
        assert len(statements) < 25
    finally:
        event.remove(engine, "before_cursor_execute", count_statement)

    with sessions() as db:
        current = db.get(ReviewSession, fresh["session_id"])
        latest = ReviewSession(
            exercise_id=exercise_id, started_at=current.started_at + timedelta(seconds=1)
        )
        db.add(latest)
        db.flush()
        recall.snapshot_session(db, latest, db.get(Exercise, exercise_id))
        db.commit()
        latest_id = latest.id

    statements.clear()
    event.listen(engine, "before_cursor_execute", count_statement)
    try:
        with sessions() as db:
            resumed = reviews.start_review(db, exercise_id)
        assert resumed["session_id"] == latest_id
        assert resumed["review_reason"] == "resume"
        assert len(statements) < 10
    finally:
        event.remove(engine, "before_cursor_execute", count_statement)


def retire_card(app, exercise_id):
    with app.state.sessions() as db:
        state = db.get(SRSState, exercise_id)
        at = datetime(2020, 1, 1, tzinfo=timezone.utc)
        state.card = state.card | {"last_review": at.isoformat()}
        state.due, state.reviews, state.lapses = at + timedelta(days=150), 5, 2
        assert retire_if_ready(state, app.state.settings)
        db.commit()
        return (
            deepcopy(state.card),
            state.reviews,
            state.lapses,
            utc(state.due),
            utc(state.retired_at),
        )


def test_retirement_unchanged_restore_and_material_change_guard_survive_restart(settings):
    app = app_for(settings)
    with TestClient(app) as client:
        first = enroll_catalogue(client, "e2e4")
        exercise_id = exercise_at(app)
        original = retire_card(app, exercise_id)
        response_json(client.delete(f"/api/opening-studies/{first['id']}"))
        response_json(client.post(f"/api/opening-studies/{first['id']}/restore"))
        with app.state.sessions() as db:
            state = db.get(SRSState, exercise_id)
            assert (
                state.card,
                state.reviews,
                state.lapses,
                utc(state.due),
                utc(state.retired_at),
            ) == original
        second = enroll_catalogue(client, "d2d4")
        with app.state.sessions() as db:
            state = db.get(SRSState, exercise_id)
            card = db.get(OpeningCard, exercise_id)
            assert state.retired_at is None and utc(state.due) <= now()
            assert (state.card, state.reviews, state.lapses) == original[:3]
            guard = card.retirement_guard_revision
            assert guard == card.revision
            assert not list(db.scalars(select(Review)))
            assert db.scalar(
                select(OpeningContentChange).where(
                    OpeningContentChange.exercise_id == exercise_id,
                    OpeningContentChange.reason == "study_added",
                    OpeningContentChange.revision == card.revision,
                )
            ).details["before"]["retired_at"]
        # Invalidate authority again without answering. The guard must survive this epoch too.
        for study in (first, second):
            response_json(client.delete(f"/api/opening-studies/{study['id']}"))
        response_json(client.post(f"/api/opening-studies/{first['id']}/restore"))
    restarted = app_for(settings)
    with TestClient(restarted) as client:
        with restarted.state.sessions() as db:
            assert retire_existing(db, settings) == 0
            card = db.get(OpeningCard, exercise_id)
            assert card.retirement_guard_revision == guard < card.revision
            assert db.get(SRSState, exercise_id).retired_at is None
        cold = start(client, exercise_id)
        result = submit(client, cold["session_id"], "e2e4")
        assert result["scheduling_status"] == "recorded" and not result["non_scheduling_reason"]
        with restarted.state.sessions() as db:
            assert db.get(OpeningCard, exercise_id).retirement_guard_revision is None
            assert db.get(SRSState, exercise_id).reviews == 6


def test_valid_recall_that_retires_itself_is_still_reported_as_recorded(settings, monkeypatch):
    clock = [datetime(2030, 1, 1, tzinfo=timezone.utc)]
    monkeypatch.setattr(reviews, "now", lambda: clock[0])
    app = app_for(settings)
    with TestClient(app) as client:
        enroll_catalogue(client, "e2e4")
        exercise_id = exercise_at(app)
        for _ in range(8):
            cold = start(client, exercise_id)
            with app.state.sessions() as db:
                db.get(ReviewSession, cold["session_id"]).started_at = clock[0]
                db.commit()
            clock[0] += timedelta(seconds=5)
            result = submit(client, cold["session_id"], "e2e4")
            assert result["scheduling_status"] == "recorded"
            assert result["non_scheduling_reason"] is None
            if result["retired"]:
                break
            clock[0] = datetime.fromisoformat(result["next_due"])
        assert result["retired"] and result["next_due"] is None
        resumed = response_json(client.get(f"/api/review/sessions/{cold['session_id']}"))
        assert resumed["feedback"]["retired"]
        assert resumed["feedback"]["non_scheduling_reason"] is None


def test_fresh_authority_checked_despite_loaded_stale_identity_map(settings):
    app = app_for(settings)
    with TestClient(app) as client:
        study = enroll_catalogue(client, "e2e4")
        cold = start(client, exercise_at(app))
        with app.state.sessions() as old:
            session = old.get(ReviewSession, cold["session_id"])
            snapshot = recall.get_snapshot(old, session)
            assert recall.current(old, session, snapshot)
            response_json(client.delete(f"/api/opening-studies/{study['id']}"))
            assert not recall.current(old, session, snapshot)
            assert not recall.scheduling_allowed(old, session, snapshot)
            old.rollback()


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
        provider.courses = lambda db: ()
        restored = course_enroll(db, settings, provider, "a")
        assert restored["id"] == study["id"] and restored["line"].moves == ["e2e4", "e7e5"]
        assert db.scalar(select(OpeningStudy)).snapshot == study["line"].model_dump(mode="json")
        practiced = service.practice(db, study["id"], OpeningPracticeStart(request_id="practice"))
        practice_id = practiced["id"]
        course_id, revision = practiced["course_id"], practiced["course_revision"]
    with sessions() as db:
        course = course_for(db, CourseProviders(()), course_id, revision)
        assert course.lines[0].moves == ("e2e4", "e7e5")
        assert require_session(db, practice_id).course_revision == revision
