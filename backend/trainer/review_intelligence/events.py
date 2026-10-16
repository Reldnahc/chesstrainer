"""Chess semantics derived from authority facts; no grades, persona or new searches."""

import chess

from trainer.chess_core import Score, digest, evaluation_loss
from trainer.review_intelligence.event_facts import objective_events, tactical_events
from trainer.review_intelligence.events_types import (
    CLOCK_VERSION,
    EVENTS_VERSION,
    EvidenceReference,
    MoveIntelligence,
    ReviewEvent,
)
from trainer.review_intelligence.positional import VERSION as POSITION_VERSION
from trainer.review_intelligence.positional import positional_events
from trainer.review_scores import is_poor

VERSION = EVENTS_VERSION


def semantic_line(line):
    return {
        "frames": [
            {k: v for k, v in frame.items() if k != "annotation"}
            for frame in line.get("frames", [])
        ],
        "findings": [
            {k: v for k, v in finding.items() if k not in {"explanation", "cue"}}
            for finding in line.get("findings", [])
        ],
    }


def move_source(report, practical, context, ply):
    """Everything the move's events are derived from; its digest keys the result."""
    return {
        "version": VERSION,
        "positional_version": POSITION_VERSION,
        "practical": practical.input_digest,
        "before": report.get("before_analysis_id"),
        "played": report.get("played_analysis_id"),
        "actual_line": semantic_line(report.get("actual_line", {})),
        "best_line": semantic_line(report.get("best_line", {})),
        "previous_score": report.get("previous_score"),
        "context": {"pgn": context.pgn_digest, "ply": ply} if context else None,
    }


def saved_transition(fen, move_uci, limitations):
    """The saved board and its legal move, or None with the reason noted."""
    if not fen:
        limitations.append("position_not_available")
        return None
    board = chess.Board(fen)
    move = chess.Move.from_uci(move_uci)
    if not board.is_valid() or move not in board.legal_moves:
        limitations.append("invalid_saved_move_context")
        return None
    return board, move


def event_recorders(events, ply, actor):
    """The `ref` and `emit` callbacks every rule family receives."""

    def ref(kind, identifier, field):
        return EvidenceReference(source=kind, id=identifier, field=field, ply=ply)

    def emit(kind, confidence, importance, facts, evidence, mover=actor):
        payload = dict(
            kind=kind,
            actor=mover,
            confidence=confidence,
            importance=importance,
            facts=facts,
            evidence=evidence,
        )
        identity = digest(
            {
                "version": VERSION,
                **payload,
                "evidence": [item.model_dump() for item in evidence],
            }
        )
        events.append(ReviewEvent(id=identity, **payload))

    return ref, emit


def termination(board):
    if board.is_checkmate():
        return "checkmate"
    if board.is_stalemate():
        return "stalemate"
    return "insufficient_material" if board.is_insufficient_material() else None


def board_events(board, after, emit, position_ref):
    """The game ends, or the move gives or escapes check."""
    finish = termination(after)
    if finish:
        emit(
            "finish",
            "board_fact",
            100,
            {"termination": finish, "result": after.result()},
            [position_ref],
        )
    elif after.is_check() or board.is_check():
        emit(
            "check",
            "board_fact",
            35,
            {"gives_check": after.is_check(), "escapes_check": board.is_check()},
            [position_ref],
        )


def engine_events(report, practical, board, fen, actor, context, emit, ref, limitations):
    """Objective, tactical and positional rules; returns the two analysis references.

    Each family needs both saved Stockfish analyses, so none runs without them."""
    ids = [report.get("before_analysis_id"), report.get("played_analysis_id")]
    if not all(ids):
        limitations.append("objective_evidence_references_missing")
        return []
    objective_refs = [
        ref("stockfish", ids[0], "best/second_score"),
        ref("stockfish", ids[1], "actual/score"),
    ]
    objective_events(report, practical, emit, objective_refs, ref)
    tactical_events(report, emit, ref, fen, actor)
    positional_events(report, board, emit, ref, context)
    return objective_refs


