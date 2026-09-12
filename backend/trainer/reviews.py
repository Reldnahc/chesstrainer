import logging

import chess
from sqlalchemy import func, select

from trainer.chess_core import Candidate, legal_move, valid_board
from trainer.explanations import explain_review, replay_line
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
from trainer.practice import require_focus
from trainer.retirement import require_active_review, retire_if_ready
from trainer.scheduling import behavior_rating, utc

log = logging.getLogger(__name__)


def explanation_brief(db, session_id, attempt_id=None, solution=False, include_reply=False):
    try:
        explanation = explain_review(db, session_id, attempt_id, solution)
        result = {"explanation_summary": explanation.summary, "submitted_san": explanation.move_san}
        if include_reply and explanation.authority == "stockfish" and len(explanation.frames) >= 3:
            result["attempt_frame"] = explanation.frames[1].model_dump()
            result["counter_reply"] = explanation.frames[2].model_dump()
        return result
    except ValueError:
        # Explanation problems must never turn a saved recall into a failed HTTP move.
        log.warning("review_explanation_unavailable")
        return {}


def queue(db, last_id=None, limit=30):
    if last_id is None:
        last_id = db.scalar(
            select(Review.exercise_id)
            .join(ReviewSession, ReviewSession.id == Review.session_id)
            .where(ReviewSession.completed.is_(True))
            .order_by(Review.created_at.desc(), Review.id)
            .limit(1)
        )
    active_ids = db.scalars(
        select(ReviewSession.exercise_id)
        .join(SRSState, SRSState.exercise_id == ReviewSession.exercise_id)
        .join(Exercise, Exercise.id == ReviewSession.exercise_id)
        .where(
            Exercise.source != "repertoire",
            SRSState.retired_at.is_(None),
            ReviewSession.completed.is_(False),
            ReviewSession.lesson_item_id.is_(None),
            ReviewSession.mode == "review",
        )
        .order_by(ReviewSession.started_at.desc())
    ).all()
    states = db.scalars(
        select(SRSState)
        .join(Exercise, Exercise.id == SRSState.exercise_id)
        .where(
            Exercise.source != "repertoire",
            SRSState.due <= now(),
            SRSState.eligible.is_(True),
            SRSState.retired_at.is_(None),
        )
        .order_by((SRSState.reviews == 0), SRSState.due, SRSState.exercise_id)
    ).all()
    # A failed first attempt already moved the due date. Reload must still resume
    # its unfinished session, rather than abandoning the learner's opportunity to retry.
    states = [db.get(SRSState, key) for key in dict.fromkeys(active_ids)] + [
        state for state in states if state.exercise_id not in active_ids
    ]
    if len(states) > 1 and states[0].exercise_id == last_id and last_id not in active_ids:
        states.append(states.pop(0))
    # The cold queue intentionally exposes no source, skill, answer, score or explanation.
    return [
        {"exercise_id": s.exercise_id, "due": utc(s.due).isoformat(), "new": s.reviews == 0}
        for s in states[:limit]
    ]


