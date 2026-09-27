"""Conservative practical signals. Model rarity is neither move quality nor mind reading."""

from trainer.chess_core import Score, digest, evaluation_loss
from trainer.human_models.types import HumanEvidence
from trainer.review_intelligence.types import DifficultyComponents, PracticalAssessment

VERSION = "practical-1"
# Coarse gates inspected on the fixed 12-position × 4-rating probe (see docs).
# These are model-policy descriptions, not calibrated human success rates.
PREFERRED_POLICY = 0.10
UNUSUAL_POLICY = 0.03


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
    second = report.get("second_score")
    legal_count = report["legal_count"]
    if legal_count == 1:
        return None, 1, True, False
    if second is None:
        return None, 1, False, None
    second = Score.model_validate(second)
    gap = evaluation_loss(best, second)
    acceptable = not (gap.mate_lost or gap.allows_mate) and (gap.cp or 0) <= 50
    # "Only good" means the runner-up actually loses, not merely that it misses
    # a forced mate while retaining a healthy advantage. Scope is saved search depth.
    safe_best = best.outcome() == 1 or best.kind == "cp" and best.value >= -50
    losing_second = second.outcome() == -1 or second.kind == "cp" and second.value <= -150
    narrow = (
        safe_best and losing_second and (gap.allows_mate or gap.mate_lost or (gap.cp or 0) >= 150)
    )
    return gap.cp, 1 + int(acceptable), legal_count <= 2, bool(narrow)


def witness_structure(report):
    line = report.get("best_line", {})
    horizon = max((max(f["plies"], default=0) for f in line.get("findings", [])), default=0)
    forcing = 0
    for frame in line.get("frames", [])[1:7]:
        if not (frame.get("gives_check") or frame.get("capture")):
            break
        forcing += 1
    return forcing, horizon


def assess_difficulty(report):
    best, actual = (Score.model_validate(report[key]["score"]) for key in ("best", "actual"))
    loss = evaluation_loss(best, actual)
    gap, acceptable, complete, narrow = root_comparison(report)
    forcing, horizon = witness_structure(report)
    base = dict(
        version=VERSION,
        input_digest=digest(
            {
                "version": VERSION,
                "report": {
                    key: report.get(key)
                    for key in (
                        "best",
                        "actual",
                        "second_score",
                        "legal_count",
                        "sacrifice",
                        "human",
                        "before_analysis_id",
                        "played_analysis_id",
                    )
                },
                "forcing_plies": forcing,
                "supported_horizon": horizon,
            }
        ),
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
            mate_transition="allowed"
            if loss.allows_mate
            else "missed"
            if loss.mate_lost
            else "none",
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
    human = None
    if report.get("human"):
        try:
            candidate = HumanEvidence.model_validate(report["human"])
            if candidate.status == "available":
                mismatched = (
                    candidate.legal_count != report["legal_count"]
                    or candidate.played is not None
                    and candidate.played.uci != report["actual"]["uci"]
                    or candidate.engine_best is not None
                    and candidate.engine_best.uci != report["best"]["uci"]
                )
                if mismatched:
                    base["limitations"].append("human_move_context_mismatch")
                else:
                    human = candidate
        except ValueError:
            base["limitations"].append("incompatible_human_evidence")
    if human:
        base["human_evidence_id"] = human.evidence_id
        base["played_naturalness"] = naturalness(human.played)
        base["best_naturalness"] = naturalness(human.engine_best)
        base["confidence"] = "heuristic"
        limiting = []
        if human.domain.alignment != "related":
            limiting.append(
                "domain_shift" if human.domain.alignment == "shifted" else "domain_unknown"
            )
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
        if limiting:
            base["confidence"] = "limited"
            base["limitations"].extend(limiting)
        base["components"] = base["components"].model_copy(
            update={
                "best_rank": human.engine_best.rank if human.engine_best else None,
                "best_probability": human.engine_best.probability if human.engine_best else None,
                "played_rank": human.played.rank if human.played else None,
                "played_probability": human.played.probability if human.played else None,
                "normalized_entropy": human.normalized_entropy,
                "top_three_mass": human.top_three_mass,
            }
        )
        nature = base["best_naturalness"]
        if nature == "preferred":
            base["best_find_difficulty"] = "natural"
        elif nature != "unknown":
            best_sacrifice = (
                report.get("sacrifice") and report["best"]["uci"] == report["actual"]["uci"]
            )
            corroborated = narrow or bool(best_sacrifice) or horizon >= 3
            base["best_find_difficulty"] = (
                "difficult" if nature == "unusual" and corroborated else "challenging"
            )
        poor = loss.allows_mate or loss.mate_lost or (loss.cp or 0) >= 50
        strong = not (loss.allows_mate or loss.mate_lost) and (loss.cp or 0) <= 20
        if poor and base["played_naturalness"] == "preferred":
            interpretations.append("natural_error")
        if strong and base["played_naturalness"] == "unusual":
            interpretations.append("unusual_strong_move")
        if strong and base["played_naturalness"] == "preferred":
            interpretations.append("natural_best")
        if strong and narrow and base["played_naturalness"] == "unusual":
            interpretations.append("hard_to_find_defense")
    else:
        base["limitations"].append("human_evidence_unavailable")
    if loss.mate_lost and best.value == 1:
        interpretations.append("immediate_mate_missed")
    if report["legal_count"] == 1:
        base["best_find_difficulty"] = "forced"
        base["confidence"] = "structural"
        interpretations = ["forced_reply"]
    return PracticalAssessment(**base, interpretations=interpretations)
