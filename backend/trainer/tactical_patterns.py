"""Geometric motifs with concrete events in a legally replayed engine continuation."""

import chess

from trainer.chess_core import VALUES, material
from trainer.diagnosis_types import CUES, RULE_VERSION, Finding
from trainer.tactical_geometry import tactical_plies, valuable_targets


def names(squares):
    return [chess.square_name(s) for s in squares]


def detect_patterns(
    boards,
    first,
    end,
    analysis_id,
    direction,
    *,
    material_supported,
    mate_supported,
    max_tactic_plies=8,
):
    from trainer.combination_patterns import combinations

    plies = tactical_plies(boards, first, end, max_tactic_plies)
    if not plies:
        return []
    found = []
    for ply in plies:
        found.extend(
            _detect_at(
                boards,
                ply,
                end,
                analysis_id,
                direction,
                material_supported=material_supported,
                mate_supported=mate_supported,
                witness_end=plies[-1],
                origin_first=first,
            )
        )
    if material_supported:
        found.extend(combinations(boards, plies, analysis_id, direction))
    # A pattern can have multiple concrete witnesses, but duplicate tests of the
    # same event must not manufacture extra evidence or duplicate playback buttons.
    return list({(f.skill_id, tuple(f.plies), f.direction): f for f in found}.values())


