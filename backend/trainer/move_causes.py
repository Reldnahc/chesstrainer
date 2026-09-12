"""Before/after witnesses for the learner's move, without inferring intentions."""

import chess

from trainer.chess_core import VALUES, legal_move, position_key, valid_board
from trainer.tactical_geometry import defenders, effective_attacks, names, relative_pinners, witness


def move_causes(boards, analysis_id, previous=None):
    if len(boards) < 3:
        return []
    before, after, reply_board = boards[:3]
    learner, move, reply = before.turn, after.peek(), reply_board.peek()
    if not after.is_capture(reply):
        return []
    target = reply.to_square
    victim = after.piece_at(target)
    if victim is None:  # En passant is an exchange event, not a loose-piece witness here.
        return []
    found = []
    direction = "allowed_opponent_tactic"
    common = {"attacker": names([reply.from_square]), "target": names([target])}
    if before.piece_at(target) == victim and target != move.to_square:
        old_defenders = defenders(before, target, learner)
        if (
            old_defenders == {move.from_square}
            and not defenders(after, target, learner)
            and victim.piece_type != chess.PAWN
        ):
            found.append(
                witness(
                    boards,
                    analysis_id,
                    direction,
                    "abandoned_defender",
                    [1, 2],
                    common | {"defender": names([move.from_square])},
                    f"{before.san(move)} moves the only unpinned defender of your {chess.piece_name(victim.piece_type)} on {chess.square_name(target)}. {after.san(reply)} then captures that piece in the saved continuation.",
                    frame=0,
                )
            )
        if previous and victim.piece_type != chess.PAWN:
            earlier = valid_board(previous["fen"])
            opponent_move = legal_move(earlier, previous["uci"])
            earlier_after = earlier.copy()
            earlier_after.push(opponent_move)
            if position_key(earlier_after) != position_key(before):
                raise ValueError("Previous move does not reach the decision position")
            # The actual capturing piece must have acquired this attack on the
            # opponent's immediately preceding move, including an opened line.
            was_attacking = target in effective_attacks(
                earlier,
                opponent_move.from_square
                if reply.from_square == opponent_move.to_square
                else reply.from_square,
            )
            old_attacker = (
                opponent_move.from_square
                if reply.from_square == opponent_move.to_square
                else reply.from_square
            )
            removed_pins = set(relative_pinners(earlier, old_attacker)) - set(
                relative_pinners(before, reply.from_square)
            )
            releases_capture = False
            hypothetical = chess.Move(old_attacker, target, promotion=reply.promotion)
            if was_attacking and hypothetical in earlier.legal_moves:
                branch = earlier.copy()
                branch.push(hypothetical)
                releases_capture = any(
                    chess.Move(slider, rear) in branch.legal_moves
                    and branch.is_capture(chess.Move(slider, rear))
                    for slider, rear in removed_pins
                )
            if target in effective_attacks(before, reply.from_square) and (
                not was_attacking or releases_capture
            ):
                context = (
                    f"The opponent's {earlier.san(opponent_move)} breaks a relative pin on the capturing piece."
                    if releases_capture
                    else f"The opponent's {earlier.san(opponent_move)} newly attacks your {chess.piece_name(victim.piece_type)} on {chess.square_name(target)}."
                )
                found.append(
                    witness(
                        boards,
                        analysis_id,
                        direction,
                        "opponent_threat_recognition",
                        [1, 2],
                        common,
                        f"{context} Your {before.san(move)} leaves the target there, and {after.san(reply)} captures it in the shown line.",
                        frame=0,
                        context_fen=earlier.fen(),
                        context_move=opponent_move.uci(),
                    )
                )
    if before.is_capture(move) and not move.promotion and reply.to_square == move.to_square:
        captured = before.piece_at(move.to_square)
        if before.is_en_passant(move):
            captured = chess.Piece(chess.PAWN, not learner)
        if captured and VALUES[victim.piece_type] > VALUES[captured.piece_type]:
            found.append(
                witness(
                    boards,
                    analysis_id,
                    direction,
                    "avoiding_bad_trades",
                    [1, 2],
                    common | {"moved_piece": names([move.from_square])},
                    f"{before.san(move)} takes a {chess.piece_name(captured.piece_type)}, but {after.san(reply)} recaptures your {chess.piece_name(victim.piece_type)}. This immediate exchange gives up {VALUES[victim.piece_type] - VALUES[captured.piece_type]} material points; the saved comparison also favors the alternative.",
                    frame=0,
                )
            )
    return found
