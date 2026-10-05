"""Objective and witnessed event rules; each retains its source authority."""

import chess

from trainer.chess_core import Score, evaluation_loss

MOVER_CAUSES = {"abandoned_defender", "opponent_threat_recognition", "avoiding_bad_trades"}


def advantage(score):
    if score.kind == "mate":
        return "forced_win" if score.outcome() == 1 else "forced_loss"
    return (
        "advantage"
        if score.value >= 200
        else "disadvantage"
        if score.value <= -200
        else "balanced"
        if abs(score.value) <= 100
        else "edge"
    )


def forced_mate_stage(best, actual, previous):
    """A move inside a forced mate that neither allows nor misses it.

    Scores count the mover's moves until mate, so mate 2 means the mover's next
    move mates whatever the reply. A delivered mate (mate 1) is the finish event.
    The previous score is the mover's view before the opponent's last move.
    """
    if actual.kind != "mate" or actual.value in (0, 1) or best.kind != "mate":
        return None
    if actual.outcome() == 1:
        if best.outcome() == 1 and best.value < actual.value:
            return "slower"
        if actual.value == 2:
            return "next"
        earlier = Score.model_validate(previous) if previous else None
        return "continued" if earlier and earlier.kind == "mate" and earlier.outcome() == 1 else "started"
    # Already lost: the best defence was mated too.
    return "hastened" if abs(actual.value) < abs(best.value) else "held"


def objective_events(report, practical, emit, evidence, ref):
    best = Score.model_validate(report["best"]["score"])
    actual = Score.model_validate(report["actual"]["score"])
    loss = evaluation_loss(best, actual)
    near = not (loss.allows_mate or loss.mate_lost) and (loss.cp or 0) <= 20
    if loss.allows_mate or loss.mate_lost:
        emit(
            "mate",
            "searched",
            95,
            {
                "transition": "allowed" if loss.allows_mate else "missed",
                "best": best.model_dump(),
                "actual": actual.model_dump(),
                # Moves until the mate lands; 1 means the reply itself mates.
                "mate_in": abs(actual.value) if actual.kind == "mate" else None,
            },
            evidence,
        )
    elif stage := forced_mate_stage(best, actual, report.get("previous_score")):
        emit(
            "forced_mate",
            "searched",
            95,
            {
                "stage": stage,
                "winner": "mover" if actual.outcome() == 1 else "opponent",
                "mate_in": abs(actual.value),
                "best": best.model_dump(),
                "actual": actual.model_dump(),
            },
            evidence,
        )
    if (loss.cp or 0) >= 100 or advantage(best) != advantage(actual):
        emit(
            "evaluation_change",
            "searched",
            80,
            {
                "from_band": advantage(best),
                "to_band": advantage(actual),
                "loss_cp": loss.cp,
                "lost_advantage": advantage(best) in {"advantage", "forced_win"}
                and advantage(actual) not in {"advantage", "forced_win"},
                "decisive": best.kind == actual.kind == "cp"
                and best.value >= -50
                and actual.value <= -200,
            },
            evidence,
        )
    if near and report["legal_count"] > 1 and practical.components.only_good_move_at_depth:
        emit(
            "critical_resource",
            "searched",
            85,
            {
                "only_good_at_depth": report["depth"],
                "difficult": practical.best_find_difficulty == "difficult",
                "purpose": "defense"
                if best.kind == "cp" and best.value <= 150
                else "decisive_resource",
            },
            evidence + [ref("rule", practical.version, practical.input_digest)],
        )
    sacrifice = report.get("sacrifice")
    if (
        not (loss.allows_mate or loss.mate_lost)
        and (loss.cp or 0) < 50
        and sacrifice
        and sacrifice.get("analysis_id")
    ):
        emit(
            "sacrifice",
            "searched",
            90,
            {
                "acceptance_move": sacrifice["capture"],
                "acceptance_score": sacrifice["score"],
                "sound_at_depth": report["depth"],
            },
            evidence + [ref("stockfish", sacrifice["analysis_id"], "acceptance_search")],
        )


