"""Objective and witnessed event rules; each retains its source authority."""

import chess

from trainer.chess_core import Score, evaluation_loss


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
            expected = ("black" if actor == "white" else "white") if role == "allowed" else actor
            if finding["actor"] != expected:
                continue
            emit(
                "tactic",
                "line_witness",
                75 if role in {"allowed", "missed"} else 65,
                {
                    "motif": finding["skill_id"],
                    "role": role,
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
