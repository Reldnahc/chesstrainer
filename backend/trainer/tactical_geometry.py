"""Geometry and legal witnesses shared by local tactical detectors."""

import chess

from trainer.chess_core import VALUES
from trainer.diagnosis_types import CUES, RULE_VERSION, Finding


def names(squares):
    return [chess.square_name(s) for s in squares]


def effective_attacks(board, square):
    piece = board.piece_at(square)
    if piece is None:
        return set()
    attacks = set(board.attacks(square))
    if board.is_pinned(piece.color, square):
        attacks &= set(board.pin(piece.color, square))
    return attacks


def defenders(board, square, color):
    return {sq for sq in board.attackers(color, square) if square in effective_attacks(board, sq)}


def valuable_targets(board, attacker_square):
    piece = board.piece_at(attacker_square)
    if piece is None:
        return set()
    return {
        sq
        for sq in effective_attacks(board, attacker_square)
        if (target := board.piece_at(sq))
        and target.color != piece.color
        and target.piece_type != chess.PAWN
        and (
            target.piece_type == chess.KING
            or VALUES[target.piece_type] >= VALUES.get(piece.piece_type, 99)
            or not defenders(board, sq, target.color)
        )
    }


def tactical_plies(boards, first, end, max_plies=8):
    """Follow checks, exchanges and collection of existing threats; stop on a quiet gap."""
    if first >= len(boards):
        return []
    result = [first]
    for ply in range(first + 2, min(end, first + max_plies - 1) + 1, 2):
        prior, reply, current = boards[ply - 2], boards[ply - 1], boards[ply]
        reply_move, move = reply.peek(), current.peek()
        # A capture is connected if its target was already attacked before the reply.
        # A new check after two quiet, unrelated moves does not extend the episode.
        target = prior.piece_at(move.to_square)
        collection = (
            reply.is_capture(move)
            and target is not None
            and target.color != reply.turn
            and (
                prior.peek().to_square in defenders(prior, move.to_square, reply.turn)
                or bool(
                    defenders(prior, move.to_square, reply.turn)
                    - defenders(boards[ply - 3], move.to_square, reply.turn)
                )
            )
        )
        if not (
            prior.is_check()
            or prior.is_capture(reply_move)
            or reply_move.promotion
            or reply.is_check()
            or collection
        ):
            break
        result.append(ply)
    return result


def piece_capture_ply(boards, square, start, end):
    """Follow one concrete piece through moves until an opposing capture."""
    original = boards[start].piece_at(square)
    if original is None:
        return None
    for ply in range(start + 1, min(end, len(boards) - 1) + 1):
        before, after = boards[ply - 1], boards[ply]
        move = after.peek()
        if before.turn == original.color and move.from_square == square:
            square = move.to_square
        elif before.turn != original.color and before.is_capture(move) and move.to_square == square:
            return ply
        elif after.piece_at(square) is None:
            return None
    return None


def relative_pinners(board, target):
    victim = board.piece_at(target)
    if victim is None or victim.piece_type == chess.KING:
        return []
    result = []
    for slider in board.attackers(not victim.color, target):
        piece = board.piece_at(slider)
        if piece.piece_type not in {
            chess.BISHOP,
            chess.ROOK,
            chess.QUEEN,
        } or target not in effective_attacks(board, slider):
            continue
        for rear, rear_piece in board.piece_map().items():
            if (
                rear_piece.color != victim.color
                or rear_piece.piece_type == chess.KING
                or VALUES[rear_piece.piece_type] <= VALUES[victim.piece_type]
            ):
                continue
            between = chess.SquareSet(chess.between(slider, rear))
            if target in between and set(between & board.occupied) == {target}:
                result.append((slider, rear))
    return result


def witness(boards, analysis_id, direction, skill, plies, roles, text, frame=None, **extra):
    actor = boards[plies[0] - 1].turn
    return Finding(
        skill_id=skill,
        rule_id=f"{skill}:{RULE_VERSION}",
        direction=direction,
        actor="white" if actor else "black",
        analysis_id=analysis_id,
        plies=plies,
        moves=[boards[p].peek().uci() for p in plies],
        squares=sorted({sq for values in roles.values() for sq in values}),
        roles=roles,
        frame_ply=frame if frame is not None else plies[0],
        explanation=text,
        cue=CUES[skill],
        cue_key=skill,
        verification="verified_line",
        **extra,
    )