def tactical_events(report, emit, ref, fen, actor):
    loss = evaluation_loss(
        Score.model_validate(report["best"]["score"]),
        Score.model_validate(report["actual"]["score"]),
    )
    poor = loss.allows_mate or loss.mate_lost or (loss.cp or 0) >= 50
    opponent = "black" if actor == "white" else "white"
    for source in ("actual", "best"):
        if source == "best" and report["best"]["uci"] == report["actual"]["uci"]:
            continue
        line = report.get(f"{source}_line", {})
        frames = line.get("frames", [])
        if len(frames) < 2 or frames[0]["fen"] != fen or frames[1]["uci"] != report[source]["uci"]:
            continue
        for index, finding in enumerate(line.get("findings", [])):
            analysis_id = report[
                "played_analysis_id" if source == "actual" else "before_analysis_id"
            ]
            if (
                not finding.get("plies")
                or min(finding["plies"]) < 1
                or max(finding["plies"]) >= len(frames)
                or not 0 <= finding["frame_ply"] < len(frames)
                or finding["analysis_id"] != analysis_id
            ):
                continue
            role = (
                "allowed"
                if source == "actual" and poor
                else "played"
                if source == "actual"
                else "missed"
                if poor
                else "alternative"
            )
            # These witnesses begin with the mover's error, then the opponent's
            # capture. Their actor remains the responsible mover, not the beneficiary.
            causal = finding["skill_id"] in MOVER_CAUSES
            if causal:
                if (
                    role != "allowed"
                    or finding.get("direction") != "allowed_opponent_tactic"
                    or finding["plies"] != [1, 2]
                    or finding["frame_ply"] != 0
                    or finding["moves"] != [frames[p]["uci"] for p in (1, 2)]
                ):
                    continue
                role = "caused"
            expected = opponent if role == "allowed" else actor
            if finding["actor"] != expected:
                continue
            # The played move's own line may not witness the capture (the target
            # escapes with tempo), yet the move still uncovers an attack. It did
            # not miss the idea, it chose a weaker version of it.
            if (
                role == "missed"
                and finding["skill_id"] == "discovered_attack"
                and uncovers_attack(fen, report["actual"]["uci"])
            ):
                continue
            emit(
                "tactic",
                "line_witness",
                75 if role in {"allowed", "caused", "missed"} else 65,
                {
                    "motif": finding["skill_id"],
                    "role": role,
                    **({"opportunity_actor": opponent} if causal else {}),
                    "rule_id": finding["rule_id"],
                    "frame_ply": finding["frame_ply"],
                    "plies": finding["plies"],
                    "moves": finding["moves"],
                    "squares": finding["squares"],
                    "roles": finding["roles"],
                    "verification": finding["verification"],
                    "context_fen": finding.get("context_fen"),
                    "context_move": finding.get("context_move"),
                    "witness": [
                        {
                            "ply": ply,
                            "san": frames[ply]["san"],
                            "capture": frames[ply].get("capture"),
                            "gives_check": frames[ply].get("gives_check", False),
                        }
                        for ply in finding["plies"]
                    ],
                    "pieces": witness_pieces(frames, finding),
                    "settled_material_delta": (
                        line.get("material_delta") * (-1 if role == "allowed" else 1)
                        if line.get("settled") and line.get("material_delta") is not None
                        else None
                    ),
                },
                [
                    ref("stockfish", finding["analysis_id"], f"{source}_line/findings/{index}"),
                    ref("rule", finding["rule_id"], "verified_witness"),
                    *(
                        ref("stockfish", identifier, "defense_verification")
                        for identifier in finding.get("verification_analysis_ids", [])
                    ),
                ],
                mover=finding["actor"],
            )


def uncovers_attack(fen, uci):
    """Moving off a line lets the mover's own long-range piece attack an enemy
    piece (a pawn is too small to count) or give check."""
    board = chess.Board(fen)
    move = chess.Move.from_uci(uci)
    if not board.is_legal(move):
        return False
    actor = board.turn
    board.push(move)
    for kind in (chess.BISHOP, chess.ROOK, chess.QUEEN):
        for square in board.pieces(kind, actor):
            if square == move.to_square:
                continue
            for target in board.attacks(square):
                piece = board.piece_at(target)
                if (
                    piece
                    and piece.color != actor
                    and piece.piece_type != chess.PAWN
                    and move.from_square in chess.SquareSet.between(square, target)
                ):
                    return True
    return False


def witness_pieces(frames, finding):
    """Describe visible role pieces, without guessing what was captured later."""
    board = chess.Board(frames[finding["frame_ply"]]["fen"])
    return {
        square: {
            "piece": chess.piece_name(piece.piece_type),
            "color": "white" if piece.color else "black",
        }
        for square in finding["squares"]
        if (piece := board.piece_at(chess.parse_square(square))) is not None
    }
