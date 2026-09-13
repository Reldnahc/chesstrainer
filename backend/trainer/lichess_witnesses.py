"""Translate upstream return-site context into moves/squares, never new tag decisions."""

from dataclasses import dataclass

import chess
import chess.pgn


def record(puzzle, rule, result, context):
    # The original predicate result is returned unchanged. Each caller owns its
    # observer; no global tracing, logging setup or cross-worker mutable state.
    observer = getattr(puzzle, "record_hit", None)
    if result and observer is not None:
        observer(rule, context)
    return result


@dataclass
class MotifWitness:
    theme: str
    rule: str
    plies: list[int]
    frame_ply: int
    roles: dict[str, list[str]]
    explanation: str


def names(squares):
    return [chess.square_name(s) for s in sorted(set(squares)) if s is not None]


def witness(theme, rule, context, puzzle, positions) -> MotifWitness | None:
    node = context.get("node")
    if rule == "hanging_piece":
        node = puzzle.mainline[1]
    # discovered_attack can return its discovered_check child's True. The child
    # has already emitted the concrete event; the parent has no separate node.
    if not isinstance(node, chess.pgn.ChildNode):
        return None
    ply = positions[id(node)]
    board, move = node.board(), node.move
    actor = not node.turn()
    if actor != puzzle.pov:
        raise ValueError("Upstream witness belongs to the wrong side")
    san = node.san()
    plies, frame = [ply], ply
    roles = {}
    if rule == "fork":
        # These are the actually attacked non-pawn pieces, not a reimplementation
        # of the tagger's profitability/eligibility conditions.
        targets = [
            square
            for square in board.attacks(move.to_square)
            if (piece := board.piece_at(square))
            and piece.color != actor
            and piece.piece_type != chess.PAWN
        ]
        roles = {"attacker": names([move.to_square]), "targets": names(targets)}
        text = f"{san} attacks multiple enemy pieces in this continuation."
    elif rule in {"double_check", "discovered_check"}:
        roles = {"attackers": names(board.checkers()), "king": names([board.king(not actor)])}
        if rule == "discovered_check":
            roles = {
                "attacker": roles["attackers"],
                "king": roles["king"],
                "moved_piece": names([move.to_square]),
            }
        text = (
            f"{san} gives double check."
            if rule == "double_check"
            else f"{san} moves out of the way and uncovers check from another piece."
        )
    elif rule in {"pin_prevents_attack", "pin_prevents_escape"}:
        square = context.get("pinned_square", context.get("square"))
        roles = {"pinned_defender": names([square]), "king": names([board.king(not actor)])}
        if rule == "pin_prevents_attack":
            roles["target"] = names([context["attack"]])
            text = (
                f"After {san}, the piece on {chess.square_name(square)} is pinned to its king "
                f"and cannot capture on {chess.square_name(context['attack'])}."
            )
        else:
            roles["attacker"] = names([context["attacker_square"]])
            roles["target"] = names([square])
            text = (
                f"After {san}, the attacked piece on {chess.square_name(square)} is pinned "
                "to its king, restricting its escapes."
            )
    elif rule in {"promotion", "under_promotion"}:
        roles = {"promoted_piece": names([move.to_square])}
        text = f"{san} promotes the pawn to a {chess.piece_name(move.promotion)}."
    elif rule == "hanging_piece":
        frame = ply - 1
        roles = {"attacker": names([move.from_square]), "target": names([move.to_square])}
        text = f"{san} captures the undefended piece on {chess.square_name(move.to_square)}."
    elif rule in {"skewer", "discovered_attack", "capturing_defender", "deflection"}:
        previous = node.parent.parent
        start = positions[id(previous)]
        plies = [start, ply]
        frame = start - 1
        roles = {"attacker": names([move.from_square]), "target": names([move.to_square])}
        if rule == "skewer":
            roles["targets"] = names([node.parent.move.from_square, move.to_square])
            text = (
                f"After {node.parent.san()}, {san} captures the piece behind it on the same line."
            )
        elif rule == "discovered_attack":
            roles["blocker"] = names([previous.move.from_square])
            text = f"{previous.san()} opens the line used by {san} to capture the target."
        elif rule == "capturing_defender":
            roles["attacker"] = names([previous.move.from_square])
            roles["defender"] = names([previous.move.to_square])
            text = (
                f"{previous.san()} captures a defender of {chess.square_name(move.to_square)}; "
                f"{san} follows in the shown continuation."
            )
        else:
            roles["attacker"] = names([previous.move.from_square])
            roles["defender"] = names([node.parent.move.from_square])
            plies = [start, positions[id(node.parent)], ply]
            text = (
                f"{previous.san()} is answered by {node.parent.san()}, moving the defender; "
                f"{san} follows."
            )
    elif rule == "back_rank_mate":
        roles = {
            "attackers": names(board.checkers()),
            "king": names([board.king(not actor)]),
            "escape_blockers": names(context["squares"]),
        }
        text = f"{san} is checkmate on the back rank; the king's own pieces block its escape."
    else:
        raise ValueError(f"Unsupported upstream witness rule: {rule}")
    return MotifWitness(theme, rule, plies, frame, roles, text)
