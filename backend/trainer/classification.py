import logging
from contextlib import nullcontext
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, update

from trainer.chess_core import digest, position_key, valid_board
from trainer.diagnosis_types import Finding, Outcome
from trainer.models import (
    ClassificationAnalysis,
    ClassificationRun,
    Decision,
    EngineAnalysis,
    SkillEvidence,
    now,
)
from trainer.taxonomy import SKILLS, TAXONOMY_VERSION

PROMPT_VERSION = "1"
SCHEMA_VERSION = "2"
log = logging.getLogger(__name__)


class Classification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parameters: dict[str, int] = Field(default_factory=dict)
    findings: list[Finding] = Field(default_factory=list)
    outcomes: list[Outcome] = Field(default_factory=list)
    abstention_reasons: list[str] = Field(default_factory=list)
    decision_id: str
    primary_skill: str
    secondary_skills: list[str]
    confidence: float = Field(ge=0, le=1)
    explanation: str = Field(max_length=8000)

    @field_validator("primary_skill")
    @classmethod
    def known_primary(cls, value):
        if value not in SKILLS:
            raise ValueError("Unknown skill ID")
        return value

    @field_validator("secondary_skills")
    @classmethod
    def known_secondary(cls, value):
        if len(value) > 10 or any(v not in SKILLS for v in value):
            raise ValueError("Invalid secondary skills")
        return list(dict.fromkeys(value))


class Classifier(Protocol):
    model: str

    def classify(self, evidence: dict) -> tuple[Classification, dict]: ...


def verified_payload(db, decision):
    supplement = db.scalar(
        select(ClassificationAnalysis)
        .where(ClassificationAnalysis.decision_id == decision.id)
        .order_by(ClassificationAnalysis.created_at.desc(), ClassificationAnalysis.id)
        .limit(1)
    )
    before = db.get(
        EngineAnalysis, supplement.before_analysis_id if supplement else decision.before_analysis_id
    )
    played = db.get(
        EngineAnalysis, supplement.played_analysis_id if supplement else decision.played_analysis_id
    )
    return {
        "decision_id": decision.id,
        "fen": decision.fen,
        "analysis_fens": [before.fen, played.fen],
        "evidence_ids": [before.id, played.id],
        "user_move": {"uci": decision.move_uci, "san": decision.move_san},
        "best_candidates": before.candidates,
        "played_candidate": played.candidates[0],
        "loss": {
            "cp": decision.loss_cp,
            "mate_lost": decision.mate_lost,
            "allows_mate": decision.allows_mate,
        },
        "deterministic_facts": decision.facts,
        "available_skill_ids": list(SKILLS),
    }


