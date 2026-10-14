"""Generate geometric hypotheses; publish only after a matching native defense test.

These checks ask Stockfish about a specified set of legal defensive moves. A
positive result describes its best tested continuation at the recorded limits.
"""

from dataclasses import dataclass
from typing import Literal

import chess
from pydantic import BaseModel

from trainer.chess_core import Candidate, digest, position_key, valid_board
from trainer.continuations import continuation_end, replay
from trainer.errors import EvidenceIntegrityError
from trainer.tactical_geometry import (
    effective_attacks,
    names,
    piece_capture_ply,
    relative_pinners,
    tactical_plies,
    valuable_targets,
    witness,
)


class DefenseHypothesis(BaseModel):
    kind: Literal["fork_capture", "relative_pin", "relative_pin_escape", "trapped_piece"]
    root_analysis_id: str
    at_ply: int
    root_moves: list[str]
    plies: list[int]
    roles: dict[str, list[str]]
    target: int
    attacker: int
    rear: int | None = None
    direction: str

    @property
    def key(self):
        return digest({"hypothesis_version": "1", **self.model_dump()})


@dataclass(frozen=True)
class Moment:
    """One move of the episode, as every hypothesis rule reads it."""

    boards: list
    plies: list
    ply: int
    first: int
    end: int
    max_plies: int
    analysis_id: str
    direction: str

    @property
    def before(self):
        return self.boards[self.ply - 1]

    @property
    def after(self):
        return self.boards[self.ply]

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
    def targets(self):
        return valuable_targets(self.after, self.move.to_square)


def fork_capture(m: Moment):
    """A forking piece that can be taken: does taking it hold off the fork?"""
    boards, plies, ply, move, piece, targets = m.boards, m.plies, m.ply, m.move, m.piece, m.targets
    takes = sorted(
        x.uci()
        for x in m.after.legal_moves
        if x.to_square == move.to_square and m.after.is_capture(x)
    )
    collection = None
    for follow in [p for p in plies if p > ply]:
        action = boards[follow].peek()
        if boards[follow - 1].piece_at(move.to_square) != piece:
            break
        if action.from_square == move.to_square:
            if action.to_square in targets and boards[follow - 1].is_capture(action):
                collection = follow
            break
    if collection is None and ply + 2 in plies and takes:
        reply, follow = boards[ply + 1].peek(), boards[ply + 2].peek()
        if (
            reply.uci() in takes
            and follow.to_square == reply.to_square
            and boards[ply + 1].is_capture(follow)
        ):
            collection = ply + 2
        if collection is None and reply.uci() in takes:
            collections = [
                piece_capture_ply(boards, target, ply, plies[-1])
                for target in targets
                if m.after.piece_type_at(target) != chess.KING
            ]
            collection = min((p for p in collections if p is not None), default=None)
    if (
        takes
        and collection is not None
        and len(targets) >= 2
        and piece.piece_type != chess.KING
        and not targets <= effective_attacks(m.before, move.from_square)
    ):
        yield DefenseHypothesis(
            kind="fork_capture",
            root_analysis_id=m.analysis_id,
            at_ply=ply,
            root_moves=takes,
            plies=[ply, collection],
            target=boards[collection].peek().to_square,
            attacker=move.to_square,
            direction=m.direction,
            roles={"attacker": names([move.to_square]), "targets": names(sorted(targets))},
        )


def relative_pin_escape(m: Moment):
    """A new attack on a pinned piece whose every escape exposes the piece behind it."""
    boards, ply, move, after = m.boards, m.ply, m.move, m.after
    for target in m.targets - effective_attacks(m.before, move.from_square):
        victim = after.piece_at(target)
        collection = piece_capture_ply(boards, target, ply, min(m.end, m.first + m.max_plies - 1))
        if collection is None or victim.piece_type == chess.KING:
            continue
        for slider, rear in relative_pinners(after, target):
            if not all(
                b.piece_at(target) == victim and (slider, rear) in relative_pinners(b, target)
                for b in boards[ply:collection]
            ):
                continue
            escapes = [x for x in after.legal_moves if x.from_square == target]
            if not escapes:
                continue
            exposed = []
            for escape in escapes:
                escaped = after.copy()
                escaped.push(escape)
                capture_rear = chess.Move(slider, rear)
                if capture_rear in escaped.legal_moves and escaped.is_capture(capture_rear):
                    exposed.append(escape.uci())
            if len(exposed) == len(escapes):
                yield DefenseHypothesis(
                    kind="relative_pin_escape",
                    root_analysis_id=m.analysis_id,
                    at_ply=ply,
                    root_moves=sorted(exposed),
                    plies=[ply, collection],
                    target=target,
                    attacker=slider,
                    rear=rear,
                    direction=m.direction,
                    roles={
                        "attacker": names([slider, move.to_square]),
                        "target": names([target, rear]),
                    },
                )


def pinned_recapture(m: Moment):
    """A capture whose recapturing defender is pinned to a more valuable piece."""
    before, after, move = m.before, m.after, m.move
    if not before.is_capture(move):
        return
    for recapture in after.legal_moves:
        if recapture.to_square != move.to_square or not after.is_capture(recapture):
            continue
        defender = before.piece_at(recapture.from_square)
        if defender is None or defender.piece_type == chess.KING:
            continue
        for slider, rear in relative_pinners(before, recapture.from_square, effective=False):
            branch = after.copy()
            branch.push(recapture)
            collect = chess.Move(slider, rear)
            if collect not in branch.legal_moves or not branch.is_capture(collect):
                continue
            yield DefenseHypothesis(
                kind="relative_pin",
                root_analysis_id=m.analysis_id,
                at_ply=m.ply,
                root_moves=[recapture.uci()],
                plies=[m.ply],
                target=move.to_square,
                attacker=slider,
                rear=rear,
                direction=m.direction,
                roles={
                    "attacker": names([slider]),
                    "target": names([move.to_square, rear]),
                    "pinned_defender": names([recapture.from_square]),
                },
            )


