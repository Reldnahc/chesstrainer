"""Provider-neutral, versioned facts. No objective score or move-quality field."""

import math
from typing import Literal

from pydantic import Field, model_validator

from trainer.contracts.common import Color, Contract


class History(Contract):
    root: str
    moves: list[str] = Field(max_length=20000)
    fen: str


class Conditioning(Contract):
    self_rating: int = Field(ge=0, le=5000)
    opponent_rating: int = Field(ge=0, le=5000)
    self_source: Literal["pgn", "fallback"]
    opponent_source: Literal["pgn", "fallback"]


class Domain(Contract):
    platform: Literal["lichess", "chesscom", "unknown"]
    time_control: str | None
    time_class: str | None
    alignment: Literal["related", "shifted", "unknown"]
    calibration: Literal["unvalidated"] = "unvalidated"
    history_from_start: bool
    reasons: list[str]


class HumanRequest(Contract):
    history: History
    mover: Color
    conditioning: Conditioning
    domain: Domain


class ModelProvenance(Contract):
    provider: str
    model: str
    model_revision: str
    checkpoint_sha256: str
    code_revision: str
    adapter_version: str
    inference: dict[str, str | int | bool]


class HumanMove(Contract):
    uci: str
    rank: int = Field(ge=1)
    probability: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)


class HumanPolicy(Contract):
    schema_version: Literal["human-policy-1"] = "human-policy-1"
    provenance: ModelProvenance
    complete: bool
    moves: list[HumanMove] = Field(min_length=1, max_length=256)

    @model_validator(mode="after")
    def coherent_distribution(self):
        if [row.rank for row in self.moves] != list(range(1, len(self.moves) + 1)):
            raise ValueError("Human move ranks must be contiguous and ordered")
        if len({row.uci for row in self.moves}) != len(self.moves):
            raise ValueError("Duplicate human move")
        known = [row.probability for row in self.moves if row.probability is not None]
        if known and len(known) != len(self.moves):
            raise ValueError("Do not mix ranked-only moves with a partial probability distribution")
        if known and any(a + 1e-7 < b for a, b in zip(known, known[1:])):
            raise ValueError("Human ranks disagree with policy")
        if known and (
            sum(known) > 1.00001 or self.complete and not math.isclose(sum(known), 1, abs_tol=1e-5)
        ):
            raise ValueError("Human policy is not a normalized legal distribution")
        return self


class HumanEvidence(Contract):
    schema_version: Literal["human-evidence-1"] = "human-evidence-1"
    status: Literal["available", "disabled", "unavailable", "cancelled", "not_applicable"]
    evidence_id: str | None = None
    configuration_key: str
    history_key: str
    mover: Color
    conditioning: Conditioning
    domain: Domain
    provenance: ModelProvenance | None = None
    played: HumanMove | None = None
    engine_best: HumanMove | None = None
    top_moves: list[HumanMove] = Field(default_factory=list)
    legal_count: int
    normalized_entropy: float | None = None
    top_three_mass: float | None = None
    unavailable_reason: str | None = None


class HumanReadiness(Contract):
    status: Literal["disabled", "not_configured", "unchecked", "ready", "unavailable"]
    provider: str = "maia3"
    model: str = "79m"
    message: str | None = None