def _detect_at(
    boards,
    first,
    end,
    analysis_id,
    direction,
    *,
    material_supported,
    mate_supported,
    witness_end,
    origin_first,
):
    found = []
    actor = boards[first - 1].turn

    def add(skill, plies, roles, text, frame=None):
        found.append(
            Finding(
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
                verification="verified_line",
            )
        )

    # Each action belongs to a bounded, connected tactical episode.
    before, after = boards[first - 1], boards[first]
    move = after.peek()
    piece = after.piece_at(move.to_square)
    san = before.san(move)
    if material_supported:
        captured = before.piece_at(move.to_square)
        gain = (
            material(boards[end], actor)
            - material(boards[end], not actor)
            - material(boards[0], actor)
            + material(boards[0], not actor)
        )
        immediate_gain = (
            material(after, actor)
            - material(after, not actor)
            - material(boards[0], actor)
            + material(boards[0], not actor)
        )
        if (
            first == origin_first
            and captured
            and captured.piece_type != chess.PAWN
            and not before.attackers(captured.color, move.to_square)
            and gain > 0
            # An equal trade followed by an unrelated lost pawn is not a hung
            # queen. Later compensation may reduce a real initial material loss.
            and immediate_gain > 0
        ):
            add(
                "hanging_piece"
                if direction == "allowed_opponent_tactic"
                else "missed_tactical_capture",
                [first],
                {"attacker": names([move.from_square]), "target": names([move.to_square])},
                f"{san} captures an undefended {chess.piece_name(captured.piece_type)}. The shown continuation has a net material gain for the capturing side.",
                frame=first - 1,
            )
        targets = valuable_targets(after, move.to_square)
        can_take = any(
            m.to_square == move.to_square and after.is_capture(m) for m in after.legal_moves
        )
        collection = None
        for follow in range(first + 2, witness_end + 1, 2):
            following = boards[follow].peek()
            if following.from_square == move.to_square:
                if following.to_square in targets and boards[follow - 1].is_capture(following):
                    collection = follow
                break
            if boards[follow].piece_at(move.to_square) != piece:
                break
        if (
            piece.piece_type != chess.KING
            and len(targets) >= 2
            and not targets <= set(before.attacks(move.from_square))
            and not can_take
            and collection
        ):
            add(
                "fork",
                [first, collection],
                {"attacker": names([move.to_square]), "targets": names(sorted(targets))},
                f"{san} attacks multiple valuable targets. The same piece captures one in the shown continuation with a net material gain.",
            )
        if move.promotion:
            add(
                "promotion_awareness",
                [first],
                {"promoted_piece": names([move.to_square])},
                f"{san} promotes a pawn; the shown continuation retains a material gain.",
            )
    if material_supported or mate_supported:
        checkers = set(after.checkers())
        if len(checkers) > 1:
            add(
                "double_attack",
                [first],
                {"attackers": names(sorted(checkers)), "king": names([after.king(not actor)])},
                f"{san} gives double check in this verified continuation.",
            )
        elif checkers and move.to_square not in checkers:
            add(
                "discovered_attack",
                [first],
                {
                    "attacker": names(sorted(checkers)),
                    "moved_piece": names([move.to_square]),
                    "king": names([after.king(not actor)]),
                },
                f"{san} uncovers check from another piece in this verified continuation.",
            )

    for ply in [first]:
        before, after = boards[ply - 1], boards[ply]
        move = after.peek()
        piece = after.piece_at(move.to_square)
        san = before.san(move)
        captured = before.piece_at(move.to_square) if before.is_capture(move) else None
        if material_supported and captured:
            defenders = set(before.attackers(captured.color, move.to_square))
            pinned = [
                sq
                for sq in defenders
                if before.is_pinned(captured.color, sq)
                and move.to_square not in before.pin(captured.color, sq)
            ]
            if pinned and set(pinned) == defenders:
                add(
                    "pin",
                    [ply],
                    {
                        "attacker": names([move.from_square]),
                        "target": names([move.to_square]),
                        "pinned_defender": names(pinned),
                        "king": names([before.king(captured.color)]),
                    },
                    f"{san} captures the {chess.piece_name(captured.piece_type)}. Its geometric defenders are pinned to the king and cannot recapture on {chess.square_name(move.to_square)}. The shown line has a material gain.",
                    frame=ply - 1,
                )
        if (
            material_supported
            and before.is_check() is False
            and after.is_check()
            and move.to_square in after.checkers()
            and piece.piece_type in {chess.BISHOP, chess.ROOK, chess.QUEEN}
        ):
            # Absolute skewer: king must leave the ray; this same slider then takes
            # a more distant valuable piece. Unrelated checks cannot satisfy it.
            king = after.king(not actor)
            for follow in range(ply + 2, min(witness_end, ply + 2) + 1, 2):
                capture = boards[follow].peek()
                victim = after.piece_at(capture.to_square)
                if (
                    capture.from_square == move.to_square
                    and victim
                    and victim.color != actor
                    and victim.piece_type != chess.PAWN
                    and king in chess.SquareSet(chess.between(move.to_square, capture.to_square))
                    and boards[follow - 1].is_capture(capture)
                ):
                    add(
                        "skewer",
                        [ply, follow],
                        {
                            "attacker": names([move.to_square]),
                            "king": names([king]),
                            "target": names([capture.to_square]),
                        },
                        f"{san} checks the king on the same line as the {chess.piece_name(victim.piece_type)} behind it. After the king moves, the same piece captures that target in the saved line.",
                    )
        if material_supported and captured and ply + 2 <= witness_end:
            follow = boards[ply + 2].peek()
            victim = before.piece_at(follow.to_square)
            if victim and victim.color != actor and victim.piece_type != chess.KING:
                defenders = set(before.attackers(victim.color, follow.to_square))
                capture_board = boards[ply + 1]
                remaining = set(capture_board.attackers(victim.color, follow.to_square))
                if (
                    defenders == {move.to_square}
                    and not remaining
                    and move.to_square != follow.to_square
                    and capture_board.is_capture(follow)
                    and (
                        VALUES[victim.piece_type] >= VALUES[captured.piece_type]
                        or (
                            boards[ply].is_capture(boards[ply + 1].peek())
                            and boards[ply + 1].peek().to_square == move.to_square
                            and VALUES[piece.piece_type] >= VALUES[captured.piece_type]
                        )
                    )
                ):
                    add(
                        "removing_defender",
                        [ply, ply + 2],
                        {
                            "attacker": names([move.from_square]),
                            "defender": names([move.to_square]),
                            "target": names([follow.to_square]),
                        },
                        f"{san} removes the sole geometrical defender of the {chess.piece_name(victim.piece_type)} on {chess.square_name(follow.to_square)}. That piece is captured next in the verified continuation.",
                        frame=ply - 1,
                    )
        if (
            (material_supported or mate_supported)
            and after.is_checkmate()
            and piece.piece_type in {chess.ROOK, chess.QUEEN}
        ):
            king = after.king(not actor)
            home = 7 if actor else 0
            if chess.square_rank(king) == home and chess.square_rank(move.to_square) == home:
                # Require the familiar own-pawn barrier, rather than calling every
                # edge-of-board rook mate a back-rank pattern.
                inward = home - 1 if home == 7 else 1
                pawns = [
                    chess.square(file, inward)
                    for file in range(
                        max(0, chess.square_file(king) - 1), min(7, chess.square_file(king) + 1) + 1
                    )
                    if after.piece_at(chess.square(file, inward))
                    == chess.Piece(chess.PAWN, not actor)
                ]
                if len(pawns) >= 2:
                    add(
                        "back_rank",
                        [ply],
                        {
                            "attacker": names([move.to_square]),
                            "king": names([king]),
                            "escape_blockers": names(pawns),
                        },
                        f"{san} is checkmate on the back rank. Own pawns block some of the king's inward escape squares.",
                    )
    return found
