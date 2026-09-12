"""Read-only local-classifier coverage report. Does not mutate labels or learning history."""

import argparse
import json
import time
from collections import Counter
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from trainer.classification import verified_payload
from trainer.config import Settings
from trainer.coverage import MECHANISM_SKILLS
from trainer.diagnosis_types import OUTCOME_SKILLS
from trainer.local_classifier import LocalClassifier
from trainer.models import Decision


def report(path, settings):
    # URI mode=ro makes this safe against accidental ORM writes as well as explicit SQL.
    engine = create_engine(f"sqlite:///file:{path.resolve().as_posix()}?mode=ro&uri=true")
    started = time.monotonic()
    classifier = LocalClassifier(settings)
    counts, directions = Counter(), Counter()
    classified = total = 0
    errors = []
    findings = []
    outcome_count = mechanism_count = 0
    reasons = Counter()
    try:
        with Session(engine) as db:
            for decision in db.scalars(select(Decision).where(Decision.meaningful.is_(True))):
                total += 1
                try:
                    payload = verified_payload(db, decision)
                    result, _ = classifier.classify(payload)
                    skills = {f.skill_id for f in result.findings}
                    outcome_count += bool(skills & OUTCOME_SKILLS)
                    mechanism_count += bool(skills & MECHANISM_SKILLS)
                    reasons.update(result.abstention_reasons)
                    classified += bool(result.findings)
                    counts.update(set(f.skill_id for f in result.findings))
                    directions.update(set(f.direction for f in result.findings))
                    findings.append(
                        {
                            "decision_id": decision.id,
                            "game_id": decision.game_id,
                            "evidence": payload,
                            "outcomes": [o.model_dump() for o in result.outcomes],
                            "continuations": {
                                k: v.model_dump() for k, v in result.continuations.items()
                            },
                            "defense_checks": result.defense_checks,
                            "abstention_reasons": result.abstention_reasons,
                            "findings": [f.model_dump() for f in result.findings],
                        }
                    )
                except (ValueError, KeyError, IndexError) as exc:
                    errors.append({"decision_id": decision.id, "error": type(exc).__name__})
    finally:
        engine.dispose()
    return {
        "rule_version": classifier.version,
        "parameters": classifier.parameters,
        "decisions": total,
        "classified": classified,
        "with_outcome": outcome_count,
        "with_mechanism": mechanism_count,
        "abstention_reasons": dict(reasons),
        "unclassified": total - classified - len(errors),
        "errors": errors,
        "labels": dict(counts),
        "directions": dict(directions),
        "seconds": round(time.monotonic() - started, 3),
        "quality_note": "Coverage only. Precision and recall require an independent human-reviewed benchmark.",
        "results": findings,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path)
    parser.add_argument(
        "--output", type=Path, help="New local JSON report; contains private evidence IDs/moves"
    )
    parser.add_argument(
        "--sample", type=Path, help="Export an unlabelled, stratified CSV for human review"
    )
    parser.add_argument("--sample-size", type=int, default=60)
    parser.add_argument(
        "--annotations", type=Path, help="Evaluate a completed annotation CSV against this report"
    )
    args = parser.parse_args()
    settings = Settings()
    result = report(args.database or settings.database_path, settings)
    if args.sample:
        from trainer.classification_quality import export_sample

        export_sample(result, args.sample, args.sample_size)
    if args.annotations:
        from trainer.classification_quality import evaluate_annotations

        result["human_evaluation"] = evaluate_annotations(result, args.annotations)
    if args.output:
        with args.output.open("x", encoding="utf-8") as output:
            json.dump(result, output, indent=2)
    print(json.dumps({k: v for k, v in result.items() if k != "results"}, indent=2))
