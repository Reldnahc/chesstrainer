"""Conservative findings from saved engine lines; no model or network calls.

Rules describe observable consequences, not a learner's thought process. A PV
is one engine continuation, not proof that every reply is forced.
"""

from trainer.classification_stages import (
    abstention_reasons,
    attach_provenance,
    diagnose_line,
    mate_findings,
    read_lines,
)
from trainer.continuations import (  # noqa: F401
    continuation_end,
    extended_line,
    replay,
    settled_delta,
)
from trainer.diagnosis_types import RULE_VERSION


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

        best, actual, loss = read_lines(evidence, self.parameters)
        found = mate_findings(best, actual, loss)
        outcomes, defense_checks = [], []
        # Stable ordering is part of primary-skill selection and saved explanations.
        for line, alternative in ((actual, best), (best, actual)):
            result = diagnose_line(line, alternative, loss, evidence, self.parameters)
            found.extend(result.findings)
            outcomes.extend(result.outcomes)
            defense_checks.extend(result.defense_checks)
        attach_provenance(found, outcomes, evidence.get("probes", []))
        skills = list(dict.fromkeys(f.skill_id for f in found))
        return Classification(
            decision_id=evidence["decision_id"],
            findings=found,
            outcomes=outcomes,
            abstention_reasons=abstention_reasons(best, actual, found, outcomes, defense_checks),
            parameters=self.parameters,
            continuations={line.analysis_id: line.endpoint for line in (best, actual)},
            defense_checks=defense_checks,
            primary_skill=skills[0] if skills else "unclassified",
            secondary_skills=skills[1:],
            confidence=1.0 if skills else 0.0,
            explanation=" ".join(f.explanation for f in found)
            or "The engine found a meaningful difference, but the saved lines do not establish a specific material or mating consequence.",
        ), {}
