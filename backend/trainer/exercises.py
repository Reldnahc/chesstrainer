from sqlalchemy import select

from trainer.chess_core import Candidate, digest, legal_move, position_key, valid_board
from trainer.errors import InvalidInput
from trainer.models import (
    EngineAnalysis,
    Exercise,
    ExerciseAnswer,
    ExerciseTag,
    SRSState,
)
from trainer.policy import MovePolicy


def enroll(db, exercise, scheduler):
    if db.get(SRSState, exercise.id) is None:
        card, due = scheduler.initial()
        db.add(SRSState(exercise_id=exercise.id, card=card, due=due))


def exercise_from_decision(db, decision, settings, scheduler):
    policy = MovePolicy.from_settings(settings)
    identity = digest(
        {
            "source": "game",
            "position": decision.position_key,
            "policy": policy.model_dump(),
            "analysis": decision.before_analysis_id,
        }
    )
    # A decision whose searches were replaced later (a deeper search adopted after
    # training was built) keeps the exercise it already has: rewriting its answers
    # would drop answers graded during practice, and an exercise can be shared by
    # the same mistake in other games. Only a decision without one gets a new one.
    owned = next(
        (
            row
            for row in db.scalars(
                select(Exercise).where(
                    Exercise.decision_id == decision.id, Exercise.source == "game"
                )
            )
            if row.policy == policy.model_dump()
        ),
        None,
    )
    if owned is not None:
        return owned
    exercise = db.scalar(select(Exercise).where(Exercise.identity == identity))
    if exercise:
        # Shared by this mistake in another game: a card set aside because that
        # game's decision stopped being a mistake comes back for this one.
        state = db.get(SRSState, exercise.id)
        if state is not None and not state.eligible:
            state.eligible = True
        return exercise
    analysis = db.get(EngineAnalysis, decision.before_analysis_id)
    candidates = [Candidate.model_validate(c) for c in analysis.candidates]
    exercise = Exercise(
        identity=identity,
        source="game",
        decision_id=decision.id,
        fen=decision.fen,
        orientation="white" if decision.learner_color else "black",
        explanation="Compare your choice with the verified continuation after answering.",
        policy=policy.model_dump(),
    )
    db.add(exercise)
    db.flush()
    for index, candidate in enumerate(candidates):
        db.add(
            ExerciseAnswer(
                exercise_id=exercise.id,
                uci=candidate.uci,
                san=candidate.san,
                primary=index == 0,
                grade=policy.grade(candidates[0], candidate.uci, candidate.score),
                analysis_id=analysis.id,
            )
        )
    enroll(db, exercise, scheduler)
    db.flush()
    return exercise


def manual_exercise(db, scheduler, fen, moves, orientation, explanation="", tags=None):
    board = valid_board(fen)
    parsed = [legal_move(board, uci) for uci in dict.fromkeys(moves)]
    if not parsed:
        raise InvalidInput("At least one expected legal move is required")
    identity = digest(
        {
            "source": "manual",
            "position": position_key(board),
            "moves": sorted(m.uci() for m in parsed),
            "orientation": orientation,
        }
    )
    existing = db.scalar(select(Exercise).where(Exercise.identity == identity))
    if existing:
        return existing
    exercise = Exercise(
        identity=identity,
        source="manual",
        fen=board.fen(),
        orientation=orientation,
        explanation=explanation,
        policy={"authority": "curated", "version": "1"},
    )
    db.add(exercise)
    db.flush()
    for index, move in enumerate(parsed):
        db.add(
            ExerciseAnswer(
                exercise_id=exercise.id,
                uci=move.uci(),
                san=board.san(move),
                grade="correct",
                primary=index == 0,
            )
        )
    for tag in set(tags or []):
        db.add(ExerciseTag(exercise_id=exercise.id, tag=tag))
    enroll(db, exercise, scheduler)
    db.flush()
    return exercise
