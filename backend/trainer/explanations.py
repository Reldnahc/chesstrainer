"""Explain recorded moves using saved engine evidence and legal replay only."""

import chess
from pydantic import BaseModel, Field
from sqlalchemy import select

from trainer.chess_core import Candidate, Score, legal_move, material, position_key, valid_board
from trainer.diagnosis_types import Finding
from trainer.imports import decision_board
from trainer.local_classifier import replay, settled_delta
from trainer.models import (
    Attempt,
    Decision,
    EngineAnalysis,
    Exercise,
    ExerciseAnswer,
    Game,
    ReviewSession,
)
from trainer.move_causes import move_causes
from trainer.tactical_patterns import detect_patterns


class Frame(BaseModel):
    fen: str
    uci: str | None
    san: str
    annotation: str
    highlights: list[str]
    material_change: int
    capture: str | None = None
    gives_check: bool = False


class MoveExplanation(BaseModel):
    version: str = "1"
    attempt_id: str | None
    authority: str
    accepted: bool
    move_uci: str
    move_san: str
    summary: str
    notes: list[str]
    frames: list[Frame]
    orientation: str
    analysis_id: str | None = None
    engine_version: str | None = None
    score: Score | None = None
    findings: list[Finding] = Field(default_factory=list)


def color_name(color):
    return "White" if color else "Black"


def replay_line(board, line):
    replay = board.copy(stack=True)
    learner = board.turn
    initial_balance = material(board, learner) - material(board, not learner)
    frames = [
        Frame(
            fen=board.fen(),
            uci=None,
            san="Start",
            annotation="The original position.",
            highlights=[],
            material_change=0,
        )
    ]
    for uci in line:
        move = legal_move(replay, uci)
        san = replay.san(move)
        actor = color_name(replay.turn)
        opponent = color_name(not replay.turn)
        capture_square = move.to_square
        if replay.is_en_passant(move):
            capture_square += -8 if replay.turn else 8
        captured = replay.piece_at(capture_square) if replay.is_capture(move) else None
        castling = replay.is_castling(move)
        annotation = f"{actor} plays {san}"
        if captured:
            annotation += f", capturing {opponent}'s {chess.piece_name(captured.piece_type)}"
        if move.promotion:
            annotation += f" and promoting to a {chess.piece_name(move.promotion)}"
        if castling:
            annotation += " and castles"
        was_check = replay.is_check()
        replay.push(move)
        if replay.is_checkmate():
            annotation += ". This is checkmate"
        elif replay.is_check():
            annotation += ", giving check"
        elif was_check:
            annotation += ", getting out of check"
        highlights = [chess.square_name(move.from_square), chess.square_name(move.to_square)]
        if captured and capture_square != move.to_square:
            highlights.append(chess.square_name(capture_square))
        frames.append(
            Frame(
                fen=replay.fen(),
                uci=uci,
                san=san,
                annotation=annotation + ".",
                highlights=highlights,
                capture=chess.piece_name(captured.piece_type) if captured else None,
                gives_check=replay.is_check(),
                material_change=material(replay, learner)
                - material(replay, not learner)
                - initial_balance,
            )
        )
    return frames


def explain_review(db, session_id, attempt_id=None, solution=False):
    session = db.get(ReviewSession, session_id)
    if session is None:
        raise ValueError("Review session not found")
    exercise = db.get(Exercise, session.exercise_id)
    if solution:
        if not session.completed:
            raise ValueError("Solve the position or use Reveal move before opening the solution")
        answer = db.scalar(
            select(ExerciseAnswer).where(
                ExerciseAnswer.exercise_id == exercise.id, ExerciseAnswer.primary.is_(True)
            )
        )
        if answer is None:
            raise ValueError("No saved solution is available")
        selected_attempt = None
        uci, grade = answer.uci, answer.grade
    else:
        selected_attempt = (
            db.get(Attempt, attempt_id or session.last_attempt_id)
            if (attempt_id or session.last_attempt_id)
            else None
        )
        if selected_attempt is None or selected_attempt.session_id != session.id:
            raise ValueError("Submit a move in this review before asking for its explanation")
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
            notes=[
                "The saved answers define this exercise. A different legal move is not necessarily bad chess."
            ]
            + ([exercise.explanation] if accepted and exercise.explanation else []),
            frames=replay_line(board, [uci]),
            orientation=exercise.orientation,
        )
    analysis = db.get(EngineAnalysis, answer.analysis_id) if answer and answer.analysis_id else None
    if analysis is None:
        raise ValueError("No saved engine continuation is available for this move")
    if position_key(valid_board(analysis.fen)) != position_key(board):
        raise ValueError("The saved analysis does not match this position")
    candidate = next(
        (Candidate.model_validate(c) for c in analysis.candidates if c["uci"] == uci), None
    )
    if candidate is None:
        raise ValueError("The saved analysis does not contain this move")
    frames = replay_line(board, candidate.pv)
    learner = color_name(board.turn)
    balance_change = frames[-1].material_change
    notes = [
        "This is one Stockfish continuation against strong replies; it does not mean every reply is forced.",
        "Material changes refer only to the shown line, compared with the starting position. Pieces use values 1/3/3/5/9.",
    ]
    if candidate.score.kind == "mate":
        winner = learner if candidate.score.outcome() == 1 else color_name(not board.turn)
        summary = f"Stockfish finds a forced mate for {winner} after {san}."
    elif accepted and balance_change > 0:
        summary = f"In this line, {learner} gains {balance_change} points of material."
    elif not accepted and balance_change < 0:
        summary = f"In this line, {learner} loses {abs(balance_change)} points of material."
    elif not accepted and len(frames) > 2 and (frames[2].capture or frames[2].gives_check):
        summary = frames[2].annotation
    elif accepted and (
        board.is_capture(move)
        or board.gives_check(move)
        or board.is_check()
        or board.is_castling(move)
        or move.promotion
    ):
        summary = frames[1].annotation
    else:
        summary = (
            "This move meets your exercise's engine acceptance policy."
            if accepted
            else "This move falls outside your exercise's engine acceptance policy."
        )
        notes.append(
            "The saved line does not establish a simple tactical reason. Step through it to compare the replies; no positional explanation has been inferred."
        )
    notes.append(f"Your saved answer policy is {exercise.policy.get('mode', 'practical')}.")
    # These witnesses come from THIS answer's exact line. A classification from
    # the source game would be wrong for a different move made during review.
    boards = replay(board, candidate)
    first = 1 if accepted else 2
    direction = "missed_opportunity" if accepted else "allowed_opponent_tactic"
    delta, end = settled_delta(boards, board.turn, max_plies=16)
    gain = delta if accepted else -delta if delta is not None else None
    mate_supported = candidate.score.kind == "mate" and candidate.score.outcome() == (
        1 if accepted else -1
    )
    findings = []
    if len(boards) > first:
        findings = detect_patterns(
            boards,
            first,
            min(len(boards) - 1, 16) if mate_supported else end,
            analysis.id,
            direction,
            material_supported=gain is not None and gain >= 1,
            mate_supported=mate_supported,
        )
        if not accepted and gain is not None and gain >= 1:
            findings.extend(move_causes(boards, analysis.id))
    return MoveExplanation(
        attempt_id=selected_attempt.id if selected_attempt else None,
        authority="stockfish",
        accepted=accepted,
        move_uci=uci,
        move_san=san,
        summary=summary,
        notes=notes,
        frames=frames,
        orientation=exercise.orientation,
        analysis_id=analysis.id,
        engine_version=analysis.engine_version,
        score=candidate.score,
        findings=findings,
    )
