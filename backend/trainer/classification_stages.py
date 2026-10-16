"""Evidence validation, outcome admission and defense checks for local classification."""

from dataclasses import dataclass, field

import chess

from trainer.chess_core import Candidate, Loss, evaluation_loss, position_key, valid_board
from trainer.config import Settings
from trainer.continuations import ContinuationEnd, continuation_end, extended_line
from trainer.defensive_probes import hypotheses, verify_defense
from trainer.diagnosis_types import OUTCOME_SKILLS, RULE_VERSION, Finding, Outcome, make_finding
from trainer.errors import EvidenceIntegrityError
from trainer.move_causes import move_causes
from trainer.tactical_geometry import TACTIC_PLIES
from trainer.tactical_patterns import detect_patterns, recognized_patterns


@dataclass(frozen=True)
class EvidenceLine:
    candidate: Candidate
    boards: list[chess.Board]
    analysis_id: str
    direction: str
    first: int
    endpoint: ContinuationEnd

    def finding(self, skill, plies, squares, explanation, *, mate=False):
        # The actor is the side the outcome favours: the learner for a missed
        # opportunity, the opponent for a tactic the learner allowed.
        learner = self.boards[0].turn
        return make_finding(
            self.boards,
            skill,
            plies,
            actor=learner if self.direction == "missed_opportunity" else not learner,
            rule_id=f"{skill}:{RULE_VERSION}",
            direction=self.direction,
            analysis_id=self.analysis_id,
            frame_ply=plies[0],
            squares=sorted(set(squares)),
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
        raise EvidenceIntegrityError("Analysis belongs to a different position")
    best = Candidate.model_validate(evidence["best_candidates"][0])
    actual = Candidate.model_validate(evidence["played_candidate"])
    if actual.uci != evidence["user_move"]["uci"]:
        raise EvidenceIntegrityError("Actual analysis does not match learner move")
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


@dataclass(frozen=True)
class LineRules:
    """How a saved line is read into findings, the one rule for every reader.

    Weaknesses classification, game review, Play and the SRS "Show why"
    explanation read a line to the same horizon, with the same mate window and
    the same move before it. The horizon is the classifier's line length and
    extension (Advanced settings). Each reader keeps its own admission gates
    (the classifier also weighs the alternative line, its loss thresholds and
    probe tails); the review and the explanation also annotate recognized
    patterns and order findings for the coach.
    """

    settle_plies: int  # Where the settled material endpoint search starts.
    extension_plies: int  # How far past it an unfinished line may still settle.
    tactic_plies: int = TACTIC_PLIES  # Episode bound for the tactic detectors.
    # Review annotations also list recognized patterns up to the horizon that the
    # admitted findings lack. They bypass ``useful_cause``: an annotation describes
    # the line, it is never a grading event or a weakness label.
    annotate: bool = False
    causes_first: bool = True  # Move causes ahead of tactical findings.

    @property
    def mate_window(self) -> int:
        """Plies searched for a mating pattern when a mate supports the line."""
        return self.settle_plies

    @property
    def shown_plies(self) -> int:
        """The farthest ply any reading can reach: the end of the extension."""
        return self.settle_plies + self.extension_plies

    def shown(self, candidate, end) -> list[str]:
        """The moves to show for a line read to ``end``: through its settled (or last
        scanned) ply, where every finding and the material claim rest, or through
        the mate when the line is a forced mate, within ``shown_plies`` either way."""
        stop = len(candidate.pv) if candidate.score.kind == "mate" else end
        return candidate.pv[: min(stop, self.shown_plies)]


LINE_SETTINGS = {
    "max_plies": "classification_max_plies",
    "extension_plies": "classification_extension_plies",
    "tactic_plies": "classification_tactic_plies",
}


def line_parameters(settings=None):
    """The line horizon from the host's settings, or their defaults."""
    return {
        key: getattr(settings, name) if settings else Settings.model_fields[name].default
        for key, name in LINE_SETTINGS.items()
    }


def line_rules(parameters=None, *, annotate=False, causes_first=True):
    """The shared rule for ``parameters`` (classifier keys). ``annotate`` and
    ``causes_first`` change presentation only, never what the line is read to."""
    parameters = parameters or line_parameters()
    return LineRules(
        settle_plies=parameters["max_plies"],
        extension_plies=parameters["extension_plies"],
        tactic_plies=parameters["tactic_plies"],
        annotate=annotate,
        causes_first=causes_first,
    )


def previous_move(board):
    """The move before ``board`` as line evidence reads it, or None at the start."""
    if not board.move_stack:
        return None
    earlier = board.copy(stack=True)
    preceding = earlier.pop()
    return {"fen": earlier.fen(), "uci": preceding.uci()}


DIRECTIONS = {1: "missed_opportunity", 2: "allowed_opponent_tactic"}


def line_findings(
    boards, first, analysis_id, rules, *, end, material_supported, mate_supported, previous=None
):
    """Tactical findings and move causes in one saved line; every caller uses this.

    ``first`` is 1 for the mover's own line (an opportunity), 2 when the opponent
    replies first (a tactic the move allowed). Move causes are added only for an
    allowed tactic that the line shows costs material.
    """
    direction = DIRECTIONS[first]
    window = min(len(boards) - 1, rules.mate_window) if mate_supported else end
    found = detect_patterns(
        boards,
        first,
        window,
        analysis_id,
        direction,
        material_supported=material_supported,
        mate_supported=mate_supported,
        max_tactic_plies=rules.tactic_plies,
        previous_move=previous if first == 1 else None,
    )
    if rules.annotate:
        detailed = {finding.skill_id for finding in found}
        found.extend(
            finding
            for finding in recognized_patterns(
                boards, first, min(len(boards) - 1, rules.settle_plies), analysis_id, direction
            )
            if finding.skill_id not in detailed
        )
    if first == 2 and material_supported:
        caused = move_causes(boards, analysis_id, previous)
        found = caused + found if rules.causes_first else found + caused
    return found


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
    result.findings.extend(
        line_findings(
            line.boards,
            line.first,
            line.analysis_id,
            line_rules(parameters),
            end=line.endpoint.end_ply,
            material_supported=supports,
            mate_supported=mate_support,
            previous=evidence.get("previous_move"),
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
