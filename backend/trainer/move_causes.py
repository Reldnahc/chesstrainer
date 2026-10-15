"""Before/after witnesses for the learner's move, without inferring intentions."""

from dataclasses import dataclass

import chess

from trainer.chess_core import VALUES, legal_move, position_key, valid_board
from trainer.errors import EvidenceIntegrityError
from trainer.tactical_geometry import defenders, effective_attacks, names, relative_pinners, witness

DIRECTION = "allowed_opponent_tactic"


@dataclass(frozen=True)
class Capture:
    """The learner's move and the opponent's capture that follows it."""

    boards: list
    analysis_id: str
    victim: chess.Piece

    @property
    def before(self):
        return self.boards[0]

    @property
    def after(self):
        return self.boards[1]

    @property
    def learner(self):
        return self.before.turn

    @property
    def move(self):
        return self.after.peek()

    @property
    def reply(self):
        return self.boards[2].peek()

    @property
    def target(self):
        return self.reply.to_square

    @property
    def common(self):
        return {"attacker": names([self.reply.from_square]), "target": names([self.target])}

    @property
    def target_stood_still(self):
        """The captured piece stood there before the move, and is not the moved piece."""
        return (
            self.before.piece_at(self.target) == self.victim and self.target != self.move.to_square
        )


def abandoned_defender(c: Capture, previous):
    if not c.target_stood_still or c.victim.piece_type == chess.PAWN:
        return
    if defenders(c.before, c.target, c.learner) == {c.move.from_square} and not defenders(
        c.after, c.target, c.learner
    ):
        yield witness(
            c.boards,
            c.analysis_id,
            DIRECTION,
            "abandoned_defender",
            [1, 2],
            c.common | {"defender": names([c.move.from_square])},
            f"{c.before.san(c.move)} moves the only unpinned defender of your {chess.piece_name(c.victim.piece_type)} on {chess.square_name(c.target)}. {c.after.san(c.reply)} then captures that piece in the saved continuation.",
            frame=0,
            mechanism="abandoned_defender",
        )


def opponent_threat(c: Capture, previous):
    """The opponent's previous move created the attack the learner's move then ignored."""
    if not c.target_stood_still or not previous or c.victim.piece_type == chess.PAWN:
        return
    before, reply, target = c.before, c.reply, c.target
    earlier = valid_board(previous["fen"])
    opponent_move = legal_move(earlier, previous["uci"])
    earlier_after = earlier.copy()
    earlier_after.push(opponent_move)
    if position_key(earlier_after) != position_key(before):
        raise EvidenceIntegrityError("Previous move does not reach the decision position")
    # The actual capturing piece must have acquired this attack on the
    # opponent's immediately preceding move, including an opened line.
    old_attacker = (
        opponent_move.from_square
        if reply.from_square == opponent_move.to_square
        else reply.from_square
    )
    was_attacking = target in effective_attacks(earlier, old_attacker)
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
            else f"The opponent's {earlier.san(opponent_move)} newly attacks your {chess.piece_name(c.victim.piece_type)} on {chess.square_name(target)}."
        )
        yield witness(
            c.boards,
            c.analysis_id,
            DIRECTION,
            "opponent_threat_recognition",
            [1, 2],
            c.common,
            f"{context} Your {before.san(c.move)} leaves the target there, and {c.after.san(reply)} captures it in the shown line.",
            frame=0,
            context_fen=earlier.fen(),
            context_move=opponent_move.uci(),
            mechanism="relative_pin_released" if releases_capture else "previous_threat",
        )


def exchange_balance(boards, square, mover):
    """The mover's net material from the consecutive captures on ``square``.

    Follows the line from its first move while each move captures on that square,
    so a recapture by the mover counts, not only the first two captures.
    """
    balance = 0
    for ply in range(1, len(boards)):
        position, move = boards[ply - 1], boards[ply].peek()
        if move.to_square != square or not position.is_capture(move):
            break
        if position.is_en_passant(move):
            value = VALUES[chess.PAWN]
        else:
            value = VALUES[position.piece_at(square).piece_type]
        balance += value if position.turn == mover else -value
    return balance


def bad_trade(c: Capture, previous):
    before, move, reply = c.before, c.move, c.reply
    if not before.is_capture(move) or move.promotion or reply.to_square != move.to_square:
        return
    captured = before.piece_at(move.to_square)
    if before.is_en_passant(move):
        captured = chess.Piece(chess.PAWN, not c.learner)
    # Only a net loss over the whole exchange on that square is a bad trade; a
    # recapture later in the line can turn the first two captures into a gain.
    net = exchange_balance(c.boards, move.to_square, c.learner)
    if captured and net < 0:
        yield witness(
            c.boards,
            c.analysis_id,
            DIRECTION,
            "avoiding_bad_trades",
            [1, 2],
            c.common | {"moved_piece": names([move.from_square])},
            f"{before.san(move)} takes a {chess.piece_name(captured.piece_type)}, but {c.after.san(reply)} recaptures your {chess.piece_name(c.victim.piece_type)}. This immediate exchange gives up {-net} material points; the saved comparison also favors the alternative.",
            frame=0,
            mechanism="unfavorable_exchange",
        )


# One rule per cause, in this order, which is also the order they are told in: a
# threat the move ignored comes before a defender it removed. None depends on
# another's early exit.
RULES = (opponent_threat, abandoned_defender, bad_trade)


def move_causes(boards, analysis_id, previous=None):
    if len(boards) < 3:
        return []
    after, reply = boards[1], boards[2].peek()
    if not after.is_capture(reply):
        return []
    victim = after.piece_at(reply.to_square)
    if victim is None:  # En passant is an exchange event, not a loose-piece witness here.
        return []
    capture = Capture(boards, analysis_id, victim)
    return [found for rule in RULES for found in rule(capture, previous)]
