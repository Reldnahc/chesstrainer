from sqlalchemy import select

from trainer.chess_core import Candidate, digest, legal_move, position_key, valid_board
from trainer.imports import parse_games
from trainer.models import (
    EngineAnalysis,
    Exercise,
    ExerciseAnswer,
    ExerciseTag,
    Repertoire,
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
    exercise = db.scalar(select(Exercise).where(Exercise.identity == identity))
    if exercise:
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
    db.commit()
    return exercise


def manual_exercise(db, scheduler, fen, moves, orientation, explanation="", tags=None):
    board = valid_board(fen)
    parsed = [legal_move(board, uci) for uci in dict.fromkeys(moves)]
    if not parsed:
        raise ValueError("At least one expected legal move is required")
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
    db.commit()
    return exercise


def import_repertoire(db, scheduler, name, pgn, color):
    parsed = list(parse_games(pgn))
    errors = [{"game": i, "error": error} for i, _, error in parsed if error]
    games = [game for _, game, error in parsed if not error]
    if not games:
        raise ValueError("No valid repertoire lines found")
    repertoire = Repertoire(name=name, pgn=pgn, color=color)
    db.add(repertoire)
    db.flush()
    positions = {}

    def visit(node):
        board = node.board()
        if board.turn == color and node.variations:
            entry = positions.setdefault(position_key(board), {"board": board, "moves": set()})
            entry["moves"].update(child.move.uci() for child in node.variations)
        for child in node.variations:
            visit(child)

    for game in games:
        visit(game)
    for key, entry in positions.items():
        board = entry["board"]
        exercise = Exercise(
            identity=digest({"repertoire": repertoire.id, "position": key}),
            source="repertoire",
            repertoire_id=repertoire.id,
            fen=board.fen(),
            orientation="white" if color else "black",
            explanation=f"A continuation from your curated repertoire: {name}.",
            policy={"authority": "repertoire", "version": "1"},
        )
        db.add(exercise)
        db.flush()
        for index, uci in enumerate(sorted(entry["moves"])):
            move = legal_move(board, uci)
            db.add(
                ExerciseAnswer(
                    exercise_id=exercise.id,
                    uci=uci,
                    san=board.san(move),
                    grade="correct",
                    primary=index == 0,
                )
            )
        enroll(db, exercise, scheduler)
    db.commit()
    return {"id": repertoire.id, "exercises": len(positions), "errors": errors}
