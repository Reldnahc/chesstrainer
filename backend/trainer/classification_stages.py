"""Evidence validation, outcome admission and defense checks for local classification."""

from dataclasses import dataclass, field

import chess

from trainer.chess_core import Candidate, Loss, evaluation_loss, position_key, valid_board
from trainer.continuations import ContinuationEnd, continuation_end, extended_line
from trainer.defensive_probes import hypotheses, verify_defense
from trainer.diagnosis_types import CUES, OUTCOME_SKILLS, RULE_VERSION, Finding, Outcome
from trainer.move_causes import move_causes
from trainer.tactical_patterns import detect_patterns


@dataclass(frozen=True)
class EvidenceLine:
    candidate: Candidate
    boards: list[chess.Board]
    analysis_id: str
    direction: str
    first: int
    endpoint: ContinuationEnd

    def finding(self, skill, plies, squares, explanation, *, mate=False):
        learner = self.boards[0].turn
        actor = learner if self.direction == "missed_opportunity" else not learner
        return Finding(
            skill_id=skill,
            cue=CUES.get(skill, ""),
            frame_ply=plies[0],
            rule_id=f"{skill}:{RULE_VERSION}",
            direction=self.direction,
            actor="white" if actor else "black",
            analysis_id=self.analysis_id,
            plies=plies,
            squares=sorted(set(squares)),
            moves=[self.boards[p].peek().uci() for p in plies],
            explanation=explanation,
            verification="engine_mate" if mate else "verified_line",
        )


@dataclass
class LineDiagnosis:
    findings: list[Finding] = field(default_factory=list)
    outcomes: list[Outcome] = field(default_factory=list)
    defense_checks: list[dict] = field(default_factory=list)


def read_lines(evidence, parameters) -> tuple[EvidenceLine, EvidenceLine, Loss]:
    """Validate root identity and legally join only explicitly linked saved tails."""
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
    best_id, actual_id = evidence["evidence_ids"]
    probes = evidence.get("probes", [])

    def line(candidate, analysis_id, direction, first):
        candidate, boards = extended_line(board, candidate, analysis_id, probes)
        return EvidenceLine(
            candidate,
            boards,
            analysis_id,
            direction,
            first,
            continuation_end(
                boards, board.turn, parameters["max_plies"], parameters["extension_plies"]
            ),
        )

    return (
        line(best, best_id, "missed_opportunity", 1),
        line(actual, actual_id, "allowed_opponent_tactic", 2),
        evaluation_loss(best.score, actual.score),
    )


def mate_findings(best: EvidenceLine, actual: EvidenceLine, loss: Loss) -> list[Finding]:
    found = []
    if loss.allows_mate:
        found.append(
            actual.finding(
                "allowed_mate",
                [1],
                [],
                f"After {actual.boards[0].san(chess.Move.from_uci(actual.candidate.uci))}, Stockfish finds a forced mate for the opponent; the saved best alternative avoids it at these analysis limits.",
                mate=True,
            )
        )
    if loss.mate_lost:
        found.append(
            best.finding(
                "missed_mate",
                [1],
                [],
                f"Stockfish finds a forced mate beginning with {best.boards[0].san(chess.Move.from_uci(best.candidate.uci))}; your move gives up that mate at the saved analysis limits.",
                mate=True,
            )
        )
    return found


def supports_material(
    line: EvidenceLine, alternative: EvidenceLine, loss: Loss, parameters
) -> bool:
    """Require an adverse score AND a settled consequence avoided by the alternative."""
    delta, other_delta = line.endpoint.material_delta, alternative.endpoint.material_delta
    if (
        delta is None
        or other_delta is None
        or loss.cp is None
        or loss.cp < parameters["min_loss_cp"]
        or line.candidate.score.kind != "cp"
    ):
        return False
    threshold = parameters["min_material"]
    if line.first == 2:
        return delta <= -threshold and other_delta - delta >= threshold
    return delta >= threshold and delta - other_delta >= threshold


