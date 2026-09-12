"""Patterns whose witness spans a blocking move, a reply and a collection."""

import chess

from trainer.tactical_geometry import defenders, effective_attacks, names, valuable_targets, witness


def combinations(boards, plies, analysis_id, direction):
    found = []
    for ply in plies:
        before, after = boards[ply - 1], boards[ply]
        move, actor = after.peek(), before.turn
        for slider, piece in after.piece_map().items():
            if (
                piece.color != actor
                or piece.piece_type not in {chess.BISHOP, chess.ROOK, chess.QUEEN}
                or before.piece_at(slider) != piece
                or slider == move.to_square
            ):
                continue
            targets = valuable_targets(after, slider) - effective_attacks(before, slider)
            for target in sorted(targets):
                victim = after.piece_at(target)
                if victim.piece_type == chess.KING or move.from_square not in chess.SquareSet(
                    chess.between(slider, target)
                ):
                    continue
                collection = None
                for follow in [p for p in plies if p > ply]:
                    action = boards[follow].peek()
                    if boards[follow - 1].piece_at(slider) != piece:
                        break
                    if action.from_square == slider:
                        if (
                            action.to_square == target
                            and boards[follow - 1].piece_at(target) == victim
                        ):
                            collection = follow
                        break
                if collection is not None:
                    roles = {
                        "attacker": names([slider]),
                        "blocker": names([move.from_square]),
                        "target": names([target]),
                    }
                    found.append(
                        witness(
                            boards,
                            analysis_id,
                            direction,
                            "discovered_attack",
                            [ply, collection],
                            roles,
                            f"{before.san(move)} opens the {chess.piece_name(piece.piece_type)}'s line to the {chess.piece_name(victim.piece_type)} on {chess.square_name(target)}. That target is captured by this piece in the shown continuation.",
                            frame=ply - 1,
                        )
                    )
                    other_targets = valuable_targets(after, move.to_square) - {target}
                    if other_targets:
                        found.append(
                            witness(
                                boards,
                                analysis_id,
                                direction,
                                "double_attack",
                                [ply, collection],
                                {
                                    "attackers": names([slider, move.to_square]),
                                    "targets": names(sorted({target, *other_targets})),
                                },
                                f"{before.san(move)} creates threats from two pieces: the moved piece attacks one valuable target while the opened line attacks another. The opened line wins material in the shown continuation.",
                            )
                        )
        if ply + 2 not in plies:
            continue
        reply, capture = boards[ply + 1].peek(), boards[ply + 2].peek()
        victim = before.piece_at(capture.to_square)
        if (
            victim is None
            or victim.color == actor
            or victim.piece_type == chess.KING
            or before.piece_at(reply.from_square) is None
            or not boards[ply + 1].is_capture(capture)
            or before.piece_at(capture.to_square) != boards[ply + 1].piece_at(capture.to_square)
        ):
            continue
        # Require a check response or a capture of the preceding forcing move,
        # an actual sole defender, and a still-present target collected next.
        if (
            defenders(before, capture.to_square, not actor) == {reply.from_square}
            and (
                after.is_check() or (after.is_capture(reply) and reply.to_square == move.to_square)
            )
            and not defenders(boards[ply + 1], capture.to_square, not actor)
            and reply.from_square != capture.to_square
            and not before.is_capture(move)
        ):
            found.append(
                witness(
                    boards,
                    analysis_id,
                    direction,
                    "deflection",
                    [ply, ply + 1, ply + 2],
                    {
                        "attacker": names([move.from_square]),
                        "defender": names([reply.from_square]),
                        "target": names([capture.to_square]),
                    },
                    f"In this continuation, {before.san(move)} is answered by moving the defender from {chess.square_name(reply.from_square)}. This leaves the {chess.piece_name(victim.piece_type)} on {chess.square_name(capture.to_square)} undefended, and it is captured next.",
                    frame=ply - 1,
                )
            )
    return found
