"""Independent geometric rules for a verified continuation event.

The caller owns episode bounds and material/mate admission. Rules retain their
concrete collection witnesses and never assert that every defense is forced.
"""

from dataclasses import dataclass, field

import chess

from trainer.chess_core import VALUES, material
from trainer.diagnosis_types import Finding
from trainer.tactical_geometry import names, valuable_targets, witness


@dataclass
class TacticalEvent:
    """One action in a bounded, connected, legally replayed episode."""

    boards: list[chess.Board]
    first: int
    end: int
    analysis_id: str
    direction: str
    witness_end: int
    origin_first: int
    findings: list[Finding] = field(default_factory=list)

    @property
    def before(self):
        return self.boards[self.first - 1]

    @property
    def after(self):
        return self.boards[self.first]

    @property
    def move(self):
        return self.after.peek()

    @property
    def actor(self):
        return self.before.turn

    @property
    def piece(self):
        return self.after.piece_at(self.move.to_square)

    @property
    def san(self):
        return self.before.san(self.move)

    def add(self, skill, plies, roles, text, frame=None):
        self.findings.append(
            witness(self.boards, self.analysis_id, self.direction, skill, plies, roles, text, frame)
        )


def hanging_capture(event: TacticalEvent) -> None:
    captured = event.before.piece_at(event.move.to_square)
    gain = (
        material(event.boards[event.end], event.actor)
        - material(event.boards[event.end], not event.actor)
        - material(event.boards[0], event.actor)
        + material(event.boards[0], not event.actor)
    )
    immediate_gain = (
        material(event.after, event.actor)
        - material(event.after, not event.actor)
        - material(event.boards[0], event.actor)
        + material(event.boards[0], not event.actor)
    )
    if (
        event.first == event.origin_first
        and captured
        and captured.piece_type != chess.PAWN
        and not event.before.attackers(captured.color, event.move.to_square)
        and gain > 0
        # An equal trade followed by an unrelated lost pawn is not a hung
        # queen. Later compensation may reduce a real initial material loss.
        and immediate_gain > 0
    ):
        event.add(
            "hanging_piece"
            if event.direction == "allowed_opponent_tactic"
            else "missed_tactical_capture",
            [event.first],
            {"attacker": names([event.move.from_square]), "target": names([event.move.to_square])},
            f"{event.san} captures an undefended {chess.piece_name(captured.piece_type)}. The shown continuation has a net material gain for the capturing side.",
            frame=event.first - 1,
        )


def collected_fork(event: TacticalEvent) -> None:
    targets = valuable_targets(event.after, event.move.to_square)
    can_take = any(
        m.to_square == event.move.to_square and event.after.is_capture(m)
        for m in event.after.legal_moves
    )
    collection = None
    for follow in range(event.first + 2, event.witness_end + 1, 2):
        following = event.boards[follow].peek()
        if following.from_square == event.move.to_square:
            if following.to_square in targets and event.boards[follow - 1].is_capture(following):
                collection = follow
            break
        if event.boards[follow].piece_at(event.move.to_square) != event.piece:
            break
    if (
        event.piece.piece_type != chess.KING
        and len(targets) >= 2
        and not targets <= set(event.before.attacks(event.move.from_square))
        and not can_take
        and collection
    ):
        event.add(
            "fork",
            [event.first, collection],
            {"attacker": names([event.move.to_square]), "targets": names(sorted(targets))},
            f"{event.san} attacks multiple valuable targets. The same piece captures one in the shown continuation with a net material gain.",
        )


def promotion(event: TacticalEvent) -> None:
    if event.move.promotion:
        event.add(
            "promotion_awareness",
            [event.first],
            {"promoted_piece": names([event.move.to_square])},
            f"{event.san} promotes a pawn; the shown continuation retains a material gain.",
        )


def checking_attack(event: TacticalEvent) -> None:
    checkers = set(event.after.checkers())
    if len(checkers) > 1:
        event.add(
            "double_attack",
            [event.first],
            {
                "attackers": names(sorted(checkers)),
                "king": names([event.after.king(not event.actor)]),
            },
            f"{event.san} gives double check in this verified continuation.",
        )
    elif checkers and event.move.to_square not in checkers:
        event.add(
            "discovered_attack",
            [event.first],
            {
                "attacker": names(sorted(checkers)),
                "moved_piece": names([event.move.to_square]),
                "king": names([event.after.king(not event.actor)]),
            },
            f"{event.san} uncovers check from another piece in this verified continuation.",
        )


