"""Explain recorded moves using saved engine evidence and legal replay only."""

from sqlalchemy import select

from trainer.chess_core import Candidate, legal_move, position_key, valid_board
from trainer.classification_stages import EXPLANATION_RULES, line_findings
from trainer.continuations import replay, settled_delta
from trainer.errors import EvidenceIntegrityError, InvalidInput, NotFound
from trainer.explanation_types import (
    NO_SOLUTION,
    SOLVE_FIRST,
    MoveExplanation,
    attempt_for,
    color_name,
    replay_line,
)
from trainer.imports import decision_board
from trainer.models import (
    Decision,
    EngineAnalysis,
    Exercise,
    ExerciseAnswer,
    Game,
    ReviewSession,
)
from trainer.opening_studies import recall as opening_recall


def explain_review(db, session_id, attempt_id=None, solution=False):
    session = db.get(ReviewSession, session_id)
    if session is None:
        raise NotFound("Review session not found")
    snapshot = opening_recall.get_snapshot(db, session)
    if snapshot:
        return opening_recall.explain(db, session, snapshot, attempt_id, solution)
    exercise = db.get(Exercise, session.exercise_id)
    if solution:
        if not session.completed:
            raise InvalidInput(SOLVE_FIRST)
        answer = db.scalar(
            select(ExerciseAnswer).where(
                ExerciseAnswer.exercise_id == exercise.id, ExerciseAnswer.primary.is_(True)
            )
        )
        if answer is None:
            raise InvalidInput(NO_SOLUTION)
        selected_attempt = None
        uci, grade = answer.uci, answer.grade
    else:
        selected_attempt = attempt_for(db, session, attempt_id)
        uci, grade = selected_attempt.uci, selected_attempt.grade
        answer = db.get(ExerciseAnswer, (exercise.id, uci))
    board = valid_board(exercise.fen)
    if exercise.decision_id:
        decision = db.get(Decision, exercise.decision_id)
        board = decision_board(db.get(Game, decision.game_id), decision.ply)
    move = legal_move(board, uci)
    accepted = grade in {"correct", "acceptable"}
    san = board.san(move)
    if exercise.source != "game":
        source = "repertoire" if exercise.source == "repertoire" else "manual exercise"
        return MoveExplanation(
            attempt_id=selected_attempt.id if selected_attempt else None,
            authority="curated",
            accepted=accepted,
            move_uci=uci,
            move_san=san,
            summary=f"This is a saved {source} move."
            if accepted
            else f"This move is outside the saved {source} answers.",
            summary_kind="curated_accepted" if accepted else "curated_rejected",
            notes=[
                "The saved answers define this exercise. A different legal move is not necessarily bad chess."
            ]
            + ([exercise.explanation] if accepted and exercise.explanation else []),
            note_kinds=["curated_authority"]
            + ([None] if accepted and exercise.explanation else []),
            frames=replay_line(board, [uci]),
            orientation=exercise.orientation,
        )
    analysis = db.get(EngineAnalysis, answer.analysis_id) if answer and answer.analysis_id else None
    if analysis is None:
        raise InvalidInput("No saved engine continuation is available for this move")
    if position_key(valid_board(analysis.fen)) != position_key(board):
        raise EvidenceIntegrityError("The saved analysis does not match this position")
    candidate = next(
        (Candidate.model_validate(c) for c in analysis.candidates if c["uci"] == uci), None
    )
    if candidate is None:
        raise InvalidInput("The saved analysis does not contain this move")
    frames = replay_line(board, candidate.pv)
    learner = color_name(board.turn)
    balance_change = frames[-1].material_change
    notes = [
        "This is one Stockfish continuation against strong replies; it does not mean every reply is forced.",
        "Material changes refer only to the shown line, compared with the starting position. Pieces use values 1/3/3/5/9.",
    ]
    note_kinds = ["strong_replies", "material_scope"]
    summary_frame_index = None
    if candidate.score.kind == "mate":
        winner = learner if candidate.score.outcome() == 1 else color_name(not board.turn)
        summary = f"Stockfish finds a forced mate for {winner} after {san}."
        summary_kind = "mate_for_mover" if candidate.score.outcome() == 1 else "mate_against_mover"
    elif accepted and balance_change > 0:
        summary = f"In this line, {learner} gains {balance_change} points of material."
        summary_kind = "material_gain"
    elif not accepted and balance_change < 0:
        summary = f"In this line, {learner} loses {abs(balance_change)} points of material."
        summary_kind = "material_loss"
    elif not accepted and len(frames) > 2 and (frames[2].capture or frames[2].gives_check):
        summary = frames[2].annotation
        summary_kind, summary_frame_index = "frame", 2
    elif accepted and (
        board.is_capture(move)
        or board.gives_check(move)
        or board.is_check()
        or board.is_castling(move)
        or move.promotion
    ):
        summary = frames[1].annotation
        summary_kind, summary_frame_index = "frame", 1
    else:
        summary = (
            "This move meets your exercise's engine acceptance policy."
            if accepted
            else "This move falls outside your exercise's engine acceptance policy."
        )
        notes.append(
            "The saved line does not establish a simple tactical reason. Step through it to compare the replies; no positional explanation has been inferred."
        )
        summary_kind = "engine_accepted" if accepted else "engine_rejected"
        note_kinds.append("no_simple_reason")
    notes.append(f"Your saved answer policy is {exercise.policy.get('mode', 'practical')}.")
    note_kinds.append("saved_policy")
    # These witnesses come from THIS answer's exact line. A classification from
    # the source game would be wrong for a different move made during review.
    boards = replay(board, candidate)
    first = 1 if accepted else 2
    delta, end = settled_delta(boards, board.turn, max_plies=EXPLANATION_RULES.settle_plies)
    gain = delta if accepted else -delta if delta is not None else None
    mate_supported = candidate.score.kind == "mate" and candidate.score.outcome() == (
        1 if accepted else -1
    )
    findings = []
    if len(boards) > first:
        # A check/fork/pin can be visible even when this finite PV has no settled
        # material endpoint; the rules add it as a factual playback annotation,
        # never an additional grading event or automatically a weakness label.
        findings = line_findings(
            boards,
            first,
            analysis.id,
            EXPLANATION_RULES,
            end=end,
            material_supported=gain is not None and gain >= 1,
            mate_supported=mate_supported,
        )
    return MoveExplanation(
        attempt_id=selected_attempt.id if selected_attempt else None,
        authority="stockfish",
        accepted=accepted,
        move_uci=uci,
        move_san=san,
        summary=summary,
        summary_kind=summary_kind,
        summary_frame_index=summary_frame_index,
        notes=notes,
        note_kinds=note_kinds,
        frames=frames,
        orientation=exercise.orientation,
        analysis_id=analysis.id,
        engine_version=analysis.engine_version,
        score=candidate.score,
        findings=findings,
    )
