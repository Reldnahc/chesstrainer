"""Geometry and legal witnesses shared by local tactical detectors."""

import chess

from trainer.chess_core import VALUES
from trainer.config import Settings
from trainer.diagnosis_types import RULE_VERSION, make_finding

# The default bound on one tactical episode, in plies.
TACTIC_PLIES = Settings.model_fields["classification_tactic_plies"].default
# The pieces that pin, skewer and attack along lines.
SLIDERS = frozenset({chess.BISHOP, chess.ROOK, chess.QUEEN})


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
    """Pieces of ``color`` that could take back on ``square``.

    A king counts only while no second enemy piece also covers the square: it
    cannot recapture into a square still attacked after the first capture.
    """
    found = {sq for sq in board.attackers(color, square) if square in effective_attacks(board, sq)}
    king = board.king(color)
    if king in found and len(board.attackers(not color, square)) > 1:
        found.discard(king)
    return found


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
            # As Lichess's fork rule: worth more than the attacker, or hanging. A
            # defended piece of equal value is not something the fork wins.
            or VALUES[target.piece_type] > VALUES.get(piece.piece_type, 99)
            or not defenders(board, sq, target.color)
        )
    }


def tactical_plies(boards, first, end, tactic_plies=TACTIC_PLIES):
    """Follow checks, exchanges and collection of existing threats; stop on a quiet gap."""
    if first >= len(boards):
        return []
    result = [first]
    for ply in range(first + 2, min(end, first + tactic_plies - 1) + 1, 2):
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


def absolute_pinner(board, square):
    """The square of the piece pinning the piece on ``square`` to its king, or None.

    That is the first piece beyond the pinned one on the line from its king, the
    one actually pinning, never another slider further along the same line.
    """
    piece = board.piece_at(square)
    if piece is None or piece.piece_type == chess.KING or not board.is_pinned(piece.color, square):
        return None
    king = board.king(piece.color)
    file_step = (chess.square_file(square) > chess.square_file(king)) - (
        chess.square_file(square) < chess.square_file(king)
    )
    rank_step = (chess.square_rank(square) > chess.square_rank(king)) - (
        chess.square_rank(square) < chess.square_rank(king)
    )
    file, rank = chess.square_file(square), chess.square_rank(square)
    while True:
        file, rank = file + file_step, rank + rank_step
        if not (0 <= file < 8 and 0 <= rank < 8):
            return None
        beyond = chess.square(file, rank)
        if board.piece_at(beyond) is not None:
            return beyond


def relative_pinners(board, target, *, effective=True):
    """(slider, piece behind) for each slider pinning ``target`` to a more valuable piece.

    ``effective`` also requires the slider's attack on ``target`` to survive its own
    pins; the fork-capture probe reads raw attacks instead.
    """
    victim = board.piece_at(target)
    if victim is None or victim.piece_type == chess.KING:
        return []
    result = []
    for slider in board.attackers(not victim.color, target):
        piece = board.piece_at(slider)
        if piece.piece_type not in SLIDERS or (
            effective and target not in effective_attacks(board, slider)
        ):
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


def defender_capture_is_worthwhile(victim, defender, attacker, recaptured):
    """Whether taking a defender (piece types) is a removing-the-defender lesson.

    It is when the piece it guarded is worth at least the defender, or when the
    taker is recaptured and was itself worth at least the defender. The detector
    and the attribution safeguard read these pieces at different plies; that
    difference is theirs, the value rule is this one.
    """
    return VALUES[victim] >= VALUES[defender] or (
        recaptured and VALUES[attacker] >= VALUES[defender]
    )


def witness(boards, analysis_id, direction, skill, plies, roles, text, frame=None, **extra):
    # The actor is whoever makes the first witnessed move.
    return make_finding(
        boards,
        skill,
        plies,
        actor=boards[plies[0] - 1].turn,
        rule_id=f"{skill}:{RULE_VERSION}",
        direction=direction,
        analysis_id=analysis_id,
        squares=sorted({sq for values in roles.values() for sq in values}),
        roles=roles,
        frame_ply=frame if frame is not None else plies[0],
        explanation=text,
        cue_key=skill,
        verification="verified_line",
        **extra,
    )
