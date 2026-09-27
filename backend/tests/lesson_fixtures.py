"""Synthetic engine records ONLY for state-machine tests; moves and PGNs remain legal."""

import chess
import chess.pgn
from sqlalchemy import select
from trainer.chess_core import Candidate, Score, position_key
from trainer.exercises import exercise_from_decision
from trainer.models import (
    ClassificationRun,
    Course,
    CourseRevision,
    CourseUnit,
    Decision,
    EngineAnalysis,
    ExerciseAnswer,
    Game,
    Lesson,
    LessonItem,
    SkillEvidence,
    SRSState,
    UnitEvidence,
)
from trainer.scheduling import FSRSScheduler
from trainer.taxonomy import seed_skills


def seed_lesson(db, settings, count=8, offset=0, skills=None):
    seed_skills(db)
    for i in range(offset, offset + count):
        board = chess.Board(None)
        for square, piece in {
            chess.E1: chess.Piece(chess.KING, True),
            chess.E8: chess.Piece(chess.KING, False),
            chess.A1: chess.Piece(chess.ROOK, True),
            chess.B2 + i % 7: chess.Piece(chess.PAWN, True),
            chess.A6 + (i // 7) % 8: chess.Piece(chess.PAWN, False),
        }.items():
            board.set_piece_at(square, piece)
        # The a-file pawn makes the verified curated fixture answer a capture.
        best = "a1a6" if i // 7 == 0 else "a1a8"
        assert chess.Move.from_uci(best) in board.legal_moves
        game = chess.pgn.Game.from_board(board)
        game.add_variation(chess.Move.from_uci("e1d1"))
        saved = Game(
            fingerprint=f"lesson-{i}",
            white="Fixture",
            black="Opponent",
            learner_color=True,
            pgn=str(game),
        )
        db.add(saved)
        db.flush()
        candidate = Candidate(
            uci=best,
            san=board.san(chess.Move.from_uci(best)),
            score=Score(kind="cp", value=500),
            pv=[best],
        )
        before = EngineAnalysis(
            cache_key=f"lesson-before-{i}",
            fen=board.fen(),
            engine_version="fixture",
            config={},
            candidates=[candidate.model_dump()],
        )
        played = EngineAnalysis(
            cache_key=f"lesson-played-{i}",
            fen=board.fen(),
            engine_version="fixture",
            config={},
            candidates=[
                Candidate(
                    uci="e1d1", san="Kd1", score=Score(kind="cp", value=0), pv=["e1d1"]
                ).model_dump()
            ],
        )
        db.add_all([before, played])
        db.flush()
        decision = Decision(
            game_id=saved.id,
            ply=1,
            fen=board.fen(),
            position_key=position_key(board),
            learner_color=True,
            move_uci="e1d1",
            move_san="Kd1",
            before_analysis_id=before.id,
            played_analysis_id=played.id,
            loss_cp=500,
            meaningful=True,
            deep=True,
            facts={},
        )
        db.add(decision)
        db.flush()
        run = ClassificationRun(
            cache_key=f"lesson-classification-{i}",
            decision_id=decision.id,
            model="fixture",
            schema_version="1",
            prompt_version="1",
            status="completed",
            confidence=0.9,
            response={
                "decision_id": decision.id,
                "primary_skill": "king_safety",
                "secondary_skills": [],
                "confidence": 0.9,
                "explanation": "Compare the supplied continuations.",
            },
        )
        db.add(run)
        db.flush()
        skill = skills[i % len(skills)] if skills else "king_safety"
        db.add(
            SkillEvidence(
                decision_id=decision.id,
                skill_id=skill,
                classification_run_id=run.id,
                confidence=0.9,
                explanation="Compare the supplied continuations.",
            )
        )
        exercise = exercise_from_decision(db, decision, settings, FSRSScheduler(settings))
        db.add(
            ExerciseAnswer(
                exercise_id=exercise.id,
                uci="e1d1",
                san="Kd1",
                grade="failure",
                primary=False,
                analysis_id=played.id,
            )
        )
        db.commit()
    # Historical rows are explicit fixtures, not a retained course-generation engine.
    course = Course(title="Archived fixture course", target_rating=settings.target_rating)
    db.add(course)
    db.flush()
    unit = CourseUnit(
        course_id=course.id,
        skill_id="king_safety",
        title="Archived unit",
        rationale="Historical fixture",
        ordinal=0,
        provisional=True,
        group_key="Tactical awareness",
    )
    db.add(unit)
    db.flush()
    exercises = db.scalars(select(SRSState)).all()
    for ordinal, stage in enumerate(("diagnose", "teach", "drill", "check", "retain")):
        lesson = Lesson(unit_id=unit.id, stage=stage, ordinal=ordinal)
        db.add(lesson)
        db.flush()
        if stage != "retain":
            for index, state in enumerate(exercises):
                state.eligible = False
                db.add(
                    LessonItem(lesson_id=lesson.id, exercise_id=state.exercise_id, ordinal=index)
                )
    for evidence in db.scalars(select(SkillEvidence)):
        db.add(UnitEvidence(unit_id=unit.id, evidence_id=evidence.id))
    db.add(
        CourseRevision(
            course_id=course.id, fingerprint="archived-fixture", snapshot={"fixture": True}
        )
    )
    db.commit()
    return course
