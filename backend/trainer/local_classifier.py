"""Conservative findings from saved engine lines; no model or network calls.

Rules describe observable consequences, not a learner's thought process. A PV
is one engine continuation, not proof that every reply is forced.
"""

from trainer.classification import Classification
from trainer.classification_stages import (
    abstention_reasons,
    attach_provenance,
    diagnose_line,
    line_parameters,
    mate_findings,
    read_lines,
)
from trainer.config import Settings
from trainer.diagnosis_types import RULE_VERSION, evidence_probes
from trainer.taxonomy import UNCLASSIFIED


def classifier_parameters(settings=None):
    """The classifier's line limits, from the host's settings or their defaults.

    The keys are saved in every classification and hashed into its cache key, so
    they keep their names: ``max_plies`` is the continuation horizon and
    ``tactic_plies`` the bound on one tactical episode.
    """
    fields = {
        "min_loss_cp": "classification_min_loss_cp",
        "min_material": "classification_min_material",
    }
    # The line horizon is the one every line reader shares (line_parameters).
    return line_parameters(settings) | {
        key: getattr(settings, name) if settings else Settings.model_fields[name].default
        for key, name in fields.items()
    }


class LocalClassifier:
    provider = "local_rules"
    version = RULE_VERSION
    model = "local-rules"  # Retained audit column; no model is loaded.

    def __init__(self, settings=None):
        self.parameters = classifier_parameters(settings)

    def classify(self, evidence):

        best, actual, loss = read_lines(evidence, self.parameters)
        found = mate_findings(best, actual, loss)
        outcomes, defense_checks = [], []
        # Stable ordering is part of primary-skill selection and saved explanations.
        for line, alternative in ((actual, best), (best, actual)):
            result = diagnose_line(line, alternative, loss, evidence, self.parameters)
            found.extend(result.findings)
            outcomes.extend(result.outcomes)
            defense_checks.extend(result.defense_checks)
        attach_provenance(found, outcomes, evidence_probes(evidence))
        skills = list(dict.fromkeys(f.skill_id for f in found))
        return Classification(
            decision_id=evidence["decision_id"],
            findings=found,
            outcomes=outcomes,
            abstention_reasons=abstention_reasons(best, actual, found, outcomes, defense_checks),
            parameters=self.parameters,
            continuations={line.analysis_id: line.endpoint for line in (best, actual)},
            defense_checks=defense_checks,
            primary_skill=skills[0] if skills else UNCLASSIFIED,
            secondary_skills=skills[1:],
            confidence=1.0 if skills else 0.0,
            explanation=" ".join(f.explanation for f in found)
            or "The engine found a meaningful difference, but the saved lines do not establish a specific material or mating consequence.",
        )
