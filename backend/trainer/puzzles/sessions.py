"""Durable puzzle commands. Opponent replies commit with the learner move."""

import random

import chess
from sqlalchemy import func, select

from trainer.chess_core import legal_move, legal_move_options
from trainer.contracts.puzzles import (
    PuzzleCompletion,
    PuzzleFeedback,
    PuzzleKey,
    PuzzleQuery,
    PuzzleSessionView,
)
from trainer.errors import Conflict, InvalidInput, NotFound
from trainer.models import PuzzleAttempt, PuzzleSession, now
from trainer.puzzles.definitions import PuzzleDefinition
from trainer.puzzles.generation import generation_status
from trainer.session_commands import (
    RESUME_LIMIT,
    answered_before,
    claim_revision,
    require_revision,
    started_before,
)

CHANGED = "Puzzle changed. Reload the session before continuing."


def require_session(db, session_id):
    session = db.get(PuzzleSession, session_id)
    if session is None:
        raise NotFound("Puzzle session not found")
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


# Length and provenance tags describe the dataset, not a tactical idea worth choosing.
META_THEMES = frozenset(
    {"short", "long", "veryLong", "oneMove", "master", "masterVsMaster", "superGM"}
)
RECENT_REPEAT_WINDOW = 20


def _history(db):
    """Latest session per puzzle identity (provider and key) plus the recent start order."""
    latest, recent = {}, []
    rows = db.execute(
        select(
            PuzzleSession.provider_id,
            PuzzleSession.puzzle_key,
            PuzzleSession.status,
            PuzzleSession.failed,
        ).order_by(PuzzleSession.started_at.desc(), PuzzleSession.id.desc())
    )
    for provider_id, key, status, failed in rows:
        identity = (provider_id, key)
        if identity not in latest:
            latest[identity] = (status, failed)
            if len(recent) < RECENT_REPEAT_WINDOW:
                recent.append(identity)
    return latest, set(recent)


# A goal is a Lichess goal theme: a mate, or a winning advantage short of mate.
GOAL_THEMES = {"mate": {"mate"}, "material": {"advantage", "crushing"}}


def _needs_retry(outcome):
    status, failed = outcome
    return status == "revealed" or (status == "solved" and failed)


def _matches(definition, query):
    if query.source is not None and definition.source != query.source:
        return False
    if query.theme is not None and query.theme not in definition.themes:
        return False
    if query.goal is not None and not GOAL_THEMES[query.goal] & set(definition.themes):
        return False
    if query.min_rating is not None or query.max_rating is not None:
        if definition.rating is None:
            return False
        if query.min_rating is not None and definition.rating < query.min_rating:
            return False
        if query.max_rating is not None and definition.rating > query.max_rating:
            return False
    return True


