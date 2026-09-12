"""Generate geometric hypotheses; publish only after a matching native defense test.

These checks ask Stockfish about a specified set of legal defensive moves. A
positive result describes its best tested continuation at the recorded limits.
"""

from typing import Literal

import chess
from pydantic import BaseModel

from trainer.chess_core import VALUES, Candidate, digest, position_key, valid_board
from trainer.continuations import continuation_end, replay
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


def hypotheses(boards, first, end, analysis_id, direction, max_plies=8):
    plies = tactical_plies(boards, first, end, max_plies)
    found = []
    for ply in plies:
        before, after = boards[ply - 1], boards[ply]
        move, actor = after.peek(), before.turn
        piece = after.piece_at(move.to_square)
        targets = valuable_targets(after, move.to_square)
        takes = sorted(
            m.uci()
            for m in after.legal_moves
            if m.to_square == move.to_square and after.is_capture(m)
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
                    if after.piece_type_at(target) != chess.KING
                ]
                collection = min((p for p in collections if p is not None), default=None)
        if (
            takes
            and collection is not None
            and len(targets) >= 2
            and piece.piece_type != chess.KING
            and not targets <= effective_attacks(before, move.from_square)
        ):
            found.append(
                DefenseHypothesis(
                    kind="fork_capture",
                    root_analysis_id=analysis_id,
                    at_ply=ply,
                    root_moves=takes,
                    plies=[ply, collection],
                    target=boards[collection].peek().to_square,
                    attacker=move.to_square,
                    direction=direction,
                    roles={"attacker": names([move.to_square]), "targets": names(sorted(targets))},
                )
            )

        for target in targets - effective_attacks(before, move.from_square):
            victim = after.piece_at(target)
            collection = piece_capture_ply(boards, target, ply, min(end, first + max_plies - 1))
            if collection is None or victim.piece_type == chess.KING:
                continue
            for slider, rear in relative_pinners(after, target):
                if not all(
                    b.piece_at(target) == victim and (slider, rear) in relative_pinners(b, target)
                    for b in boards[ply:collection]
                ):
                    continue
                escapes = [m for m in after.legal_moves if m.from_square == target]
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
                    found.append(
                        DefenseHypothesis(
                            kind="relative_pin_escape",
                            root_analysis_id=analysis_id,
                            at_ply=ply,
                            root_moves=sorted(exposed),
                            plies=[ply, collection],
                            target=target,
                            attacker=slider,
                            rear=rear,
                            direction=direction,
                            roles={
                                "attacker": names([slider, move.to_square]),
                                "target": names([target, rear]),
                            },
                        )
                    )

        if before.is_capture(move):
            for recapture in after.legal_moves:
                if recapture.to_square != move.to_square or not after.is_capture(recapture):
                    continue
                defender = before.piece_at(recapture.from_square)
                if defender is None or defender.piece_type == chess.KING:
                    continue
                for slider in before.attackers(actor, recapture.from_square):
                    slider_piece = before.piece_at(slider)
                    if slider_piece.piece_type not in {chess.BISHOP, chess.ROOK, chess.QUEEN}:
                        continue
                    for rear, rear_piece in before.piece_map().items():
                        if (
                            rear_piece.color == actor
                            or rear_piece.piece_type == chess.KING
                            or VALUES[rear_piece.piece_type] <= VALUES[defender.piece_type]
                        ):
                            continue
                        between = chess.SquareSet(chess.between(slider, rear))
                        if recapture.from_square not in between or set(
                            between & before.occupied
                        ) != {recapture.from_square}:
                            continue
                        branch = after.copy()
                        branch.push(recapture)
                        collect = chess.Move(slider, rear)
                        if collect not in branch.legal_moves or not branch.is_capture(collect):
                            continue
                        found.append(
                            DefenseHypothesis(
                                kind="relative_pin",
                                root_analysis_id=analysis_id,
                                at_ply=ply,
                                root_moves=[recapture.uci()],
                                plies=[ply],
                                target=move.to_square,
                                attacker=slider,
                                rear=rear,
                                direction=direction,
                                roles={
                                    "attacker": names([slider]),
                                    "target": names([move.to_square, rear]),
                                    "pinned_defender": names([recapture.from_square]),
                                },
                            )
                        )

        if ply + 2 not in plies or after.is_check():
            continue
        reply, collect = boards[ply + 1].peek(), boards[ply + 2].peek()
        target = reply.from_square if collect.to_square == reply.to_square else collect.to_square
        victim = after.piece_at(target)
        if (
            victim is None
            or victim.color == actor
            or victim.piece_type in {chess.PAWN, chess.KING}
            or target not in valuable_targets(after, move.to_square)
            or not boards[ply + 1].is_capture(collect)
        ):
            continue
        escapes = [m for m in after.legal_moves if m.from_square == target]
        if not escapes:
            continue  # Absolute pins/check evasions are not automatically trapped pieces.
        all_capturable = True
        for escape in escapes:
            escaped = after.copy()
            escaped.push(escape)
            if not any(
                m.to_square == escape.to_square and escaped.is_capture(m)
                for m in escaped.legal_moves
            ):
                all_capturable = False
                break
        if all_capturable:
            found.append(
                DefenseHypothesis(
                    kind="trapped_piece",
                    root_analysis_id=analysis_id,
                    at_ply=ply,
                    root_moves=sorted(m.uci() for m in escapes),
                    plies=[ply, ply + 2],
                    target=target,
                    attacker=move.to_square,
                    direction=direction,
                    roles={"attacker": names([move.to_square]), "target": names([target])},
                )
            )
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
        raise ValueError("Defensive probe does not match its hypothesis or legal position")
    candidate = Candidate.model_validate(probe["candidate"])
    if candidate.uci not in request.root_moves:
        raise ValueError("Defensive probe contains an unrequested move")
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
