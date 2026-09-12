"""Synthetic engine records ONLY for state-machine tests; moves and PGNs remain legal."""

import chess
import chess.pgn
from sqlalchemy import select
from trainer.chess_core import Candidate, Score, position_key
from trainer.curriculum import build_course
from trainer.exercises import exercise_from_decision
from trainer.models import (
    ClassificationRun,
    Decision,
    EngineAnalysis,
    ExerciseAnswer,
    Game,
    SkillEvidence,
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
    return build_course(db, settings)


def solve_step(client, app, data):
    if data["stage"] == "teach":
        return client.post(f"/api/lesson-items/{data['item_id']}/acknowledge").json()
    position = data["position"]
    with app.state.sessions() as db:
        answer = db.scalar(
            select(ExerciseAnswer).where(
                ExerciseAnswer.exercise_id == position["exercise_id"],
                ExerciseAnswer.primary.is_(True),
            )
        )
        uci = answer.uci
    response = client.post(
        f"/api/review/sessions/{position['session_id']}/move",
        json={"from_square": uci[:2], "to_square": uci[2:4], "promotion": uci[4:] or None},
    )
    assert response.status_code == 200, response.text
    return response.json()