def start_review(db, exercise_id, lesson_item_id=None, *, focus_skill_id=None):
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise ValueError("Exercise not found")
    require_active_review(db, exercise_id, lesson_item_id)
    if focus_skill_id is not None:
        require_focus(db, exercise, focus_skill_id)
    mode = "focus" if focus_skill_id is not None else "review"
    existing = db.scalar(
        select(ReviewSession).where(
            ReviewSession.exercise_id == exercise_id,
            ReviewSession.completed.is_(False),
            ReviewSession.lesson_item_id == lesson_item_id,
            ReviewSession.mode == mode,
            ReviewSession.focus_skill_id == focus_skill_id,
        )
    )
    resuming = existing is not None
    if existing is None:
        existing = ReviewSession(
            exercise_id=exercise_id,
            lesson_item_id=lesson_item_id,
            mode=mode,
            focus_skill_id=focus_skill_id,
        )
        db.add(existing)
        db.commit()
    board = valid_board(exercise.fen)
    state = db.get(SRSState, exercise_id)
    reason = (
        "resume"
        if resuming
        else "new"
        if state.reviews == 0
        else "practice"
        if utc(state.due) > now()
        else {1: "learning", 2: "review", 3: "relearning"}[state.card["state"]]
    )
    return {
        "session_id": existing.id,
        "last_attempt_id": existing.last_attempt_id,
        "exercise_id": exercise.id,
        "fen": exercise.fen,
        "orientation": exercise.orientation,
        "failed": existing.failed,
        "review_reason": reason,
        "previous_reviews": state.reviews,
        "practice_only": mode == "focus",
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
    if session.lesson_item_id is not None or session.mode == "focus":
        return None  # Lesson practice has its own progression, not an FSRS recall.
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
    retire_if_ready(state, settings)
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


def feedback(db, exercise, session=None):
    answers = db.scalars(
        select(ExerciseAnswer).where(
            ExerciseAnswer.exercise_id == exercise.id,
            ExerciseAnswer.grade.in_(["correct", "acceptable"]),
        )
    ).all()
    state = db.get(SRSState, exercise.id)
    result = {
        "retired": state.retired_at is not None,
        "retired_interval_days": state.retired_interval_days,
        "explanation": exercise.explanation,
        "answers": [{"uci": a.uci, "san": a.san, "primary": a.primary} for a in answers],
        "next_due": None if state.retired_at else utc(state.due).isoformat(),
    }
    if session and session.mode == "focus":
        result.update(practice_only=True, next_due=None)
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
        return {"completed": True, "grade": "already_recorded", **feedback(db, exercise, session)}
    require_active_review(db, exercise.id, session.lesson_item_id)
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
    attempt = Attempt(session_id=session.id, uci=uci, grade=grade, elapsed_ms=elapsed)
    db.add(attempt)
    db.flush()
    session.last_attempt_id = attempt.id
    if session.response_ms is None:
        # A session opened before the migration may already have raw attempts.
        session.response_ms = db.scalar(
            select(func.min(Attempt.elapsed_ms)).where(Attempt.session_id == session.id)
        )
    if grade in {"failure", "inaccuracy"}:
        session.failed = True
        record_once(db, session, scheduler, settings, elapsed)
        db.commit()
        return {
            "completed": False,
            "attempt_id": attempt.id,
            **explanation_brief(db, session.id, attempt.id, include_reply=True),
            "grade": grade,
            "fen": exercise.fen,
            "practice_only": session.mode == "focus",
            "message": "Try again. This practice attempt is saved."
            if session.mode == "focus"
            else "Try again. Your first attempt has been recorded; take your time.",
        }
    session.completed = True
    session.completed_at = now()
    record_once(db, session, scheduler, settings, elapsed)
    board.push(move)
    lesson_result = finish_lesson_attempt(db, session, settings)
    db.commit()
    return {
        "completed": True,
        "attempt_id": attempt.id,
        **explanation_brief(db, session.id, attempt.id),
        "grade": grade,
        "fen": board.fen(),
        "message": "Practice saved. Your review schedule is unchanged."
        if session.mode == "focus"
        else "Solved. This recall stays marked for relearning."
        if session.failed
        else "Good move.",
        **feedback(db, exercise, session),
        "lesson_result": lesson_result,
    }


def finish_lesson_attempt(db, session, settings):
    if session.lesson_item_id:
        from trainer.lessons import finish_item

        return finish_item(db, session, settings)
    return None


def reveal(db, session_id, scheduler, settings):
    session = db.get(ReviewSession, session_id)
    if session is None:
        raise ValueError("Review session not found")
    exercise = db.get(Exercise, session.exercise_id)
    answer = db.scalar(
        select(ExerciseAnswer).where(
            ExerciseAnswer.exercise_id == exercise.id, ExerciseAnswer.primary.is_(True)
        )
    )
    if answer is None:
        raise ValueError("No saved solution is available")
    # Apply the curated/verified answer even when deeper engine evidence is unavailable.
    # Validate before recording recall so an invalid saved move cannot consume a review.
    frame = replay_line(valid_board(exercise.fen), [answer.uci])[1]
    lesson_result = None
    if not session.completed:
        require_active_review(db, exercise.id, session.lesson_item_id)
        session.revealed = True
        session.failed = True
        elapsed = max(0, int((now() - utc(session.started_at)).total_seconds() * 1000))
        if session.response_ms is None:
            first_response = db.scalar(
                select(func.min(Attempt.elapsed_ms)).where(Attempt.session_id == session.id)
            )
            session.response_ms = first_response if first_response is not None else elapsed
        review = record_once(db, session, scheduler, settings, elapsed)
        if review is not None:
            review.revealed = True
        session.completed = True
        session.completed_at = now()
        lesson_result = finish_lesson_attempt(db, session, settings)
        db.commit()
    return {
        "completed": True,
        "grade": "revealed",
        **explanation_brief(db, session.id, solution=True),
        **feedback(db, exercise, session),
        "fen": frame.fen,
        "reveal_frame": frame.model_dump(),
        "submitted_san": frame.san,
        "lesson_result": lesson_result,
    }
