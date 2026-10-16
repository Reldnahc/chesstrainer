import logging

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, update

from trainer.chess_core import digest, position_key, valid_board
from trainer.continuations import ContinuationEnd
from trainer.defensive_probes import DefenseCheck
from trainer.diagnosis_types import (
    Finding,
    Outcome,
    PreviousMove,
    ProbeRecord,
    evidence_probes,
)
from trainer.errors import EvidenceIntegrityError, NotFound
from trainer.imports import decision_board
from trainer.models import (
    ClassificationAnalysis,
    ClassificationProbe,
    ClassificationRun,
    Decision,
    EngineAnalysis,
    Game,
    SkillEvidence,
    now,
)
from trainer.taxonomy import SKILLS, TAXONOMY_VERSION, UNCLASSIFIED

PROMPT_VERSION = "1"
SCHEMA_VERSION = "3"
log = logging.getLogger(__name__)


class Classification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parameters: dict[str, int] = Field(default_factory=dict)
    continuations: dict[str, ContinuationEnd] = Field(default_factory=dict)
    defense_checks: list[DefenseCheck] = Field(default_factory=list)
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


REJECTED = "Rejected by the learner as unsupported; excluded from current diagnosis."


def probe_record(kind, root_analysis_id, at_ply, query_key, analysis):
    """One engine probe as the classifier reads it, from its saved engine analysis.

    The same record is built when a probe is planned and when its evidence is
    reloaded, so a classification sees identical evidence either way.
    """
    return ProbeRecord(
        kind=kind,
        root_analysis_id=root_analysis_id,
        at_ply=at_ply,
        query_key=query_key,
        analysis_id=analysis.id,
        fen=analysis.fen,
        config=analysis.config,
        candidate=analysis.candidates[0],
    )


def verified_payload(db, decision):

    previous = None
    if decision.ply > 1:
        source = decision_board(db.get(Game, decision.game_id), decision.ply)
        if position_key(source) != position_key(valid_board(decision.fen)):
            raise EvidenceIntegrityError("Source game does not match decision position")
        if source.move_stack:
            move = source.pop()
            previous = PreviousMove(fen=source.fen(), uci=move.uci()).model_dump()
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
    probes = []
    if supplement:
        for probe in db.scalars(
            select(ClassificationProbe)
            .where(ClassificationProbe.classification_analysis_id == supplement.id)
            .order_by(
                ClassificationProbe.root_analysis_id,
                ClassificationProbe.at_ply,
                ClassificationProbe.id,
            )
        ):
            probes.append(
                probe_record(
                    probe.kind,
                    probe.root_analysis_id,
                    probe.at_ply,
                    probe.query_key,
                    db.get(EngineAnalysis, probe.analysis_id),
                )
            )
    return {
        "decision_id": decision.id,
        "fen": decision.fen,
        "analysis_fens": [before.fen, played.fen],
        "evidence_ids": [before.id, played.id],
        "user_move": {"uci": decision.move_uci, "san": decision.move_san},
        "previous_move": previous,
        "probes": [probe.model_dump(mode="json") for probe in probes],
        "best_candidates": before.candidates,
        "played_candidate": played.candidates[0],
        "loss": {
            "cp": decision.loss_cp,
            "mate_lost": decision.mate_lost,
            "allows_mate": decision.allows_mate,
        },
        "available_skill_ids": list(SKILLS),
    }


def classify_decision(units, decision, classifier):
    """Classify one meaningful decision and set its current labels; returns whether it did.

    ``units`` opens the account's ``read()`` and ``write()`` units, and
    ``decision`` is a Decision or its id. The run is started in one write unit
    and finished in another, so a classifier call never holds the account lock
    or a database connection. A decision whose saved evidence cannot be
    assembled is skipped and logged, like a failed classification, so one bad
    row never stops the rest of a job.
    """
    decision_id = decision if isinstance(decision, str) else decision.id
    with units.write() as db:
        decision = db.get(Decision, decision_id)
        if decision is None or not decision.meaningful:
            return False
        try:
            payload = verified_payload(db, decision)
        except (ValueError, NotFound) as exc:
            _log_failure(decision, exc)
            return False
        run = _start_run(db, decision, classifier, payload)
        if run is None or run.status == "completed":
            if run is not None:
                activate_run(db, run)
            # A result the learner already rejected is not a classification.
            return run is not None and run.status != "rejected"
        key = run.cache_key
    try:
        output, usage = classifier.classify(payload)
        with units.write() as db:
            run = db.scalar(select(ClassificationRun).where(ClassificationRun.cache_key == key))
            result = _validated(output, decision, classifier, payload)
            run.response = result.model_dump()
            run.confidence = result.confidence
            run.input_tokens = usage.get("input_tokens", 0)
            run.output_tokens = usage.get("output_tokens", 0)
            run.status, run.error, run.created_at = "completed", None, now()
            # Keep immutable runs; current labels follow the latest requested
            # successful classification, including low confidence.
            activate_run(db, run)
            return run.status != "rejected"
    except Exception as exc:
        with units.write() as db:
            run = db.scalar(select(ClassificationRun).where(ClassificationRun.cache_key == key))
            run.status = "failed"
            # Do not persist classifier messages which might echo private request content.
            run.error = f"{type(exc).__name__}: classification failed; evidence retained for retry"
        _log_failure(decision, exc)
        return False