def pinned_defender(event: TacticalEvent) -> None:
    captured = (
        event.before.piece_at(event.move.to_square) if event.before.is_capture(event.move) else None
    )
    if captured:
        defenders = set(event.before.attackers(captured.color, event.move.to_square))
        pinned = [
            sq
            for sq in defenders
            if event.before.is_pinned(captured.color, sq)
            and event.move.to_square not in event.before.pin(captured.color, sq)
        ]
        if pinned and set(pinned) == defenders:
            event.add(
                "pin",
                [event.first],
                {
                    "attacker": names([event.move.from_square]),
                    "target": names([event.move.to_square]),
                    "pinned_defender": names(pinned),
                    "king": names([event.before.king(captured.color)]),
                },
                f"{event.san} captures the {chess.piece_name(captured.piece_type)}. Its geometric defenders are pinned to the king and cannot recapture on {chess.square_name(event.move.to_square)}. The shown line has a material gain.",
                frame=event.first - 1,
            )


def absolute_skewer(event: TacticalEvent) -> None:
    if (
        event.before.is_check() is False
        and event.after.is_check()
        and event.move.to_square in event.after.checkers()
        and event.piece.piece_type in {chess.BISHOP, chess.ROOK, chess.QUEEN}
        and event.first + 2 <= event.witness_end
    ):
        # Absolute skewer: king must leave the ray; this same slider then takes
        # a more distant valuable piece. Unrelated checks cannot satisfy it.
        king = event.after.king(not event.actor)
        follow = event.first + 2
        capture = event.boards[follow].peek()
        victim = event.after.piece_at(capture.to_square)
        if (
            capture.from_square == event.move.to_square
            and victim
            and victim.color != event.actor
            and victim.piece_type != chess.PAWN
            and king in chess.SquareSet(chess.between(event.move.to_square, capture.to_square))
            and event.boards[follow - 1].is_capture(capture)
        ):
            event.add(
                "skewer",
                [event.first, follow],
                {
                    "attacker": names([event.move.to_square]),
                    "king": names([king]),
                    "target": names([capture.to_square]),
                },
                f"{event.san} checks the king on the same line as the {chess.piece_name(victim.piece_type)} behind it. After the king moves, the same piece captures that target in the saved line.",
            )


def removed_defender(event: TacticalEvent) -> None:
    captured = (
        event.before.piece_at(event.move.to_square) if event.before.is_capture(event.move) else None
    )
    if captured and event.first + 2 <= event.witness_end:
        follow = event.boards[event.first + 2].peek()
        victim = event.before.piece_at(follow.to_square)
        if victim and victim.color != event.actor and victim.piece_type != chess.KING:
            defenders = set(event.before.attackers(victim.color, follow.to_square))
            capture_board = event.boards[event.first + 1]
            remaining = set(capture_board.attackers(victim.color, follow.to_square))
            if (
                defenders == {event.move.to_square}
                and not remaining
                and event.move.to_square != follow.to_square
                and capture_board.is_capture(follow)
                and (
                    VALUES[victim.piece_type] >= VALUES[captured.piece_type]
                    or (
                        event.boards[event.first].is_capture(event.boards[event.first + 1].peek())
                        and event.boards[event.first + 1].peek().to_square == event.move.to_square
                        and VALUES[event.piece.piece_type] >= VALUES[captured.piece_type]
                    )
                )
            ):
                event.add(
                    "removing_defender",
                    [event.first, event.first + 2],
                    {
                        "attacker": names([event.move.from_square]),
                        "defender": names([event.move.to_square]),
                        "target": names([follow.to_square]),
                    },
                    f"{event.san} removes the sole geometrical defender of the {chess.piece_name(victim.piece_type)} on {chess.square_name(follow.to_square)}. That piece is captured next in the verified continuation.",
                    frame=event.first - 1,
                )


def back_rank_mate(event: TacticalEvent) -> None:
    if event.after.is_checkmate() and event.piece.piece_type in {chess.ROOK, chess.QUEEN}:
        king = event.after.king(not event.actor)
        home = 7 if event.actor else 0
        if chess.square_rank(king) == home and chess.square_rank(event.move.to_square) == home:
            # Require the familiar own-pawn barrier, rather than calling every
            # edge-of-board rook mate a back-rank pattern.
            inward = home - 1 if home == 7 else 1
            pawns = [
                chess.square(file, inward)
                for file in range(
                    max(0, chess.square_file(king) - 1), min(7, chess.square_file(king) + 1) + 1
                )
                if event.after.piece_at(chess.square(file, inward))
                == chess.Piece(chess.PAWN, not event.actor)
            ]
            if len(pawns) >= 2:
                event.add(
                    "back_rank",
                    [event.first],
                    {
                        "attacker": names([event.move.to_square]),
                        "king": names([king]),
                        "escape_blockers": names(pawns),
                    },
                    f"{event.san} is checkmate on the back rank. Own pawns block some of the king's inward escape squares.",
                )
