"""Coach-independent move semantics and traceable evidence references."""

from typing import Literal

from pydantic import Field, JsonValue

from trainer.contracts.common import Color, Contract


class ClockFacts(Contract):
    version: Literal["clock-1"] = "clock-1"
    status: Literal["absent", "annotated", "invalid"] = "absent"
    time_control: str | None = None
    control_kind: Literal["increment", "sudden_death", "delay", "staged", "unknown"] = "unknown"
    before_seconds: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    after_seconds: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    elapsed_seconds: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    increment_seconds: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    before_source: Literal["previous_clock", "initial_control", "unknown"] = "unknown"
    elapsed_source: Literal["annotation", "clock_delta", "unknown"] = "unknown"
    before_band: Literal["critical", "low", "ample", "unknown"] = "unknown"
    after_band: Literal["critical", "low", "ample", "unknown"] = "unknown"
    tempo: Literal["fast_with_time", "long_think", "ordinary", "unknown"] = "unknown"
    limitations: list[str] = Field(default_factory=list)


class EvidenceReference(Contract):
    source: Literal["stockfish", "human", "rule", "pgn", "book", "position", "weakness"]
    id: str
    field: str
    ply: int | None = None


class ReviewEvent(Contract):
    id: str
    kind: Literal[
        "mate",
        "evaluation_change",
        "critical_resource",
        "sacrifice",
        "tactic",
        "human_contrast",
        "clock_observation",
        "opening_departure",
        "check",
        "finish",
        "positional",
    ]
    actor: Color
    confidence: Literal["board_fact", "searched", "line_witness", "model_signal", "annotation"]
    importance: int = Field(ge=0, le=100)
    facts: dict[str, JsonValue]
    evidence: list[EvidenceReference] = Field(min_length=1)


class MoveIntelligence(Contract):
    version: Literal["move-events-2"] = "move-events-2"
    input_digest: str
    ply: int | None
    events: list[ReviewEvent]
    clock: ClockFacts | None
    limitations: list[str]
