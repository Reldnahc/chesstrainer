"""Project active line contributions into one existing Exercise per legal position."""

from sqlalchemy import delete, select

from trainer.chess_core import digest, legal_move, position_key, valid_board
from trainer.exercises import enroll
from trainer.models import (
    Exercise,
    ExerciseAnswer,
    OpeningCard,
    OpeningContentChange,
    OpeningStudy,
    OpeningStudyMove,
    SRSState,
    now,
)
from trainer.scheduling import utc


def contribute(db, study, scheduler):
    board = valid_board(study.snapshot["initial_fen"])
    affected = set()
    ordinal = 0
    for ply, uci in enumerate(study.snapshot["moves"]):
        move = legal_move(board, uci)
        if board.turn == (study.color == "white"):
            key = position_key(board)
            identity = digest({"source": "opening", "position": key, "orientation": study.color})
            exercise = db.scalar(select(Exercise).where(Exercise.identity == identity))
            if exercise is None:
                exercise = Exercise(
                    identity=identity,
                    source="opening",
                    fen=board.fen(),
                    orientation=study.color,
                    explanation="Recall a move from your selected opening studies.",
                    policy={"authority": "opening_study", "version": "1"},
                )
                db.add(exercise)
                db.flush()
                enroll(db, exercise, scheduler)
                db.add(OpeningCard(exercise_id=exercise.id))
            db.add(
                OpeningStudyMove(
                    study_id=study.id,
                    ordinal=ordinal,
                    exercise_id=exercise.id,
                    position_key=key,
                    fen=board.fen(),
                    ply=ply,
                    move_uci=move.uci(),
                    move_san=board.san(move),
                )
            )
            ordinal += 1
            affected.add(exercise.id)
        board.push(move)
    if not affected:
        raise ValueError("This line contains no moves for the selected color")
    db.flush()
    return affected


def rebuild(db, exercise_id, *, invalidate=False, reason="study_added"):
    card = db.get(OpeningCard, exercise_id)
    state = db.get(SRSState, exercise_id)
    board = valid_board(db.get(Exercise, exercise_id).fen)
    saved = set(
        db.scalars(select(ExerciseAnswer.uci).where(ExerciseAnswer.exercise_id == exercise_id))
    )
    # Older projections may retain castling aliases. Compare legal move identities
    # so repairing their spelling does not reset retirement or invalidate recall.
    old = {legal_move(board, uci).uci() for uci in saved}
    new = {
        legal_move(board, uci).uci()
        for uci in db.scalars(
            select(OpeningStudyMove.move_uci)
            .join(
                OpeningStudy,
                OpeningStudy.id == OpeningStudyMove.study_id,
            )
            .where(OpeningStudyMove.exercise_id == exercise_id, OpeningStudy.active.is_(True))
        )
    }
    active = bool(new)
    previous_target = {legal_move(board, uci).uci() for uci in card.last_active_answers}
    target_changed = active and bool(previous_target) and new != previous_target
    authority_changed = old != new or card.active != active or invalidate
    if saved != new or authority_changed:
        db.execute(delete(ExerciseAnswer).where(ExerciseAnswer.exercise_id == exercise_id))
        for index, uci in enumerate(sorted(new)):
            db.add(
                ExerciseAnswer(
                    exercise_id=exercise_id,
                    uci=uci,
                    san=board.san(legal_move(board, uci)),
                    grade="correct",
                    primary=index == 0,
                )
            )
    if active:
        card.last_active_answers = sorted(new)
    if not authority_changed:
        return
    before = {
        "answers": sorted(saved),
        "active": card.active,
        "due": utc(state.due).isoformat(),
        "retired_at": state.retired_at.isoformat() if state.retired_at else None,
        "retired_interval_days": state.retired_interval_days,
    }
    card.revision += 1
    card.active = state.eligible = active
    if active:
        if target_changed and state.retired_at is not None:
            state.retired_at = None
            state.retired_interval_days = None
            state.due = now()
            card.retirement_guard_revision = card.revision
        elif previous_target - new and utc(state.due) > now():
            state.due = now()
    db.add(
        OpeningContentChange(
            exercise_id=exercise_id,
            revision=card.revision,
            reason=reason,
            details={
                "before": before,
                "answers": sorted(new),
                "active": active,
                "due": utc(state.due).isoformat(),
                "target_changed": target_changed,
                "retirement_guard_revision": card.retirement_guard_revision,
            },
        )
    )


def set_active(db, study, active):
    if study.active == active:
        return
    study.active = active
    affected = set(
        db.scalars(
            select(OpeningStudyMove.exercise_id).where(OpeningStudyMove.study_id == study.id)
        )
    )
    for exercise_id in affected:
        rebuild(
            db,
            exercise_id,
            invalidate=not active,
            reason="study_restored" if active else "study_disabled",
        )