def material_consequence(line: EvidenceLine, alternative: EvidenceLine) -> tuple[Finding, Outcome]:
    delta, end = line.endpoint.material_delta, line.endpoint.end_ply
    amount = abs(delta)
    lost = line.first == 2
    difference = (
        alternative.endpoint.material_delta - delta
        if lost
        else delta - alternative.endpoint.material_delta
    )
    move = line.boards[line.first].peek()
    skill = "material_loss" if lost else "missed_material_gain"
    outcome = Outcome(
        kind=skill,
        analysis_id=line.analysis_id,
        end_ply=end,
        material_points=amount,
        explanation=f"In the saved line you {'lose' if lost else 'gain'} {amount} material points; the alternative line differs by {difference} points.",
    )
    finding = line.finding(
        skill,
        list(range(1, end + 1)),
        [chess.square_name(move.from_square), chess.square_name(move.to_square)],
        f"The saved continuation {'loses' if lost else 'gains'} {amount} material points for you within {end} plies. This describes the engine line, not every possible reply.",
    )
    return finding, outcome


def defensive_findings(line: EvidenceLine, probes, parameters, outcome_supported) -> LineDiagnosis:
    result = LineDiagnosis()
    for hypothesis in hypotheses(
        line.boards,
        line.first,
        line.endpoint.end_ply,
        line.analysis_id,
        line.direction,
        parameters["tactic_plies"],
    ):
        probe = next((p for p in probes if p["query_key"] == hypothesis.key), None)
        finding, status = (
            (None, "pending")
            if probe is None
            else verify_defense(hypothesis, line.boards, line.candidate, probe, parameters)
        )
        if finding and outcome_supported:
            result.findings.append(finding)
        elif finding:
            status = "outcome_unverified"
        result.defense_checks.append(
            {
                "hypothesis_key": hypothesis.key,
                "kind": hypothesis.kind,
                "root_analysis_id": line.analysis_id,
                "at_ply": hypothesis.at_ply,
                "root_moves": hypothesis.root_moves,
                "status": status,
                "analysis_id": probe["analysis_id"] if probe else None,
            }
        )
    return result


def diagnose_line(
    line: EvidenceLine, alternative: EvidenceLine, loss: Loss, evidence, parameters
) -> LineDiagnosis:
    result = LineDiagnosis()
    if len(line.boards) <= line.first:
        return result
    supports = supports_material(line, alternative, loss, parameters)
    mate_support = loss.allows_mate if line.first == 2 else loss.mate_lost
    if supports:
        finding, outcome = material_consequence(line, alternative)
        result.findings.append(finding)
        result.outcomes.append(outcome)
    if line.first == 2 and supports:
        result.findings.extend(
            move_causes(line.boards, line.analysis_id, evidence.get("previous_move"))
        )
    result.findings.extend(
        detect_patterns(
            line.boards,
            line.first,
            min(len(line.boards) - 1, parameters["max_plies"])
            if mate_support
            else line.endpoint.end_ply,
            line.analysis_id,
            line.direction,
            material_supported=supports,
            mate_supported=mate_support,
            max_tactic_plies=parameters["tactic_plies"],
            previous_move=evidence.get("previous_move") if line.first == 1 else None,
        )
    )
    defense = defensive_findings(
        line, evidence.get("probes", []), parameters, supports or mate_support
    )
    result.findings.extend(defense.findings)
    result.defense_checks.extend(defense.defense_checks)
    return result


def attach_provenance(found, outcomes, probes):
    """Only tails actually traversed by a witness can support that finding/outcome."""

    def supporting(analysis_id, end):
        return [
            p["analysis_id"]
            for p in probes
            if p["kind"] == "tail" and p["root_analysis_id"] == analysis_id and end > p["at_ply"]
        ]

    for finding in found:
        finding.verification_analysis_ids.extend(
            supporting(finding.analysis_id, max(finding.plies))
        )
        if finding.skill_id in {"allowed_mate", "missed_mate"}:
            outcomes.append(
                Outcome(
                    kind=finding.skill_id,
                    analysis_id=finding.analysis_id,
                    end_ply=1,
                    explanation=finding.explanation,
                )
            )
    for outcome in outcomes:
        outcome.supporting_analysis_ids = supporting(outcome.analysis_id, outcome.end_ply)


def abstention_reasons(best, actual, found, outcomes, defense_checks):
    reasons = []
    if best.endpoint.material_delta is None or actual.endpoint.material_delta is None:
        reasons.append("continuation_unsettled")
    if any(check["status"] == "pending" for check in defense_checks):
        reasons.append("defense_probe_pending")
    if not outcomes:
        reasons.append("no_verified_material_or_mate_outcome")
    if not any(f.skill_id not in OUTCOME_SKILLS for f in found):
        reasons.append("mechanism_unclassified")
    return reasons