def human_contrast(report, practical, emit, ref, objective_refs):
    human = report.get("human") or {}
    observations = [
        value
        for value in practical.interpretations
        if value in {"natural_error", "unusual_strong_move"}
    ]
    if practical.best_naturalness == "unusual":
        observations.append("engine_human_disagreement")
    if not (observations and human.get("evidence_id") and objective_refs):
        return
    emit(
        "human_contrast",
        "model_signal",
        45,
        {
            "observations": observations,
            "played_naturalness": practical.played_naturalness,
            "best_naturalness": practical.best_naturalness,
            "confidence": practical.confidence,
            "domain": human.get("domain"),
            "conditioning": human.get("conditioning"),
        },
        [
            ref("human", human["evidence_id"], "policy"),
            ref("rule", practical.version, practical.input_digest),
            *objective_refs,
        ],
    )


def clock_events(report, context, emit, ref, objective_refs, limitations):
    """Clock annotations; the clock is reported beside an error, never as its cause."""
    clock = context.clock
    pgn = ref("pgn", context.pgn_digest, "mainline/clock")
    loss = evaluation_loss(
        Score.model_validate(report["best"]["score"]),
        Score.model_validate(report["actual"]["score"]),
    )
    if clock.before_band in {"critical", "low"} or clock.tempo in {
        "fast_with_time",
        "long_think",
    }:
        emit(
            "clock_observation",
            "annotation",
            40,
            {
                "before_band": clock.before_band,
                "tempo": clock.tempo,
                "before_seconds": clock.before_seconds,
                "elapsed_seconds": clock.elapsed_seconds,
                "accompanied_error": is_poor(loss) if objective_refs else None,
                "causation": "not_inferred",
            },
            [pgn, ref("rule", CLOCK_VERSION, "bands_and_tempo"), *objective_refs],
        )
    human = report.get("human") or {}
    if (
        clock.before_seconds is not None
        and clock.before_seconds < 30
        and human.get("status") == "available"
    ):
        limitations.append("human_training_excluded_clocks_under_30_seconds")


def opening_departure_event(context, emit, ref):
    if not context.opening_departure:
        return
    emit(
        "opening_departure",
        "annotation",
        20,
        context.opening_departure,
        [
            ref("pgn", context.pgn_digest, "mainline/move"),
            ref(
                "book",
                context.opening_departure["catalogue"],
                "first_unmatched_continuation",
            ),
        ],
    )


def describe_move(report, practical, context=None):
    frames = report.get("actual_line", {}).get("frames", [])
    fen = frames[0]["fen"] if frames else None
    move_uci = report["actual"]["uci"]
    limitations = list(practical.limitations)
    if context and (context.before_fen, context.uci) != (fen, move_uci):
        context = None
        limitations.append("mainline_context_mismatch")
    clock = context.clock if context else None
    ply = context.ply if context else None
    key = digest(move_source(report, practical, context, ply))
    events = []

    def result():
        return MoveIntelligence(
            input_digest=key,
            ply=ply,
            # Equal importance keeps emission order (line findings in their order),
            # never the order of content hashes, which change with rule versions.
            events=sorted(events, key=lambda event: -event.importance),
            clock=clock,
            limitations=sorted(set(limitations)),
        )

    transition = saved_transition(fen, move_uci, limitations)
    if transition is None:
        return result()
    board, move = transition
    actor = "white" if board.turn else "black"
    after = board.copy()
    after.push(move)
    position_ref = EvidenceReference(
        source="position",
        id=digest({"fen": fen, "move": move_uci}),
        field="legal_transition",
        ply=ply,
    )
    ref, emit = event_recorders(events, ply, actor)
    board_events(board, after, emit, position_ref)
    objective_refs = engine_events(
        report, practical, board, fen, actor, context, emit, ref, limitations
    )
    human_contrast(report, practical, emit, ref, objective_refs)
    if context:
        clock_events(report, context, emit, ref, objective_refs, limitations)
        opening_departure_event(context, emit, ref)
    return result()
