"""Durable puzzle commands. Opponent replies commit with the learner move."""

import chess
from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm.attributes import set_committed_value

from trainer.chess_core import legal_move_options
from trainer.contracts.puzzles import (
    PuzzleCompletion,
    PuzzleFeedback,
    PuzzleKey,
    PuzzleSessionView,
)
from trainer.models import PuzzleAttempt, PuzzleSession, now
from trainer.puzzles.definitions import PuzzleDefinition


def require_session(db, session_id):
    session = db.get(PuzzleSession, session_id)
    if session is None:
        raise HTTPException(404, "Puzzle session not found")
    return session


def session_view(db, session, *, playback=(), feedback=None):
    definition = PuzzleDefinition.model_validate(session.snapshot)
    frames = definition.frames()
    history = frames[: session.current_step]
    fen = history[-1].after_fen if history else definition.initial_fen
    if feedback is None:
        feedback = db.scalar(
            select(PuzzleAttempt.response["feedback"])
            .where(
                PuzzleAttempt.session_id == session.id,
                PuzzleAttempt.request["revision"].as_integer() == session.revision - 1,
            )
            .limit(1)
        )
    completion = None
    if session.status != "active":
        completion = PuzzleCompletion(
            themes=list(definition.themes),
            rating=definition.rating,
            provenance=definition.provenance,
            solution=frames,
        )
    return PuzzleSessionView(
        id=session.id,
        source=definition.source,
        fen=fen,
        orientation=definition.orientation,
        legal_moves=legal_move_options(chess.Board(fen)) if session.status == "active" else [],
        history=history,
        revision=session.revision,
        current_step=session.current_step,
        status=session.status,
        failed=session.failed,
        feedback=feedback,
        playback=list(playback),
        completion=completion,
    ).model_dump(mode="json")


def library(db, providers):
    sources = {}
    for provider, _ in providers.catalog(db):
        info = sources.setdefault(
            provider.id,
            {"id": provider.id, "name": provider.name, "source": provider.source, "count": 0},
        )
        info["count"] += 1
    resume = db.execute(
        select(
            PuzzleSession.id,
            PuzzleSession.puzzle_source,
            PuzzleSession.started_at,
            PuzzleSession.updated_at,
            PuzzleSession.failed,
        )
        .where(PuzzleSession.status == "active")
        .order_by(PuzzleSession.updated_at.desc(), PuzzleSession.id)
        .limit(20)
    )
    counts = {
        (status, failed): count
        for status, failed, count in db.execute(
            select(PuzzleSession.status, PuzzleSession.failed, func.count()).group_by(
                PuzzleSession.status, PuzzleSession.failed
            )
        )
    }
    clean, failed = counts.get(("solved", False), 0), counts.get(("solved", True), 0)
    return {
        "available": sum(info["count"] for info in sources.values()),
        "sources": list(sources.values()),
        "resume": [
            {
                "id": row.id,
                "source": row.puzzle_source,
                "started_at": row.started_at.isoformat(),
                "updated_at": row.updated_at.isoformat(),
                "failed": row.failed,
            }
            for row in resume
        ],
        "stats": {
            "solved": clean + failed,
            "clean": clean,
            "failed_then_solved": failed,
            "revealed": counts.get(("revealed", False), 0) + counts.get(("revealed", True), 0),
        },
    }


def next_puzzle(db, providers, source=None):
    seen = {
        tuple(row)
        for row in db.execute(
            select(
                PuzzleSession.provider_id,
                PuzzleSession.puzzle_key,
                PuzzleSession.definition_version,
            ).distinct()
        )
    }
    candidates = [
        PuzzleKey(provider_id=provider.id, key=definition.key, version=definition.version)
        for provider, definition in providers.catalog(db)
        if source is None or definition.source == source
    ]
    return next(
        (item for item in candidates if (item.provider_id, item.key, item.version) not in seen),
        candidates[0] if candidates else None,
    )


def start_session(db, providers, request):
    previous = db.scalar(
        select(PuzzleSession).where(PuzzleSession.request_id == request.request_id)
    )
    identity = (request.provider_id, request.key, request.version)
    if previous:
        if (previous.provider_id, previous.puzzle_key, previous.definition_version) != identity:
            raise HTTPException(409, "Request ID already used for another puzzle")
        return session_view(db, previous)
    definition = next(
        (
            item
            for provider, item in providers.catalog(db)
            if (provider.id, item.key, item.version) == identity
        ),
        None,
    )
    if definition is None:
        raise HTTPException(404, "Puzzle definition not found")
    session = PuzzleSession(
        request_id=request.request_id,
        provider_id=request.provider_id,
        puzzle_key=definition.key,
        definition_version=definition.version,
        puzzle_source=definition.source,
        snapshot=definition.model_dump(mode="json"),
    )
    db.add(session)
    db.flush()
    result = session_view(db, session)
    db.commit()
    return result


def command(db, session_id, request, *, reveal=False):
    session = require_session(db, session_id)
    payload = request.model_dump(mode="json") | {"action": "reveal" if reveal else "move"}
    previous = db.scalar(
        select(PuzzleAttempt).where(
            PuzzleAttempt.session_id == session.id, PuzzleAttempt.request_id == request.request_id
        )
    )
    if previous:
        if previous.request != payload:
            raise HTTPException(409, "Request ID already used for another puzzle action")
        return previous.response
    if request.revision != session.revision or session.status != "active":
        raise HTTPException(409, "Puzzle changed. Reload the session before continuing.")
    definition = PuzzleDefinition.model_validate(session.snapshot)
    frames = definition.frames()
    step = session.current_step
    fen = frames[step - 1].after_fen if step else definition.initial_fen
    board = chess.Board(fen)
    submitted_san = None
    if not reveal:
        try:
            move = board.parse_uci(request.uci)
        except ValueError as exc:
            raise HTTPException(422, "Move is not legal in the current puzzle position") from exc
        submitted_san = board.san(move)

    # The account lock handles normal requests; the conditional write also guards
    # against two sessions submitting the same expected revision concurrently.
    changed = db.execute(
        update(PuzzleSession)
        .where(PuzzleSession.id == session.id, PuzzleSession.revision == request.revision)
        .values(revision=request.revision + 1)
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        raise HTTPException(409, "Puzzle changed. Reload the session before continuing.")
    set_committed_value(session, "revision", request.revision + 1)
    if reveal:
        grade = "revealed"
        session.current_step = len(frames)
        session.status = "revealed"
    elif request.uci != definition.solution[step]:
        grade = "incorrect"
        session.failed = True
    else:
        grade = "correct"
        # Commit the known reply as well. Reload never needs to resubmit it.
        session.current_step = min(step + 2, len(frames))
        if session.current_step == len(frames):
            session.status = "solved"
    if not reveal and session.first_response_ms is None:
        session.first_response_ms = request.elapsed_ms
    session.updated_at = now()
    if session.status != "active":
        session.completed_at = session.updated_at
    result = session_view(
        db,
        session,
        playback=frames[step : session.current_step],
        feedback=PuzzleFeedback(grade=grade, submitted_san=submitted_san),
    )
    db.add(
        PuzzleAttempt(
            session_id=session.id,
            request_id=request.request_id,
            request=payload,
            step=step,
            uci=None if reveal else request.uci,
            grade=grade,
            elapsed_ms=0 if reveal else request.elapsed_ms,
            response=result,
        )
    )
    db.commit()
    return result
