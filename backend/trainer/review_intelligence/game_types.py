"""Versioned game relationships over exact generations of saved move evidence."""

from typing import Literal

from pydantic import Field, JsonValue

from trainer.chess_core import Score
from trainer.contracts.common import Color, Contract
from trainer.review_intelligence.events_types import EvidenceReference


class ContextNode(Contract):
    ply: int
    actor: Color
    input_digest: str
    event_ids: list[str]
    before: Score
    after: Score
    evidence: list[EvidenceReference]


class GameRelationship(Contract):
    id: str
    kind: Literal[
        "repeated_motif", "punishment", "recovery", "advantage_run", "erosion", "support_restored"
    ]
    actor: Color
    plies: list[int] = Field(min_length=2)
    event_ids: list[str]
    evidence: list[EvidenceReference] = Field(min_length=1)
    facts: dict[str, JsonValue]


class TurningPoint(Contract):
    ply: int
    actor: Color
    loss_cp: int | None
    mate_transition: bool
    event_ids: list[str]


class GameContext(Contract):
    version: Literal["game-context-1"] = "game-context-1"
    input_digest: str
    complete: bool
    total_plies: int
    missing_plies: list[int]
    nodes: list[ContextNode]
    relationships: list[GameRelationship]
    turning_points: list[TurningPoint]
    biggest_swing_ply: int | None
    limitations: list[str]
