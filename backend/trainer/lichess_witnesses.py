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


# Returned for an upstream hit this adapter deliberately does not credit to the
# line's mover (an opponent's back-rank mate, castling "uncovering" check, a pin
# that was already there and is not used). Unlike None, it is not a missing witness.
DECLINED = object()


def names(squares):
    return [chess.square_name(s) for s in sorted({s for s in squares if s is not None})]


def pinned_from_start(puzzle, node, square) -> bool:
    """Whether the piece pinned on ``square`` at ``node`` stood there, already pinned,
    before the line began. A piece that moved onto the square during the line (a
    recapture dragged onto the pin line) is a pin the line created."""
    start = puzzle.mainline[0].board()
    piece = node.board().piece_at(square)
    if piece is None or start.piece_at(square) != piece or not start.is_pinned(piece.color, square):
        return False
    line = puzzle.mainline[1 : puzzle.mainline.index(node) + 1]
    return not any(square in (item.move.from_square, item.move.to_square) for item in line)


def pin_used(puzzle, square) -> bool:
    """Whether some move of the line's mover exploits the piece pinned on ``square``
    while it stays there: captures or attacks it while it is pinned, lands where it
    could otherwise capture, or gives a check it could otherwise answer by capturing
    the checker or interposing. A pin the line never exploits is not its idea."""
    original = puzzle.mainline[0].board().piece_at(square)
    for node in puzzle.mainline[1::2]:
        before, board, move = node.parent.board(), node.board(), node.move
        if before.piece_at(square) != original:
            return False  # The piece has moved or been taken.
        if before.is_pinned(original.color, square) and (
            move.to_square == square
            or square in board.attacks(move.to_square)
            or move.to_square in before.attacks(square) & ~before.pin(original.color, square)
        ):
            return True
        if board.is_check() and board.is_pinned(original.color, square):
            king = board.king(original.color)
            answers = set(board.checkers())
            for checker in board.checkers():
                answers |= set(chess.SquareSet(chess.between(checker, king)))
            if any(
                m.from_square == square and m.to_square in answers for m in board.pseudo_legal_moves
            ):
                return True
    return False


def credited_pin(puzzle):
    """The first pin in the line's mover's moves that the line creates or exploits,
    as (node, pinned square, square it cannot capture on), or None."""
    for node in puzzle.mainline[1::2]:
        board = node.board()
        for square, piece in board.piece_map().items():
            if piece.color == puzzle.pov or not board.is_pinned(piece.color, square):
                continue
            if pinned_from_start(puzzle, node, square) and not pin_used(puzzle, square):
                continue
            free = board.attacks(square) & ~board.pin(piece.color, square)
            targets = [s for s in free if board.color_at(s) == puzzle.pov]
            if targets:
                # The checker first: that capture would have answered the check.
                checkers = [s for s in targets if s in board.checkers()]
                return node, square, (checkers or targets)[0]
    return None


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
    before = node.parent.board()
    actor = not node.turn()
    if actor != puzzle.pov:
        # Upstream back_rank_mate does not ask who is mated; when the mover is the
        # one being mated it describes the opponent's mate, which is not this
        # line's witness. Any other wrong-side return is a real integrity error.
        if rule == "back_rank_mate":
            return DECLINED
        raise ValueError("Upstream witness belongs to the wrong side")
    # Castling that gives check gives it from the castling rook itself; nothing
    # is uncovered.
    if rule == "discovered_check" and before.is_castling(move):
        return DECLINED
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
        # A pin that was already there before this line began is the line's only
        # when the move uses it: it lands where the pinned piece would otherwise
        # capture, or attacks the pinned piece. A pin the line itself created (a
        # sacrifice that drags a piece onto the pin line, then the mate it allows)
        # is the combination's idea, whichever later move exploits it.
        attack = context.get("attack")
        if pinned_from_start(puzzle, node, square) and not pin_used(puzzle, square):
            # Upstream stops at the first pin it sees. When that one is an old pin
            # the line ignores, a pin the line does create or exploit may follow.
            alternative = credited_pin(puzzle)
            if alternative is None:
                return DECLINED
            node, square, attack = alternative
            rule, ply = "pin_prevents_attack", positions[id(node)]
            board, san, plies, frame = node.board(), node.san(), [ply], ply
        roles = {"pinned_defender": names([square]), "king": names([board.king(not actor)])}
        if rule == "pin_prevents_attack":
            roles["target"] = names([attack])
            text = (
                f"After {san}, the piece on {chess.square_name(square)} is pinned to its king "
                f"and cannot capture on {chess.square_name(attack)}."
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
        # Upstream assumes a puzzle line the solver wins. A capture after which the
        # capturer is mated in the shown line (Opera game 16...Nxb8 17.Rd8#) is a
        # poisoned piece, not a hanging one.
        later = puzzle.mainline[puzzle.mainline.index(node) :]
        if any(item.board().is_checkmate() and item.board().turn == actor for item in later):
            return DECLINED
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
