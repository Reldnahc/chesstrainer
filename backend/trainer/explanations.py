"""Explain recorded moves using saved engine evidence and legal replay only."""

from dataclasses import dataclass

from sqlalchemy import select

from trainer.chess_core import Candidate, legal_move, position_key, side_name, valid_board
from trainer.classification_stages import line_findings, line_rules, previous_move, read_line
from trainer.errors import EvidenceIntegrityError, InvalidInput, NotFound
from trainer.explanation_types import (
    NO_SOLUTION,
    SOLVE_FIRST,
    MoveExplanation,
    NoteKind,
    SummaryKind,
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


@dataclass(frozen=True)
class ResolvedAnswer:
    """The move an explanation is about, and the saved answer that grades it."""

    attempt_id: int | None
    uci: str
    grade: str
    answer: ExerciseAnswer | None


@dataclass(frozen=True)
class EngineSummary:
    """The headline an engine-backed explanation leads with, and any note it needs."""

    text: str
    kind: SummaryKind
    frame_index: int | None = None
    note: str | None = None
    note_kind: NoteKind | None = None


def shown_material_change(boards, settled, line_end):
    """The material change a summary may claim for the shown line.

    Read where the line settles, not at its last frame, which can stop in the
    middle of an exchange. Without a settled endpoint the last frame counts only
    when its capture cannot simply be taken back.
    """
    if settled is not None:
        return settled
    last = boards[-1]
    if len(boards) > 1 and boards[-2].is_capture(last.peek()):
        square = last.peek().to_square
        if any(reply.to_square == square for reply in last.legal_moves):
            return 0
    return line_end


def _resolve_answer(db, session, exercise, attempt_id, solution):
    """The primary solution once the session is complete, else the chosen attempt."""
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
        return ResolvedAnswer(None, answer.uci, answer.grade, answer)
    attempt = attempt_for(db, session, attempt_id)
    answer = db.get(ExerciseAnswer, (exercise.id, attempt.uci))
    return ResolvedAnswer(attempt.id, attempt.uci, attempt.grade, answer)


def _exercise_board(db, exercise):
    """The exercise position, replayed from its source game when it has one."""
    board = valid_board(exercise.fen)
    if exercise.decision_id:
        decision = db.get(Decision, exercise.decision_id)
        board = decision_board(db.get(Game, decision.game_id), decision.ply)
    return board


def _curated_explanation(exercise, board, resolved, accepted, san):
    """Judge the move by the saved repertoire or manual answers alone, with no engine."""
    source = "repertoire" if exercise.source == "repertoire" else "manual exercise"
    explained = accepted and exercise.explanation
    return MoveExplanation(
        attempt_id=resolved.attempt_id,
        authority="curated",
        accepted=accepted,
        move_uci=resolved.uci,
        move_san=san,
        summary=f"This is a saved {source} move."
        if accepted
        else f"This move is outside the saved {source} answers.",
        summary_kind="curated_accepted" if accepted else "curated_rejected",
        notes=[
            "The saved answers define this exercise. A different legal move is not necessarily bad chess."
        ]
        + ([exercise.explanation] if explained else []),
        note_kinds=["curated_authority"] + ([None] if explained else []),
        frames=replay_line(board, [resolved.uci]),
        orientation=side_name(exercise.learner_color),
    )


def _saved_evidence(db, answer, board, uci):
    """The answer's saved analysis and this move's candidate in it, checked against the board."""
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
    return analysis, candidate


def _engine_summary(board, move, san, score, frames, balance_change, accepted):
    """The one claim the saved line supports, taking the most decisive first."""
    learner = color_name(board.turn)
    if score.kind == "mate":
        if score.outcome() == 1:
            return EngineSummary(
                f"Stockfish finds a forced mate for {learner} after {san}.", "mate_for_mover"
            )
        return EngineSummary(
            f"Stockfish finds a forced mate for {color_name(not board.turn)} after {san}.",
            "mate_against_mover",
        )
    if accepted and balance_change > 0:
        return EngineSummary(
            f"In this line, {learner} gains {balance_change} points of material.", "material_gain"
        )
    if not accepted and balance_change < 0:
        return EngineSummary(
            f"In this line, {learner} loses {abs(balance_change)} points of material.",
            "material_loss",
        )
    if not accepted and len(frames) > 2 and (frames[2].capture or frames[2].gives_check):
        return EngineSummary(frames[2].annotation, "frame", 2)
    if accepted and (
        board.is_capture(move)
        or board.gives_check(move)
        or board.is_check()
        or board.is_castling(move)
        or move.promotion
    ):
        return EngineSummary(frames[1].annotation, "frame", 1)
    return EngineSummary(
        "This move meets your exercise's engine acceptance policy."
        if accepted
        else "This move falls outside your exercise's engine acceptance policy.",
        "engine_accepted" if accepted else "engine_rejected",
        note="The saved line does not establish a simple tactical reason. Step through it to compare the replies; no positional explanation has been inferred.",
        note_kind="no_simple_reason",
    )


def shown_line(board, candidate, rules):
    """The answer line read and shown as game review reads it.

    The line is read as ``read_line`` reads it; the frames stop where
    ``rules.shown`` says, and the summary's material change reads only the boards
    those frames show.
    """
    boards, delta, end = read_line(board, candidate, rules)
    frames = replay_line(board, rules.shown(candidate, end))
    change = shown_material_change(boards[: len(frames)], delta, frames[-1].material_change)
    return boards, delta, end, frames, change


def _answer_findings(boards, analysis_id, score, delta, end, accepted, rules, previous):
    """Playback findings for the shown line, from the move the learner must answer for."""
    # These witnesses come from THIS answer's exact line. A classification from
    # the source game would be wrong for a different move made during review.
    first = 1 if accepted else 2
    if len(boards) <= first:
        return []
    gain = delta if accepted else -delta if delta is not None else None
    # A check/fork/pin can be visible even when this finite PV has no settled
    # material endpoint; the rules add it as a factual playback annotation,
    # never an additional grading event or automatically a weakness label.
    return line_findings(
        boards,
        first,
        analysis_id,
        rules,
        end=end,
        material_supported=gain is not None and gain >= 1,
        mate_supported=score.kind == "mate" and score.outcome() == (1 if accepted else -1),
        previous=previous,
    )


def explain_review(db, session_id, attempt_id=None, solution=False, parameters=None):
    session = db.get(ReviewSession, session_id)
    if session is None:
        raise NotFound("Review session not found")
    snapshot = opening_recall.get_snapshot(db, session)
    if snapshot:
        return opening_recall.explain(db, session, snapshot, attempt_id, solution)
    exercise = db.get(Exercise, session.exercise_id)
    resolved = _resolve_answer(db, session, exercise, attempt_id, solution)
    board = _exercise_board(db, exercise)
    move = legal_move(board, resolved.uci)
    accepted = resolved.grade in {"correct", "acceptable"}
    san = board.san(move)
    if exercise.source != "game":
        return _curated_explanation(exercise, board, resolved, accepted, san)
    analysis, candidate = _saved_evidence(db, resolved.answer, board, resolved.uci)
    # The game review's horizon and the move before, so the shown line, the
    # summary and its findings read as far ahead as the review and the classifier.
    rules = line_rules(parameters, annotate=True, causes_first=False)
    boards, delta, end, frames, balance_change = shown_line(board, candidate, rules)
    summary = _engine_summary(board, move, san, candidate.score, frames, balance_change, accepted)
    notes = [
        "This is one Stockfish continuation against strong replies; it does not mean every reply is forced.",
        "Material changes refer only to the shown line, compared with the starting position. Pieces use values 1/3/3/5/9.",
    ]
    note_kinds = ["strong_replies", "material_scope"]
    if summary.note:
        notes.append(summary.note)
        note_kinds.append(summary.note_kind)
    notes.append(f"Your saved answer policy is {exercise.policy.get('mode', 'practical')}.")
    note_kinds.append("saved_policy")
    return MoveExplanation(
        attempt_id=resolved.attempt_id,
        authority="stockfish",
        accepted=accepted,
        move_uci=resolved.uci,
        move_san=san,
        summary=summary.text,
        summary_kind=summary.kind,
        summary_frame_index=summary.frame_index,
        notes=notes,
        note_kinds=note_kinds,
        frames=frames,
        orientation=side_name(exercise.learner_color),
        analysis_id=analysis.id,
        engine_version=analysis.engine_version,
        score=candidate.score,
        findings=_answer_findings(
            boards,
            analysis.id,
            candidate.score,
            delta,
            end,
            accepted,
            rules,
            previous_move(board),
        ),
    )
