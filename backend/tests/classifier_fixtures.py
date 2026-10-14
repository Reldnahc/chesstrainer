"""Test classifiers: fixed labels with the minimal findings validation requires."""

from trainer.diagnosis_types import Finding


class FixtureClassifierBase:
    provider = "test"
    version = "fixture"
    parameters: dict = {}


def findings_for(evidence, *skills):
    """One finding per label, tied to the played-move evidence the classifier was given."""
    return [
        Finding(
            skill_id=skill,
            rule_id=f"{skill}:fixture",
            direction="allowed_opponent_tactic",
            actor="white",
            analysis_id=evidence["evidence_ids"][1],
            plies=[1],
            squares=[],
            moves=[evidence["user_move"]["uci"]],
            explanation="Fixture finding.",
            verification="verified_line",
        )
        for skill in skills
    ]
