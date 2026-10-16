from datetime import datetime
from typing import Literal

from pydantic import JsonValue

from trainer.chess_core import Candidate
from trainer.contracts.common import Contract
from trainer.contracts.workspace import Coverage


class SkillPriority(Contract):
    skill_id: str
    kind: Literal["outcome", "mechanism"]
    cue: str
    practice_positions: int
    focused_attempts: int
    focused_failures: int
    unique_positions: int
    title: str
    independent_games: int
    occurrences: int
    priority: float
    reviews: int
    failures: int
    lesson_attempts: int
    lesson_failures: int
    retention: Literal["improving", "needs_practice"]
    provisional: bool
    evidence_ids: list[str]
    decision_ids: list[str]


class Weaknesses(Contract):
    skills: list[SkillPriority]
    coverage: Coverage
    unclassified: int


class EvidenceClassification(Contract):
    skill: str
    explanation: str
    confidence: float
    run_id: str
    provider: str
    # Read from saved runs of any rule version, so opaque like RunAudit.response:
    # an older run's findings need not match today's Finding shape.
    findings: list[dict[str, JsonValue]]


class Evidence(Contract):
    id: str
    fen: str
    ply: int
    played_san: str
    loss_cp: int | None
    mate_lost: bool
    allows_mate: bool
    candidates: list[Candidate]
    classifications: list[EvidenceClassification]


class RunAudit(Contract):
    id: str
    user_id: str
    cache_key: str
    model: str
    schema_version: str
    status: str
    # Immutable historical provider payloads are deliberately opaque JSON. They
    # cannot be required to conform to the current local-classifier version.
    response: dict[str, JsonValue] | None
    confidence: float | None
    error: str | None
    attempts: int
    created_at: datetime


class ClassificationAudit(RunAudit):
    provider: str
    version: str
    decision_id: str
