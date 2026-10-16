"""Deterministic whole-game facts; no chat memory, engine work or personality."""

import chess

from trainer.chess_core import Score, digest
from trainer.review_intelligence.events_types import (
    EvidenceReference,
    MoveIntelligence,
)
from trainer.review_intelligence.game_links import (
    consistent,
    loss,
    repeated_links,
    sequential_links,
)
from trainer.review_intelligence.game_types import (
    GAME_CONTEXT_VERSION,
    GAME_RELATIONSHIP,
    ContextNode,
    GameContext,
    TurningPoint,
)
from trainer.review_scores import is_mistake

VERSION = GAME_CONTEXT_VERSION


def game_context(parsed, reports, *, completed=False):
    moves = list(parsed.mainline_moves())
    total = len(moves)
    nodes, segments, segment = [], [], []
    board = parsed.board()
    limitations = set()
    # Each node's typed events, parsed once for every relationship rule.
    events = {}
    for ply, move in enumerate(moves, 1):
        report = reports.get(ply)
        intel = (
            MoveIntelligence.model_validate(report["intelligence"])
            if report and report.get("intelligence")
            else None
        )
        frames = report.get("actual_line", {}).get("frames", []) if report else []
        valid = (
            intel
            and intel.ply == ply
            and frames
            and frames[0]["fen"] == board.fen()
            and report["actual"]["uci"] == move.uci()
            and report.get("before_analysis_id")
            and report.get("played_analysis_id")
        )
        if valid:
            node = ContextNode(
                ply=ply,
                actor="white" if board.turn else "black",
                input_digest=intel.input_digest,
                event_ids=[e.id for e in intel.events],
                before=Score.model_validate(report["best"]["score"]),
                after=Score.model_validate(report["actual"]["score"]),
                evidence=[
                    EvidenceReference(source="stockfish", id=report[key], field=field, ply=ply)
                    for key, field in [
                        ("before_analysis_id", "best/score"),
                        ("played_analysis_id", "actual/score"),
                    ]
                ],
            )
            if segment and not consistent(segment[-1], node):
                segments.append(segment)
                segment = []
                limitations.add("adjacent_searches_disagree_relationships_abstained")
            segment.append(node)
            nodes.append(node)
            events[ply] = intel.events
        elif segment:
            segments.append(segment)
            segment = []
        board.push(move)
    if segment:
        segments.append(segment)
    missing = sorted(set(range(1, total + 1)) - {n.ply for n in nodes})
    complete = completed and not missing
    if not complete:
        limitations.add("partial_review_relationships_are_provisional")
    result = parsed.headers.get("Result", "*")
    actual_result = board.result(claim_draw=False)
    if actual_result != "*" and result != actual_result:
        limitations.add("declared_result_conflicts_with_board")
        result = "*"
    pgn_id = digest(str(parsed))
    key = digest(
        dict(
            version=VERSION,
            pgn=pgn_id,
            complete=complete,
            nodes=[n.model_dump(mode="json") for n in nodes],
        )
    )
    relationships = []

    def emit(kind, actor, linked, *, event_ids=None, **facts):
        references = [ref for n in linked for ref in n.evidence]
        references.append(EvidenceReference(source="pgn", id=pgn_id, field="mainline"))
        # Validated against the kind's typed facts (game_types).
        relationship = GAME_RELATIONSHIP.validate_python(
            dict(
                id="",
                kind=kind,
                actor=actor,
                plies=[n.ply for n in linked],
                event_ids=event_ids or [e for n in linked for e in n.event_ids],
                evidence=references,
                facts=facts,
            )
        )
        identity = digest(
            {"version": VERSION, **relationship.model_dump(mode="json", exclude={"id"})}
        )
        relationships.append(relationship.model_copy(update={"id": identity}))

    repeated_links(nodes, events, emit)
    for segment in segments:
        sequential_links(segment, emit, complete and segment[-1].ply == total, result)
        support_links(segment, moves, reports, events, emit)
    turning = []
    for node in nodes:
        drop = loss(node)
        mate = drop.allows_mate or drop.mate_lost
        if is_mistake(drop):
            turning.append(
                TurningPoint(
                    ply=node.ply,
                    actor=node.actor,
                    loss_cp=drop.cp,
                    mate_transition=mate,
                    event_ids=node.event_ids,
                )
            )
    turning.sort(key=lambda t: (-int(t.mate_transition), -(t.loss_cp or 0), t.ply))
    limitations.add("searched_advantage_is_not_a_proven_win")
    return GameContext(
        input_digest=key,
        complete=complete,
        total_plies=total,
        missing_plies=missing,
        nodes=nodes,
        relationships=sorted(relationships, key=lambda r: (r.plies[-1], r.kind, r.id)),
        turning_points=turning[:4],
        biggest_swing_ply=turning[0].ply if turning else None,
        limitations=sorted(limitations),
    )


def support_links(segment, moves, reports, events, emit):
    """Track a concrete surviving piece, not coincidentally equal square names."""
    pending = {}
    for node in segment:
        move = moves[node.ply - 1]
        board = chess.Board(reports[node.ply]["actual_line"]["frames"][0]["fen"])
        for key, value in list(pending.items()):
            color, square = key
            if board.is_castling(move) and color == node.actor:
                del pending[key]
            elif color == node.actor and square == move.from_square:
                del pending[key]
                pending[(color, move.to_square)] = value
            elif color != node.actor and square == move.to_square:
                del pending[key]
        for event in events[node.ply]:
            if (
                event.kind != "positional"
                or event.facts.line != "actual"
                or event.facts.feature != "piece_support"
            ):
                continue
            fact = event.facts
            key = (fact.side, chess.parse_square(fact.target))
            if not fact.after:
                pending[key] = (node, event)
            elif key in pending:
                earlier, original = pending.pop(key)
                if earlier.ply != node.ply:
                    emit(
                        "support_restored",
                        fact.side,
                        [earlier, node],
                        event_ids=[original.id, event.id],
                        piece=fact.piece,
                        target=fact.target,
                        causation="support_change_only",
                    )
