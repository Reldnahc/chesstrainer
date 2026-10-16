"""Versioned game relationships over exact generations of saved move evidence."""

from typing import Annotated, Literal

from pydantic import Field, TypeAdapter

from trainer.chess_core import Score
from trainer.contracts.common import Color, Contract
from trainer.review_intelligence.events_types import EvidenceReference, TacticRole

# Bumped when the saved shape changes; game_context.py imports it.
GAME_CONTEXT_VERSION = "game-context-1"


class ContextNode(Contract):
    ply: int
    actor: Color
    input_digest: str
    event_ids: list[str]
    before: Score
    after: Score
    evidence: list[EvidenceReference]


class RepeatedMotifFacts(Contract):
    motif: str
    role: TacticRole
    occurrence: int
    first_ply: int
    scope: Literal["observed_reviewed_plies"]


class PunishmentFacts(Contract):
    outcome: Literal["capitalized", "missed"]
    opportunity: Literal["advantage", "equality"]


class RecoveryFacts(Contract):
    outcome: Literal["winning_chances", "playable_position"]
    opponent_errors: list[int]


class AdvantageRunFacts(Contract):
    outcome: Literal["converted", "maintained"]
    result_source: Literal["pgn"] | None
    threshold: Literal["200cp_or_searched_mate"]
    reviewed_plies: int
    # The side's own moves inside the run graded Inaccuracy or worse.
    own_error_plies: list[int]


class ErosionFacts(Contract):
    total_conceded_cp: int
    net_deterioration_cp: int
    # The side's own Mistake-sized moves since the first concession.
    own_mistake_plies: list[int]


class SupportRestoredFacts(Contract):
    piece: str
    target: str
    causation: Literal["support_change_only"]


class _Relationship(Contract):
    id: str
    actor: Color
    plies: list[int] = Field(min_length=2)
    event_ids: list[str]
    evidence: list[EvidenceReference] = Field(min_length=1)


class RepeatedMotifRelationship(_Relationship):
    kind: Literal["repeated_motif"]
    facts: RepeatedMotifFacts


class PunishmentRelationship(_Relationship):
    kind: Literal["punishment"]
    facts: PunishmentFacts


class RecoveryRelationship(_Relationship):
    kind: Literal["recovery"]
    facts: RecoveryFacts


class AdvantageRunRelationship(_Relationship):
    kind: Literal["advantage_run"]
    facts: AdvantageRunFacts


class ErosionRelationship(_Relationship):
    kind: Literal["erosion"]
    facts: ErosionFacts


class SupportRestoredRelationship(_Relationship):
    kind: Literal["support_restored"]
    facts: SupportRestoredFacts


GameRelationship = Annotated[
    RepeatedMotifRelationship
    | PunishmentRelationship
    | RecoveryRelationship
    | AdvantageRunRelationship
    | ErosionRelationship
    | SupportRestoredRelationship,
    Field(discriminator="kind"),
]
GAME_RELATIONSHIP = TypeAdapter(GameRelationship)


class TurningPoint(Contract):
    ply: int
    actor: Color
    loss_cp: int | None
    mate_transition: bool
    event_ids: list[str]


class GameContext(Contract):
    version: Literal[GAME_CONTEXT_VERSION] = GAME_CONTEXT_VERSION
    input_digest: str
    complete: bool
    total_plies: int
    missing_plies: list[int]
    nodes: list[ContextNode]
    relationships: list[GameRelationship]
    turning_points: list[TurningPoint]
    biggest_swing_ply: int | None
    limitations: list[str]
