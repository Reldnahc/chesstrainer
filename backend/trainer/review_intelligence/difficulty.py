"""Conservative practical signals. Model rarity is neither move quality nor mind reading."""

from trainer.chess_core import Score, digest, evaluation_loss
from trainer.human_models.types import HumanEvidence
from trainer.review_intelligence.types import (
    PRACTICAL_VERSION,
    DifficultyComponents,
    PracticalAssessment,
)
from trainer.review_scores import is_near_best, is_only_good, is_poor, strongest_alternative

VERSION = PRACTICAL_VERSION
# Coarse gates inspected on the fixed 12-position × 4-rating probe (see docs).
# These are model-policy descriptions, not calibrated human success rates.
PREFERRED_POLICY = 0.10
UNUSUAL_POLICY = 0.03
TOP_CHOICES = 3


def naturalness(move):
    if move is None:
        return "unknown"
    if move.probability is None:
        # A top-N provider does not establish a frequency or the unseen tail.
        return "preferred" if move.rank == 1 else "plausible"
    if move.rank <= 3 and move.probability >= PREFERRED_POLICY:
        return "preferred"
    if move.rank >= 7 and move.probability < UNUSUAL_POLICY:
        return "unusual"
    return "plausible"


def root_comparison(report):
    best = Score.model_validate(report["best"]["score"])
    second = strongest_alternative(report)
    legal_count = report["legal_count"]
    if legal_count == 1:
        return None, 1, True, False
    if second is None:
        return None, 1, False, None
    gap = evaluation_loss(best, second)
    acceptable = not (gap.mate_lost or gap.allows_mate) and (gap.cp or 0) <= 50
    roots = report.get("root_candidates") or []
    observed = 1 + int(acceptable)
    if roots:
        roots = list(roots)
        if report["actual"]["uci"] not in {row["uci"] for row in roots}:
            roots.append(report["actual"])
        observed = sum(
            not (distance.mate_lost or distance.allows_mate) and (distance.cp or 0) <= 50
            for distance in (
                evaluation_loss(best, Score.model_validate(row["score"])) for row in roots
            )
        )
    # "Only good" means the runner-up actually loses, not merely that it misses
    # a forced mate while retaining a healthy advantage. Scope is saved search depth.
    narrow = is_only_good(best, second)
    return gap.cp, observed, legal_count <= max(2, len(roots)), bool(narrow)


def witness_structure(report):
    line = report.get("best_line", {})
    horizon = max((max(f["plies"], default=0) for f in line.get("findings", [])), default=0)
    forcing = 0
    for frame in line.get("frames", [])[1:7]:
        if not (frame.get("gives_check") or frame.get("capture")):
            break
        forcing += 1
    return forcing, horizon


# Report fields that decide the assessment; their digest keys the saved result.
DIGESTED_FIELDS = (
    "best",
    "actual",
    "second_score",
    "root_candidates",
    "legal_count",
    "sacrifice",
    "human",
    "before_analysis_id",
    "played_analysis_id",
)


def assessment_digest(report, forcing, horizon):
    return digest(
        {
            "version": VERSION,
            "report": {key: report.get(key) for key in DIGESTED_FIELDS},
            "forcing_plies": forcing,
            "supported_horizon": horizon,
        }
    )


def mate_transition(loss):
    if loss.allows_mate:
        return "allowed"
    return "missed" if loss.mate_lost else "none"


def matched_human(report, limitations):
    """Available human evidence for exactly this move, or None with the reason noted."""
    if not report.get("human"):
        return None
    try:
        candidate = HumanEvidence.model_validate(report["human"])
        if candidate.status != "available":
            return None
        mismatched = (
            candidate.legal_count != report["legal_count"]
            or candidate.played is not None
            and candidate.played.uci != report["actual"]["uci"]
            or candidate.engine_best is not None
            and candidate.engine_best.uci != report["best"]["uci"]
        )
        if mismatched:
            limitations.append("human_move_context_mismatch")
            return None
        return candidate
    except ValueError:
        limitations.append("incompatible_human_evidence")
        return None


