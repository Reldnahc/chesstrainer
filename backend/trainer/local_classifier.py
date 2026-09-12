"""Conservative findings from saved engine lines; no model or network calls.

Rules describe observable consequences, not a learner's thought process. A PV
is one engine continuation, not proof that every reply is forced.
"""

import chess

from trainer.chess_core import (
    Candidate,
    evaluation_loss,
    position_key,
    valid_board,
)
from trainer.continuations import continuation_end, replay, settled_delta  # noqa: F401
from trainer.diagnosis_types import CUES, OUTCOME_SKILLS, Finding, Outcome
from trainer.move_causes import move_causes
from trainer.tactical_patterns import detect_patterns

RULE_VERSION = "3"


class LocalClassifier:
    provider = "local_rules"
    version = RULE_VERSION
    model = "local-rules"  # Retained audit column; no model is loaded.

    def __init__(self, settings=None):
        self.parameters = {
            "max_plies": settings.classification_max_plies if settings else 16,
            "extension_plies": settings.classification_extension_plies if settings else 16,
            "tactic_plies": settings.classification_tactic_plies if settings else 8,
            "min_loss_cp": settings.classification_min_loss_cp if settings else 150,
            "min_material": settings.classification_min_material if settings else 1,
        }

    def classify(self, evidence):
        from trainer.classification import Classification

        board = valid_board(evidence["fen"])
        if any(
            position_key(valid_board(fen)) != position_key(board)
            for fen in evidence.get("analysis_fens", [])
        ):
            raise ValueError("Analysis belongs to a different position")
        best = Candidate.model_validate(evidence["best_candidates"][0])
        actual = Candidate.model_validate(evidence["played_candidate"])
        if actual.uci != evidence["user_move"]["uci"]:
            raise ValueError("Actual analysis does not match learner move")
        best_boards, actual_boards = replay(board, best), replay(board, actual)
        loss = evaluation_loss(best.score, actual.score)
        found = []
        outcomes = []
        reasons = []
        learner = board.turn

        def add(skill, direction, analysis, boards, plies, squares, explanation, mate=False):
            actor = learner if direction == "missed_opportunity" else not learner
            found.append(
                Finding(
                    skill_id=skill,
                    cue=CUES.get(skill, ""),
                    frame_ply=plies[0],
                    rule_id=f"{skill}:{RULE_VERSION}",
                    direction=direction,
                    actor="white" if actor else "black",
                    analysis_id=analysis,
                    plies=plies,
                    squares=sorted(set(squares)),
                    moves=[boards[p].peek().uci() for p in plies],
                    explanation=explanation,
                    verification="engine_mate" if mate else "verified_line",
                )
            )

        best_id, actual_id = evidence["evidence_ids"]
        if loss.allows_mate:
            add(
                "allowed_mate",
                "allowed_opponent_tactic",
                actual_id,
                actual_boards,
                [1],
                [],
                f"After {board.san(chess.Move.from_uci(actual.uci))}, Stockfish finds a forced mate for the opponent; the saved best alternative avoids it at these analysis limits.",
                True,
            )
        if loss.mate_lost:
            add(
                "missed_mate",
                "missed_opportunity",
                best_id,
                best_boards,
                [1],
                [],
                f"Stockfish finds a forced mate beginning with {board.san(chess.Move.from_uci(best.uci))}; your move gives up that mate at the saved analysis limits.",
                True,
            )

        limit = self.parameters["max_plies"]
        threshold = self.parameters["min_loss_cp"]
        material_threshold = self.parameters["min_material"]
        endpoints = {
            analysis: continuation_end(boards, learner, limit, self.parameters["extension_plies"])
            for analysis, boards in ((best_id, best_boards), (actual_id, actual_boards))
        }
        best_delta = endpoints[best_id].material_delta
        actual_delta = endpoints[actual_id].material_delta
        for direction, candidate, boards, analysis_id, first in (
            ("allowed_opponent_tactic", actual, actual_boards, actual_id, 2),
            ("missed_opportunity", best, best_boards, best_id, 1),
        ):
            if len(boards) <= first:
                continue
            endpoint = endpoints[analysis_id]
            delta, end = endpoint.material_delta, endpoint.end_ply
            # Require adverse engine outcome AND a material consequence avoided
            # by the alternative. Geometry or a centipawn drop alone is insufficient.
            supports = (
                delta is not None
                and loss.cp is not None
                and loss.cp >= threshold
                and candidate.score.kind == "cp"
                and (
                    (
                        first == 2
                        and delta <= -material_threshold
                        and best_delta is not None
                        and best_delta - delta >= material_threshold
                    )
                    or (
                        first == 1
                        and delta >= material_threshold
                        and actual_delta is not None
                        and delta - actual_delta >= material_threshold
                    )
                )
            )
            after = boards[first]
            move = after.peek()
            squares = [chess.square_name(move.from_square), chess.square_name(move.to_square)]
            if supports:
                amount = abs(delta)
                outcomes.append(
                    Outcome(
                        kind="material_loss" if first == 2 else "missed_material_gain",
                        analysis_id=analysis_id,
                        end_ply=end,
                        material_points=amount,
                        explanation=f"In the saved line you {'lose' if first == 2 else 'gain'} {amount} material points; the alternative line differs by {best_delta - actual_delta} points.",
                    )
                )
                add(
                    "material_loss" if first == 2 else "missed_material_gain",
                    direction,
                    analysis_id,
                    boards,
                    list(range(1, end + 1)),
                    squares,
                    f"The saved continuation {'loses' if first == 2 else 'gains'} {amount} material points for you within {end} plies. This describes the engine line, not every possible reply.",
                )
            mate_support = loss.allows_mate if first == 2 else loss.mate_lost
            if first == 2 and supports:
                found.extend(move_causes(boards, analysis_id, evidence.get("previous_move")))
            found.extend(
                detect_patterns(
                    boards,
                    first,
                    min(len(boards) - 1, limit) if mate_support else end,
                    analysis_id,
                    direction,
                    material_supported=supports,
                    mate_supported=mate_support,
                    max_tactic_plies=self.parameters["tactic_plies"],
                )
            )

        for finding in found:
            if finding.skill_id in {"allowed_mate", "missed_mate"}:
                outcomes.append(
                    Outcome(
                        kind=finding.skill_id,
                        analysis_id=finding.analysis_id,
                        end_ply=1,
                        explanation=finding.explanation,
                    )
                )
        if best_delta is None or actual_delta is None:
            reasons.append("continuation_unsettled")
        if not outcomes:
            reasons.append("no_verified_material_or_mate_outcome")
        if not any(f.skill_id not in OUTCOME_SKILLS for f in found):
            reasons.append("mechanism_unclassified")
        skills = list(dict.fromkeys(f.skill_id for f in found))
        return Classification(
            decision_id=evidence["decision_id"],
            findings=found,
            outcomes=outcomes,
            abstention_reasons=reasons,
            parameters=self.parameters,
            continuations=endpoints,
            primary_skill=skills[0] if skills else "unclassified",
            secondary_skills=skills[1:],
            confidence=1.0 if skills else 0.0,
            explanation=" ".join(f.explanation for f in found)
            or "The engine found a meaningful difference, but the saved lines do not establish a specific material or mating consequence.",
        ), {}