def classify_decision(db, decision, classifier, settings, *, write_lock=None):
    if classifier is None:
        return False
    lock = write_lock if write_lock is not None else nullcontext()
    with lock:
        # Pool callers pass an ID so waiting tasks hold no DB connection while
        # another thread owns the short write phase, or during the network call.
        if isinstance(decision, str):
            decision = db.get(Decision, decision)
        if decision is None or not decision.meaningful:
            return False
        payload = verified_payload(db, decision)
        key = digest(
            {
                "payload": payload,
                "provider": getattr(classifier, "provider", "test"),
                "parameters": getattr(classifier, "parameters", {}),
                "version": getattr(classifier, "version", classifier.model),
                "model": classifier.model,
                "prompt": PROMPT_VERSION,
                "schema": SCHEMA_VERSION,
                "taxonomy": TAXONOMY_VERSION,
            }
        )
        run = db.scalar(select(ClassificationRun).where(ClassificationRun.cache_key == key))
        if run and run.status == "rejected":
            return False
        if run and run.status == "completed":
            activate_run(db, run, settings)
            db.commit()
            return True
        if run is None:
            run = ClassificationRun(
                cache_key=key,
                decision_id=decision.id,
                provider=getattr(classifier, "provider", "test"),
                version=getattr(classifier, "version", classifier.model),
                model=classifier.model,
                schema_version=SCHEMA_VERSION,
                prompt_version=PROMPT_VERSION,
                status="running",
            )
            db.add(run)
        else:
            run.attempts += 1
            run.status = "running"
        db.commit()
    try:
        output, usage = classifier.classify(payload)
        with lock:
            result = Classification.model_validate(output)
            if result.decision_id != decision.id:
                raise ValueError("Classification references an unrelated decision")
            if getattr(classifier, "provider", None) == "local_rules":
                expected = position_key(valid_board(decision.fen))
                if any(
                    position_key(valid_board(fen)) != expected for fen in payload["analysis_fens"]
                ):
                    raise ValueError("Classification analysis belongs to a different position")
                labels = set([result.primary_skill, *result.secondary_skills]) - {"unclassified"}
                if labels != {f.skill_id for f in result.findings}:
                    raise ValueError("Classification labels lack matching findings")
                for finding in result.findings:
                    if finding.analysis_id not in payload["evidence_ids"]:
                        raise ValueError("Finding references unrelated analysis")
            run.response = result.model_dump()
            run.confidence = result.confidence
            run.input_tokens = usage.get("input_tokens", 0)
            run.output_tokens = usage.get("output_tokens", 0)
            run.status, run.error, run.created_at = "completed", None, now()
            # Keep immutable model runs and course revision snapshots; current labels follow
            # the latest requested successful classification, including low confidence.
            db.execute(
                update(SkillEvidence)
                .where(SkillEvidence.decision_id == decision.id)
                .values(active=False)
            )
            if result.confidence >= 0.7:
                for skill in dict.fromkeys([result.primary_skill] + result.secondary_skills):
                    if skill == "unclassified":
                        continue
                    evidence = db.scalar(
                        select(SkillEvidence).where(
                            SkillEvidence.decision_id == decision.id,
                            SkillEvidence.skill_id == skill,
                        )
                    )
                    if evidence is None:
                        db.add(
                            SkillEvidence(
                                decision_id=decision.id,
                                skill_id=skill,
                                classification_run_id=run.id,
                                confidence=result.confidence,
                                explanation=label_explanation(result, skill),
                            )
                        )
                    else:
                        evidence.classification_run_id = run.id
                        evidence.confidence = result.confidence
                        evidence.explanation = label_explanation(result, skill)
                        evidence.active = True
            db.commit()
        return True
    except Exception as exc:
        with lock:
            db.rollback()
            run = db.scalar(select(ClassificationRun).where(ClassificationRun.cache_key == key))
            run.status = "failed"
            # Do not persist provider messages which might echo private request content.
            run.error = f"{type(exc).__name__}: classification failed; evidence retained for retry"
            db.commit()
        log.warning(
            "classification_failed",
            extra={"decision_id": decision.id, "error_type": type(exc).__name__},
        )
        return False


def label_explanation(result, skill):
    return (
        " ".join(f.explanation for f in result.findings if f.skill_id == skill)
        or result.explanation
    )


def activate_run(db, run, settings):
    """Reconstruct current labels from an immutable cached response, without an API call."""
    result = Classification.model_validate(run.response)
    rows = {
        e.skill_id: e
        for e in db.scalars(
            select(SkillEvidence).where(SkillEvidence.decision_id == run.decision_id)
        )
    }
    for evidence in rows.values():
        evidence.active = False
    if result.confidence < 0.7:
        return
    for skill in dict.fromkeys([result.primary_skill, *result.secondary_skills]):
        if skill == "unclassified":
            continue
        evidence = rows.get(skill)
        if evidence is None:
            evidence = SkillEvidence(
                decision_id=run.decision_id,
                skill_id=skill,
                classification_run_id=run.id,
                confidence=result.confidence,
                explanation=label_explanation(result, skill),
            )
            db.add(evidence)
        else:
            evidence.classification_run_id, evidence.confidence = run.id, result.confidence
            evidence.explanation, evidence.active = label_explanation(result, skill), True


def reject_run(db, run_id):
    run = db.get(ClassificationRun, run_id)
    if run is None:
        raise ValueError("Classification run not found")
    run.status = "rejected"
    run.error = "Rejected by the learner as unsupported; excluded from current diagnosis."
    db.execute(
        update(SkillEvidence)
        .where(SkillEvidence.classification_run_id == run_id)
        .values(active=False)
    )
    db.commit()
    return {"rejected": True}
