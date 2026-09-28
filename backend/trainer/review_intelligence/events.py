"""Chess semantics derived from authority facts; no grades, persona or new searches."""

import chess

from trainer.chess_core import Score, digest, evaluation_loss
from trainer.review_intelligence.event_facts import objective_events, tactical_events
from trainer.review_intelligence.events_types import (
    EvidenceReference,
    MoveIntelligence,
    ReviewEvent,
)
from trainer.review_intelligence.positional import VERSION as POSITION_VERSION
from trainer.review_intelligence.positional import positional_events

VERSION = "move-events-4"


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
    source = {
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
    key = digest(source)
    events = []

    def result():
        return MoveIntelligence(
            input_digest=key,
            ply=ply,
            events=sorted(events, key=lambda event: (-event.importance, event.id)),
            clock=clock,
            limitations=sorted(set(limitations)),
        )

    if not fen:
        limitations.append("position_not_available")
        return result()
    board = chess.Board(fen)
    move = chess.Move.from_uci(move_uci)
    if not board.is_valid() or move not in board.legal_moves:
        limitations.append("invalid_saved_move_context")
        return result()
    actor = "white" if board.turn else "black"
    after = board.copy()
    after.push(move)
    position_ref = EvidenceReference(
        source="position",
        id=digest({"fen": fen, "move": move_uci}),
        field="legal_transition",
        ply=ply,
    )

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

    if after.is_checkmate() or after.is_stalemate() or after.is_insufficient_material():
        finish = (
            "checkmate"
            if after.is_checkmate()
            else "stalemate"
            if after.is_stalemate()
            else "insufficient_material"
        )
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

    ids = [report.get("before_analysis_id"), report.get("played_analysis_id")]
    objective_refs = (
        [ref("stockfish", ids[0], "best/second_score"), ref("stockfish", ids[1], "actual/score")]
        if all(ids)
        else []
    )
    if all(ids):
        objective_events(
            report,
            practical,
            emit,
            objective_refs,
            ref,
        )
        tactical_events(report, emit, ref, fen, actor)
        positional_events(report, board, emit, ref, context)
    else:
        limitations.append("objective_evidence_references_missing")

    human = report.get("human") or {}
    observations = [
        value
        for value in practical.interpretations
        if value in {"natural_error", "unusual_strong_move"}
    ]
    if practical.best_naturalness == "unusual":
        observations.append("engine_human_disagreement")
    if observations and human.get("evidence_id") and objective_refs:
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

    if context:
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
                    "accompanied_error": (
                        loss.mate_lost or loss.allows_mate or (loss.cp or 0) >= 50
                    )
                    if objective_refs
                    else None,
                    "causation": "not_inferred",
                },
                [pgn, ref("rule", "clock-1", "bands_and_tempo"), *objective_refs],
            )
        if (
            clock.before_seconds is not None
            and clock.before_seconds < 30
            and human.get("status") == "available"
        ):
            limitations.append("human_training_excluded_clocks_under_30_seconds")
        if context.opening_departure:
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
    return result()