def library(db, providers, settings=None):
    sources, themes = {}, {}
    latest, _ = _history(db)
    # Installed puzzles with any solved attempt, including after a mistake.
    # Repeat solves of one puzzle count once; removed packs do not count.
    solved_identities = set(
        db.execute(
            select(PuzzleSession.provider_id, PuzzleSession.puzzle_key)
            .where(PuzzleSession.status == "solved")
            .distinct()
        ).tuples()
    )
    retry_available = solved_puzzles = 0
    for provider, definition in providers.catalog(db):
        info = sources.setdefault(
            provider.id,
            {
                "id": provider.id,
                "name": provider.name,
                "source": provider.source,
                "count": 0,
                "attribution": getattr(provider, "attribution", None),
                "url": getattr(provider, "url", None),
                "rating_min": None,
                "rating_max": None,
            },
        )
        info["count"] += 1
        if definition.rating is not None:
            low, high = info["rating_min"], info["rating_max"]
            info["rating_min"] = definition.rating if low is None else min(low, definition.rating)
            info["rating_max"] = definition.rating if high is None else max(high, definition.rating)
        for theme in definition.themes:
            if theme not in META_THEMES:
                by_source = themes.setdefault(theme, {})
                by_source[provider.source] = by_source.get(provider.source, 0) + 1
        if (provider.id, definition.key) in solved_identities:
            solved_puzzles += 1
        outcome = latest.get((provider.id, definition.key))
        if outcome is not None and _needs_retry(outcome):
            retry_available += 1
    resume = db.execute(
        select(
            PuzzleSession.id,
            PuzzleSession.puzzle_source,
            PuzzleSession.started_at,
            PuzzleSession.updated_at,
            PuzzleSession.failed,
        )
        # A started puzzle with no committed move or reveal has nothing to resume.
        .where(PuzzleSession.status == "active", PuzzleSession.revision > 0)
        .order_by(PuzzleSession.updated_at.desc(), PuzzleSession.id)
        .limit(RESUME_LIMIT)
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
        "themes": [
            {"id": theme, "count": sum(by_source.values()), "sources": by_source}
            for theme, by_source in sorted(
                themes.items(), key=lambda item: (-sum(item[1].values()), item[0])
            )
        ],
        "retry_available": retry_available,
        "solved_puzzles": solved_puzzles,
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
        "generation": generation_status(
            db, automatic=bool(settings is not None and settings.puzzle_generation)
        ),
    }


def next_puzzle(db, providers, query=None, *, rng=random):
    """Choose a matching puzzle. New mode prefers unseen, then avoids recent repeats;
    retry mode offers puzzles whose latest finished attempt was revealed or failed."""
    query = query or PuzzleQuery()
    latest, recent = _history(db)
    candidates = [
        (provider, definition)
        for provider, definition in providers.catalog(db)
        if _matches(definition, query)
    ]
    if query.mode == "retry":
        pool = [
            item
            for item in candidates
            if (outcome := latest.get((item[0].id, item[1].key))) is not None
            and _needs_retry(outcome)
        ]
    else:
        unseen = [item for item in candidates if (item[0].id, item[1].key) not in latest]
        pool = (
            unseen
            or [item for item in candidates if (item[0].id, item[1].key) not in recent]
            or candidates
        )
    if not pool:
        return None
    provider, definition = rng.choice(pool)
    return PuzzleKey(provider_id=provider.id, key=definition.key, version=definition.version)


def start_session(db, providers, request):
    previous = started_before(
        db,
        PuzzleSession,
        request.request_id,
        (request.provider_id, request.key, request.version),
        lambda row: (row.provider_id, row.puzzle_key, row.definition_version),
        "Request ID already used for another puzzle",
    )
    if previous:
        return session_view(db, previous)
    definition = providers.find(db, request.provider_id, request.key, request.version)
    if definition is None:
        raise NotFound("Puzzle definition not found")
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
    return session_view(db, session)


def command(db, session_id, request, *, reveal=False):
    session = require_session(db, session_id)
    payload = request.model_dump(mode="json") | {"action": "reveal" if reveal else "move"}
    answered = answered_before(
        db,
        PuzzleAttempt,
        session,
        request.request_id,
        payload,
        "Request ID already used for another puzzle action",
    )
    if answered is not None:
        return answered
    if session.status != "active":
        raise Conflict(CHANGED)
    require_revision(session, request.revision, CHANGED)
    definition = PuzzleDefinition.model_validate(session.snapshot)
    frames = definition.frames()
    step = session.current_step
    fen = frames[step - 1].after_fen if step else definition.initial_fen
    board = chess.Board(fen)
    submitted_san = None
    if not reveal:
        try:
            move = legal_move(board, request.uci)
        except ValueError as exc:
            raise InvalidInput("Move is not legal in the current puzzle position") from exc
        submitted_san = board.san(move)

    claim_revision(db, session, request.revision, CHANGED)
    if reveal:
        grade = "revealed"
        session.current_step = len(frames)
        session.status = "revealed"
    elif move.uci() != definition.solution[step]:
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
    db.flush()
    return result
