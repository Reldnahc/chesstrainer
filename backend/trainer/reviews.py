import chess
from sqlalchemy import select

from trainer.chess_core import Candidate, legal_move, valid_board
from trainer.imports import decision_board
from trainer.models import (
    Attempt,
    Decision,
    EngineAnalysis,
    Exercise,
    ExerciseAnswer,
    Game,
    Review,
    ReviewSession,
    SRSState,
    now,
)
from trainer.policy import MovePolicy
from trainer.scheduling import behavior_rating, utc


def queue(db, last_id=None, limit=30):
    active_ids = db.scalars(
        select(ReviewSession.exercise_id)
        .where(ReviewSession.completed.is_(False))
        .order_by(ReviewSession.started_at.desc())
    ).all()
    states = db.scalars(
        select(SRSState)
        .where(SRSState.due <= now())
        .order_by((SRSState.reviews == 0), SRSState.due, SRSState.exercise_id)
    ).all()
    # A failed first attempt already moved the due date. Reload must still resume
    # its unfinished session, rather than abandoning the learner's opportunity to retry.
    states = [db.get(SRSState, key) for key in dict.fromkeys(active_ids)] + [
        state for state in states if state.exercise_id not in active_ids
    ]
    if len(states) > 1 and states[0].exercise_id == last_id:
        states.append(states.pop(0))
    # The cold queue intentionally exposes no source, skill, answer, score or explanation.
    return [
        {"exercise_id": s.exercise_id, "due": utc(s.due).isoformat(), "new": s.reviews == 0}
        for s in states[:limit]
    ]


def start_review(db, exercise_id):
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise ValueError("Exercise not found")
    existing = db.scalar(
        select(ReviewSession).where(
            ReviewSession.exercise_id == exercise_id, ReviewSession.completed.is_(False)
        )
    )
    if existing is None:
        existing = ReviewSession(exercise_id=exercise_id)
        db.add(existing)
        db.commit()
    board = valid_board(exercise.fen)
    return {
        "session_id": existing.id,
        "exercise_id": exercise.id,
        "fen": exercise.fen,
        "orientation": exercise.orientation,
        "failed": existing.failed,
        # All legal moves, never just accepted answers: these are interaction aids.
        "legal_moves": [
            {
                "from_square": chess.square_name(move.from_square),
                "to_square": chess.square_name(move.to_square),
                "promotion": chess.piece_symbol(move.promotion) if move.promotion else None,
                "capture": board.is_capture(move),
            }
            for move in board.legal_moves
        ],
    }


def record_once(db, session, scheduler, settings, response_ms):
    existing = db.scalar(select(Review).where(Review.session_id == session.id))
    if existing:
        return existing
    state = db.get(SRSState, session.exercise_id)
    rating = behavior_rating(
        session.failed, session.revealed, response_ms, settings.slow_answer_seconds
    )
    card, due, scheduler_log = scheduler.review(state.card, rating, now(), response_ms)
    state.card, state.due = card, due
    state.reviews += 1
    state.lapses += int(rating.name == "Again")
    review = Review(
        session_id=session.id,
        exercise_id=session.exercise_id,
        rating=rating.name,
        response_ms=response_ms,
        failed=session.failed,
        revealed=session.revealed,
        scheduler_version=scheduler.version,
        scheduler_log=scheduler_log,
    )
    db.add(review)
    db.flush()
    return review


def feedback(db, exercise):
    answers = db.scalars(
        select(ExerciseAnswer).where(
            ExerciseAnswer.exercise_id == exercise.id,
            ExerciseAnswer.grade.in_(["correct", "acceptable"]),
        )
    ).all()
    result = {
        "explanation": exercise.explanation,
        "answers": [{"uci": a.uci, "san": a.san, "primary": a.primary} for a in answers],
    }
    if exercise.decision_id:
        decision = db.get(Decision, exercise.decision_id)
        analysis = db.get(EngineAnalysis, decision.before_analysis_id)
        game = db.get(Game, decision.game_id)
        result.update(
            {
                "decision_id": decision.id,
                "source": f"{game.white} — {game.black}",
                "played_san": decision.move_san,
                "candidates": analysis.candidates,
                "facts": decision.facts,
            }
        )
    return result


def submit_move(db, session_id, uci, engine, scheduler, settings):
    session = db.get(ReviewSession, session_id)
    if session is None:
        raise ValueError("Review session not found")
    exercise = db.get(Exercise, session.exercise_id)
    if session.completed:
        return {"completed": True, "grade": "already_recorded", **feedback(db, exercise)}
    board = valid_board(exercise.fen)
    move = legal_move(board, uci)  # Illegal attempts never count as failed recall.
    elapsed = max(0, int((now() - utc(session.started_at)).total_seconds() * 1000))
    answer = db.get(ExerciseAnswer, (exercise.id, uci))
    if answer is None and exercise.source == "game":
        decision = db.get(Decision, exercise.decision_id)
        source_board = decision_board(db.get(Game, decision.game_id), decision.ply)
        original = db.get(EngineAnalysis, decision.before_analysis_id)
        played = engine.analyze(
            source_board, deep=True, root_moves=[uci], multipv=1, reference=original
        )
        best = Candidate.model_validate(original.candidates[0])
        actual = Candidate.model_validate(played.candidates[0])
        grade = MovePolicy.model_validate(exercise.policy).grade(best, uci, actual.score)
        answer = ExerciseAnswer(
            exercise_id=exercise.id,
            uci=uci,
            san=board.san(move),
            grade=grade,
            primary=False,
            analysis_id=played.id,
        )
        db.add(answer)
    grade = answer.grade if answer else "failure"
    db.add(Attempt(session_id=session.id, uci=uci, grade=grade, elapsed_ms=elapsed))
    if grade in {"failure", "inaccuracy"}:
        session.failed = True
        record_once(db, session, scheduler, settings, elapsed)
        db.commit()
        return {
            "completed": False,
            "grade": grade,
            "fen": exercise.fen,
            "message": "Try again. Your first attempt has been recorded; take your time.",
        }
    session.completed = True
    record_once(db, session, scheduler, settings, elapsed)
    board.push(move)
    db.commit()
    return {
        "completed": True,
        "grade": grade,
        "fen": board.fen(),
        "message": "Solved. This recall stays marked for relearning."
        if session.failed
        else "Good move.",
        **feedback(db, exercise),
    }


def reveal(db, session_id, scheduler, settings):
    session = db.get(ReviewSession, session_id)
    if session is None:
        raise ValueError("Review session not found")
    exercise = db.get(Exercise, session.exercise_id)
    if not session.completed:
        session.revealed = True
        session.failed = True
        elapsed = max(0, int((now() - utc(session.started_at)).total_seconds() * 1000))
        review = record_once(db, session, scheduler, settings, elapsed)
        review.revealed = True
        session.completed = True
        db.commit()
    return {"completed": True, "grade": "revealed", **feedback(db, exercise)}
