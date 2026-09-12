import io

import chess
import chess.pgn
import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from trainer.analysis import analyze_decision
from trainer.classification import Classification, classify_decision
from trainer.curriculum import build_course
from trainer.engine import Stockfish
from trainer.exercises import exercise_from_decision, import_repertoire, manual_exercise
from trainer.imports import identify_learner, import_games, learner_decisions
from trainer.local_classifier import LocalClassifier
from trainer.models import (
    CourseUnit,
    ExerciseAnswer,
    Game,
    Review,
    SkillEvidence,
    SRSState,
)
from trainer.reviews import reveal, start_review, submit_move
from trainer.scheduling import FSRSScheduler, behavior_rating
from trainer.taxonomy import seed_skills

PGN = """[Event "Fixture"]
[White "Learner"]
[Black "Opponent"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
"""


class MockClassifier:
    model = "test-only-verified-classifier"

    def classify(self, evidence):
        assert evidence["evidence_ids"]
        assert evidence["played_candidate"]["pv"]
        assert "available_skill_ids" in evidence
        return Classification(
            decision_id=evidence["decision_id"],
            primary_skill="king_safety",
            secondary_skills=[],
            confidence=0.9,
            explanation="The verified continuation allows a mating attack.",
        ), {}


def test_multi_import_dedupe_and_learner(sessions):
    with sessions() as db:
        result = import_games(db, "test.pgn", PGN + "\n" + PGN, ["learner"], None)
        assert result["imported"] == 1 and result["duplicates"] == 1
        assert db.scalar(select(func.count()).select_from(Game)) == 1
        ambiguous = import_games(db, "test.pgn", PGN, [], None)
        assert ambiguous["errors"] and ambiguous["job_id"] is None
        assert len(list(learner_decisions(db.scalar(select(Game))))) == 2
    parsed = chess.pgn.read_game(io.StringIO(PGN))
    with pytest.raises(ValueError):
        identify_learner(parsed, ["Learner", "Opponent"], None)


@pytest.mark.stockfish
def test_real_engine_vertical_slice_and_persistence(settings, sessions, stockfish_path):
    settings.stockfish_path = stockfish_path
    scheduler = FSRSScheduler(settings)
    engine = Stockfish(settings, sessions)
    try:
        with sessions() as db:
            seed_skills(db)
            import_games(db, "fools-mate.pgn", PGN, ["Learner"], None)
            game = db.scalar(select(Game))
            meaningful = []
            for ply, board, move in learner_decisions(game):
                decision = analyze_decision(db, engine, settings, game, ply, board, move)
                if decision.meaningful:
                    meaningful.append(decision)
                    assert classify_decision(db, decision, LocalClassifier(settings), settings)
                    exercise = exercise_from_decision(db, decision, settings, scheduler)
            assert meaningful
            assert any(d.allows_mate for d in meaningful)
            course = build_course(db, settings)
            assert course and db.scalar(select(CourseUnit)).provisional
            cold = start_review(db, exercise.id)
            assert not {"answers", "candidates", "source", "explanation"}.intersection(cold)
            answer = db.scalar(
                select(ExerciseAnswer).where(
                    ExerciseAnswer.exercise_id == exercise.id, ExerciseAnswer.primary.is_(True)
                )
            )
            graded = submit_move(db, cold["session_id"], answer.uci, engine, scheduler, settings)
            assert graded["completed"] and graded["grade"] == "correct"
            exercise_id = exercise.id
        with sessions() as fresh:
            assert fresh.get(SRSState, exercise_id).reviews == 1
            assert fresh.scalar(select(func.count()).select_from(Review)) == 1
            assert fresh.scalar(select(func.count()).select_from(SkillEvidence)) >= 1
    finally:
        engine.close()


def test_first_failure_and_reveal_schedule_once(settings, sessions):
    scheduler = FSRSScheduler(settings)
    with sessions() as db:
        exercise = manual_exercise(db, scheduler, chess.STARTING_FEN, ["e2e4"], "white")
        cold = start_review(db, exercise.id)
        with pytest.raises(ValueError):
            submit_move(db, cold["session_id"], "e2e5", None, scheduler, settings)
        assert db.get(SRSState, exercise.id).reviews == 0
        result = submit_move(db, cold["session_id"], "d2d4", None, scheduler, settings)
        assert not result["completed"] and "answers" not in result
        submit_move(db, cold["session_id"], "g1f3", None, scheduler, settings)
        assert start_review(db, exercise.id)["session_id"] == cold["session_id"]
        submit_move(db, cold["session_id"], "e2e4", None, scheduler, settings)
        assert db.get(SRSState, exercise.id).reviews == 1
        assert db.scalar(select(Review)).rating == "Again"
        assert db.scalar(select(Review)).failed
        reveal(db, cold["session_id"], scheduler, settings)
        assert db.scalar(select(func.count()).select_from(Review)) == 1


def test_repertoire_multiple_answers_and_trained_side(settings, sessions):
    scheduler = FSRSScheduler(settings)
    pgn = '[White "R"]\n[Black "R"]\n\n1. e4 (1. d4 d5) e5 2. Nf3 Nc6 *'
    with sessions() as db:
        result = import_repertoire(db, scheduler, "My lines", pgn, True)
        assert result["exercises"] == 2
        answers = db.scalars(select(ExerciseAnswer)).all()
        assert {a.uci for a in answers} == {"e2e4", "d2d4", "g1f3"}


def test_schema_and_srs_mapping():
    with pytest.raises(ValidationError):
        Classification(
            decision_id="1",
            primary_skill="made_up",
            secondary_skills=[],
            confidence=0.9,
            explanation="",
        )
    assert behavior_rating(True, False, 10, 30).name == "Again"
    assert behavior_rating(False, True, 10, 30).name == "Again"
    assert behavior_rating(False, False, 31_000, 30).name == "Hard"
    assert behavior_rating(False, False, 10_000, 30).name == "Good"
