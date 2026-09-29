"""Snapshot authored answers and guard only the scheduling side of stale recalls."""

from types import SimpleNamespace

from sqlalchemy import select, update

from trainer.chess_core import legal_move, valid_board
from trainer.models import (
    Attempt,
    ExerciseAnswer,
    OpeningCard,
    OpeningRecallSnapshot,
    OpeningStudy,
    OpeningStudyMove,
    Review,
    SRSState,
)
from trainer.study_lessons.content import Position

CHANGED = "This study changed after you started. Your attempt was saved without updating the current review schedule."
STALE_PROMPT = "This study changed after you started. You can finish this saved attempt, but it will not update the current review schedule."


def snapshot_session(db, session, exercise):
    card = db.get(OpeningCard, exercise.id)
    answers = db.scalars(
        select(ExerciseAnswer)
        .where(ExerciseAnswer.exercise_id == exercise.id)
        .order_by(ExerciseAnswer.uci)
    )
    studies = db.execute(
        select(OpeningStudy, OpeningStudyMove)
        .join(
            OpeningStudyMove,
            OpeningStudyMove.study_id == OpeningStudy.id,
        )
        .where(OpeningStudyMove.exercise_id == exercise.id, OpeningStudy.active.is_(True))
        .order_by(OpeningStudy.created_at, OpeningStudyMove.ordinal)
    )
    db.add(
        OpeningRecallSnapshot(
            session_id=session.id,
            answer_revision=card.revision,
            fen=exercise.fen,
            orientation=exercise.orientation,
            answers=[
                {
                    "uci": answer.uci,
                    "san": answer.san,
                    "primary": answer.primary,
                    "grade": answer.grade,
                }
                for answer in answers
            ],
            studies=[
                {
                    "study_id": study.id,
                    "name": study.name,
                    "eco": study.eco,
                    "line": study.snapshot,
                    "ply": contribution.ply,
                }
                for study, contribution in studies
            ],
        )
    )


def get_snapshot(db, session):
    return db.get(OpeningRecallSnapshot, session.id)


def context(snapshot):
    return {
        "names": list(dict.fromkeys(study["name"] for study in snapshot.studies)),
        "color": snapshot.orientation,
        "prompt": "Play your studied move.",
        "revision": snapshot.answer_revision,
    }


def current(db, session, snapshot):
    card = db.scalar(
        select(OpeningCard)
        .where(OpeningCard.exercise_id == session.exercise_id)
        .execution_options(populate_existing=True)
    )
    state = db.scalar(
        select(SRSState)
        .where(SRSState.exercise_id == session.exercise_id)
        .execution_options(populate_existing=True)
    )
    return bool(
        card
        and state
        and card.active
        and card.revision == snapshot.answer_revision
        and state.eligible
    )


def scheduling_allowed(db, session, snapshot):
    # The enclosing account mutation lock serializes HTTP enrollment and recall.
    # A conditional write additionally checks fresh authority under SQLite's writer lock.
    changed = db.execute(
        update(OpeningCard)
        .where(
            OpeningCard.exercise_id == session.exercise_id,
            OpeningCard.revision == snapshot.answer_revision,
            OpeningCard.active.is_(True),
        )
        .values(revision=OpeningCard.revision)
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1 or not current(db, session, snapshot):
        snapshot.non_scheduling_reason = CHANGED
        return False
    if db.get(SRSState, session.exercise_id).retired_at is not None:
        snapshot.non_scheduling_reason = (
            "This opening position is retired. The attempt was saved without changing its schedule."
        )
        return False
    return True


def answer_rows(snapshot):
    """Present canonical answers without rewriting immutable recall snapshots."""
    board = valid_board(snapshot.fen)
    answers = {}
    for row in snapshot.answers:
        uci = legal_move(board, row["uci"]).uci()
        previous = answers.get(uci)
        answers[uci] = row | {
            "uci": uci,
            "primary": row["primary"] or bool(previous and previous["primary"]),
        }
    return list(answers.values())


def answer(snapshot, uci=None, *, primary=False):
    rows = answer_rows(snapshot)
    if uci is not None and not primary:
        uci = legal_move(valid_board(snapshot.fen), uci).uci()
    row = (
        next((row for row in rows if row["primary"]), None)
        if primary
        else next((row for row in rows if row["uci"] == uci), None)
    )
    return SimpleNamespace(**row, analysis_id=None) if row else None


def feedback(db, exercise, session, snapshot):
    stale = not current(db, session, snapshot)
    existing = db.scalar(select(Review).where(Review.session_id == session.id))
    continuations = []
    for study in snapshot.studies:
        moves = study["line"]["moves"][study["ply"] :]
        frames = Position(initial_fen=snapshot.fen, moves=tuple(moves)).frames()
        continuations.append(
            {"study_id": study["study_id"], "name": study["name"], "moves": frames}
        )
    return {
        "opening": context(snapshot),
        "answers": [
            {key: row[key] for key in ("uci", "san", "primary")} for row in answer_rows(snapshot)
        ],
        "continuations": continuations,
        "explanation": "Accepted moves come from the studies selected when this attempt started.",
        "non_scheduling_reason": snapshot.non_scheduling_reason or (CHANGED if stale else None),
        "scheduling_status": "previously_recorded"
        if existing and stale
        else "recorded"
        if existing
        else "content_changed"
        if stale
        else "practice",
        **({"next_due": None} if stale else {}),
    }


def explain(db, session, snapshot, attempt_id, solution):
    from trainer.explanations import MoveExplanation, replay_line

    if solution:
        if not session.completed:
            raise ValueError("Solve the position or reveal before opening the solution")
        selected, accepted = answer(snapshot, primary=True), True
        if selected is None:
            raise ValueError("No saved opening solution")
        uci, selected_attempt = selected.uci, None
    else:
        selected_attempt = (
            db.get(Attempt, attempt_id or session.last_attempt_id)
            if (attempt_id or session.last_attempt_id)
            else None
        )
        if selected_attempt is None or selected_attempt.session_id != session.id:
            raise ValueError("Submit a move in this review before asking for its explanation")
        uci = selected_attempt.uci
        accepted = selected_attempt.grade in {"correct", "acceptable"}
    board = valid_board(snapshot.fen)
    move = legal_move(board, uci)
    return MoveExplanation(
        attempt_id=selected_attempt.id if selected_attempt else None,
        authority="curated",
        accepted=accepted,
        move_uci=uci,
        move_san=board.san(move),
        orientation=snapshot.orientation,
        summary="This matches a move in your selected opening studies."
        if accepted
        else "This move is legal, but outside the opening moves you selected to study.",
        notes=[
            "Opening recall tests your chosen repertoire, not whether an alternative is objectively good or bad."
        ],
        frames=replay_line(board, [uci]),
    )