def _log_failure(decision, exc):
    log.warning(
        "classification_failed",
        extra={"decision_id": decision.id, "error_type": type(exc).__name__},
    )


def _start_run(db, decision, classifier, payload):
    """The run for this exact evidence and classifier: None when the learner rejected it,
    the cached run when it already completed, otherwise a run marked running."""
    key = digest(
        {
            "payload": payload,
            "provider": classifier.provider,
            "parameters": classifier.parameters,
            "version": classifier.version,
            "model": classifier.model,
            "prompt": PROMPT_VERSION,
            "schema": SCHEMA_VERSION,
            "taxonomy": TAXONOMY_VERSION,
        }
    )
    run = db.scalar(select(ClassificationRun).where(ClassificationRun.cache_key == key))
    if run and run.status == "rejected":
        return None
    if run and run.status == "completed":
        return run
    if run is None:
        run = ClassificationRun(
            cache_key=key,
            decision_id=decision.id,
            provider=classifier.provider,
            version=classifier.version,
            model=classifier.model,
            schema_version=SCHEMA_VERSION,
            prompt_version=PROMPT_VERSION,
            status="running",
        )
        db.add(run)
    else:
        run.attempts += 1
        run.status = "running"
    db.flush()
    return run


def _validated(output, decision, classifier, payload):
    """The classifier's result, checked against the evidence it was given."""
    result = Classification.model_validate(output)
    if result.decision_id != decision.id:
        raise EvidenceIntegrityError("Classification references an unrelated decision")
    expected = position_key(valid_board(decision.fen))
    if any(position_key(valid_board(fen)) != expected for fen in payload["analysis_fens"]):
        raise EvidenceIntegrityError("Classification analysis belongs to a different position")
    labels = set([result.primary_skill, *result.secondary_skills]) - {UNCLASSIFIED}
    if labels != {f.skill_id for f in result.findings}:
        raise EvidenceIntegrityError("Classification labels lack matching findings")
    probes = {probe.analysis_id for probe in evidence_probes(payload)}
    for finding in result.findings:
        if finding.analysis_id not in payload["evidence_ids"]:
            raise EvidenceIntegrityError("Finding references unrelated analysis")
        if not set(finding.verification_analysis_ids) <= probes:
            raise EvidenceIntegrityError("Finding references unrelated verification")
    return result


def label_explanation(result, skill):
    return (
        " ".join(f.explanation for f in result.findings if f.skill_id == skill)
        or result.explanation
    )


# Labels below this confidence are saved in the run but never made current.
LABEL_CONFIDENCE = 0.7


def _labels(result):
    return {result.primary_skill, *result.secondary_skills} - {UNCLASSIFIED}


def activate_run(db, run):
    """Make a completed run's labels the decision's current labels, and only those.

    A run whose labels the learner already rejected for this decision, in a run
    with other evidence or rules, is rejected too rather than revived.
    """
    result = Classification.model_validate(run.response)
    rows = {
        e.skill_id: e
        for e in db.scalars(
            select(SkillEvidence).where(SkillEvidence.decision_id == run.decision_id)
        )
    }
    for evidence in rows.values():
        evidence.active = False
    rejected = db.scalars(
        select(ClassificationRun.response).where(
            ClassificationRun.decision_id == run.decision_id,
            ClassificationRun.status == "rejected",
            ClassificationRun.id != run.id,
            ClassificationRun.response.is_not(None),
        )
    )
    # An abstention (no labels) carries nothing forward to reject.
    if _labels(result) and any(
        _labels(Classification.model_validate(earlier)) == _labels(result) for earlier in rejected
    ):
        run.status = "rejected"
        run.error = REJECTED
        return
    if result.confidence < LABEL_CONFIDENCE:
        return
    for skill in dict.fromkeys([result.primary_skill, *result.secondary_skills]):
        if skill == UNCLASSIFIED:
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
        raise NotFound("Classification run not found")
    run.status = "rejected"
    run.error = REJECTED
    db.execute(
        update(SkillEvidence)
        .where(SkillEvidence.classification_run_id == run_id)
        .values(active=False)
    )
    return {"rejected": True}