def trapped_piece(m: Moment):
    """An attacked piece with no escape square that cannot be taken."""
    boards, ply, move, after = m.boards, m.ply, m.move, m.after
    if ply + 2 not in m.plies or after.is_check():
        return
    reply, collect = boards[ply + 1].peek(), boards[ply + 2].peek()
    target = reply.from_square if collect.to_square == reply.to_square else collect.to_square
    victim = after.piece_at(target)
    if (
        victim is None
        or victim.color == m.actor
        or victim.piece_type in {chess.PAWN, chess.KING}
        or target not in valuable_targets(after, move.to_square)
        or not boards[ply + 1].is_capture(collect)
    ):
        return
    escapes = [x for x in after.legal_moves if x.from_square == target]
    if not escapes:
        return  # Absolute pins/check evasions are not automatically trapped pieces.
    for escape in escapes:
        escaped = after.copy()
        escaped.push(escape)
        if not any(
            x.to_square == escape.to_square and escaped.is_capture(x) for x in escaped.legal_moves
        ):
            return
    yield DefenseHypothesis(
        kind="trapped_piece",
        root_analysis_id=m.analysis_id,
        at_ply=ply,
        root_moves=sorted(x.uci() for x in escapes),
        plies=[ply, ply + 2],
        target=target,
        attacker=move.to_square,
        direction=m.direction,
        roles={"attacker": names([move.to_square]), "target": names([target])},
    )


# One rule per hypothesis, in this order; each reads the move on its own, so a
# rule added here never depends on an earlier rule's early exit.
RULES = (fork_capture, relative_pin_escape, pinned_recapture, trapped_piece)


def hypotheses(boards, first, end, analysis_id, direction, max_plies=8):
    plies = tactical_plies(boards, first, end, max_plies)
    found = [
        hypothesis
        for ply in plies
        for rule in RULES
        for hypothesis in rule(
            Moment(boards, plies, ply, first, end, max_plies, analysis_id, direction)
        )
    ]
    return list({item.key: item for item in found}.values())


def verify_defense(hypothesis, boards, root_candidate, probe, settings):
    request = hypothesis
    position = boards[request.at_ply]
    if (
        probe["query_key"] != request.key
        or probe["root_analysis_id"] != request.root_analysis_id
        or probe["at_ply"] != request.at_ply
        or probe["kind"] != request.kind
        or position_key(valid_board(probe["fen"])) != position_key(position)
        or sorted(probe["config"].get("root_moves") or []) != request.root_moves
    ):
        raise EvidenceIntegrityError(
            "Defensive probe does not match its hypothesis or legal position"
        )
    candidate = Candidate.model_validate(probe["candidate"])
    if candidate.uci not in request.root_moves:
        raise EvidenceIntegrityError("Defensive probe contains an unrequested move")
    branch = replay(position, candidate)
    combined = boards[: request.at_ply + 1] + branch[1:]
    actor = not position.turn
    endpoint = continuation_end(combined, actor, settings["max_plies"], settings["extension_plies"])
    score = candidate.score.negate()  # Probe root is the defending side to move.
    reference = root_candidate.score if boards[0].turn == actor else root_candidate.score.negate()
    corroborates = (
        endpoint.material_delta is not None
        and endpoint.material_delta >= settings["min_material"]
        and (
            score.outcome() == 1
            or (
                score.kind == reference.kind == "cp"
                and score.value >= reference.value - settings["min_loss_cp"]
            )
        )
    )
    if not corroborates:
        return None, "unsettled" if endpoint.material_delta is None else "defense_not_refuted"
    skill = {
        "fork_capture": "fork",
        "relative_pin": "pin",
        "relative_pin_escape": "pin",
        "trapped_piece": "trapped_piece",
    }[request.kind]
    first_san = position.san(chess.Move.from_uci(candidate.uci))
    if request.kind in {"relative_pin", "relative_pin_escape"}:
        if len(branch) < 3 or branch[2].peek() != chess.Move(request.attacker, request.rear):
            return None, "rear_piece_not_collected"
        text = f"The pinned piece can legally play {first_san}, but that opens the line to the more valuable piece behind it. Stockfish's tested continuation captures that rear piece and retains a material gain."
    elif request.kind == "trapped_piece":
        escaped_to = chess.Move.from_uci(candidate.uci).to_square
        if (
            len(branch) < 3
            or branch[2].peek().to_square != escaped_to
            or not branch[1].is_capture(branch[2].peek())
        ):
            return None, "escaping_piece_not_collected"
        text = f"The attacked piece has no legal move to a square where it cannot immediately be captured. Stockfish checked its legal moves; the best tested escape, {first_san}, still loses it with a net material loss in that continuation."
    else:
        text = f"The move attacks multiple valuable targets. Capturing the attacking piece is legal, but Stockfish's best tested capture, {first_san}, still leaves a material gain for the attacking side in the saved continuation."
    finding = witness(
        boards,
        request.root_analysis_id,
        request.direction,
        skill,
        request.plies,
        request.roles,
        text,
        frame=request.at_ply - 1 if request.kind == "relative_pin" else request.at_ply,
        verification_analysis_ids=[probe["analysis_id"]],
    )
    finding.verification = "engine_defense"
    return finding, "confirmed"