def policy_limitations(human):
    """Why this game sits outside the conditions the policy gates were inspected on."""
    limiting = []
    if human.domain.alignment != "related":
        limiting.append("domain_shift" if human.domain.alignment == "shifted" else "domain_unknown")
    if not human.domain.history_from_start:
        limiting.append("pre_setup_history_unknown")
    if "fallback" in (human.conditioning.self_source, human.conditioning.opponent_source):
        limiting.append("rating_fallback")
    if not (
        600 <= human.conditioning.self_rating <= 2400
        and 800 <= human.conditioning.opponent_rating <= 2600
    ):
        limiting.append("outside_probed_rating_range")
    if human.engine_best is None or human.engine_best.probability is None:
        limiting.append("incomplete_policy")
    return limiting


def policy_components(human):
    best, played = human.engine_best, human.played
    return {
        "best_rank": best.rank if best else None,
        "best_probability": best.probability if best else None,
        "played_rank": played.rank if played else None,
        "played_probability": played.probability if played else None,
        "normalized_entropy": human.normalized_entropy,
        "top_three_mass": human.top_three_mass,
    }


def best_find_difficulty(report, human, nature, narrow, horizon):
    # A best move among the model's top three choices is not a hard find, even in
    # a diffuse policy where no move reaches the preferred probability.
    if nature == "preferred" or (human.engine_best and human.engine_best.rank <= TOP_CHOICES):
        return "natural"
    if nature == "unknown":
        return "unknown"
    best_sacrifice = report.get("sacrifice") and report["best"]["uci"] == report["actual"]["uci"]
    corroborated = narrow or bool(best_sacrifice) or horizon >= 3
    return "difficult" if nature == "unusual" and corroborated else "challenging"


def policy_interpretations(loss, played, narrow):
    poor, strong = is_poor(loss), is_near_best(loss)
    interpretations = []
    if poor and played == "preferred":
        interpretations.append("natural_error")
    if strong and played == "unusual":
        interpretations.append("unusual_strong_move")
    if strong and played == "preferred":
        interpretations.append("natural_best")
    if strong and narrow and played == "unusual":
        interpretations.append("hard_to_find_defense")
    return interpretations


def apply_human_policy(base, report, human, loss, narrow, horizon):
    """Record the policy's view of both moves in `base`; returns its interpretations."""
    base["human_evidence_id"] = human.evidence_id
    base["played_naturalness"] = naturalness(human.played)
    base["best_naturalness"] = naturalness(human.engine_best)
    limiting = policy_limitations(human)
    base["confidence"] = "limited" if limiting else "heuristic"
    base["limitations"].extend(limiting)
    base["components"] = base["components"].model_copy(update=policy_components(human))
    base["best_find_difficulty"] = best_find_difficulty(
        report, human, base["best_naturalness"], narrow, horizon
    )
    return policy_interpretations(loss, base["played_naturalness"], narrow)


def assess_difficulty(report):
    best, actual = (Score.model_validate(report[key]["score"]) for key in ("best", "actual"))
    loss = evaluation_loss(best, actual)
    gap, acceptable, complete, narrow = root_comparison(report)
    forcing, horizon = witness_structure(report)
    base = dict(
        version=VERSION,
        input_digest=assessment_digest(report, forcing, horizon),
        stockfish_analysis_ids=list(
            dict.fromkeys(
                report[key]
                for key in ("before_analysis_id", "played_analysis_id")
                if report.get(key)
            )
        ),
        components=DifficultyComponents(
            candidate_gap_cp=gap,
            acceptable_count_lower_bound=acceptable,
            alternatives_complete=complete,
            only_good_move_at_depth=narrow,
            best_forcing_plies=forcing,
            best_supported_horizon=horizon,
            verified_sacrifice=bool(report.get("sacrifice")),
            mate_transition=mate_transition(loss),
        ),
        human_evidence_id=None,
        played_naturalness="unknown",
        best_naturalness="unknown",
        best_find_difficulty="unknown",
        confidence="unavailable",
        limitations=["uncalibrated_population"],
    )
    interpretations = []
    if not complete:
        base["limitations"].append("acceptable_alternatives_not_exhaustive")
    human = matched_human(report, base["limitations"])
    if human:
        interpretations = apply_human_policy(base, report, human, loss, narrow, horizon)
    else:
        base["limitations"].append("human_evidence_unavailable")
    if loss.mate_lost and best.value == 1:
        interpretations.append("immediate_mate_missed")
    if report["legal_count"] == 1:
        base["best_find_difficulty"] = "forced"
        base["confidence"] = "structural"
        interpretations = ["forced_reply"]
    return PracticalAssessment(**base, interpretations=interpretations)
