"""Coach-independent move semantics and traceable evidence references.

Every event kind has its own typed facts, so a renamed or retyped key fails where
it is produced (validation) and in the generated frontend types, never as a
missing key at read time.
"""

from typing import Annotated, Literal

from pydantic import Field, TypeAdapter

from trainer.chess_core import Score
from trainer.contracts.common import Color, Contract
from trainer.human_models.types import Conditioning, Domain
from trainer.review_intelligence.types import Naturalness

# Bumped when the saved shape changes; producers import these.
CLOCK_VERSION = "clock-1"
EVENTS_VERSION = "move-events-4"


class ClockFacts(Contract):
    version: Literal[CLOCK_VERSION] = CLOCK_VERSION
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


AdvantageBand = Literal[
    "forced_win", "forced_loss", "advantage", "disadvantage", "balanced", "edge"
]
TacticRole = Literal["allowed", "played", "missed", "alternative", "caused"]


class MateFacts(Contract):
    transition: Literal["allowed", "missed"]
    best: Score
    actual: Score
    # Moves until the mate lands; 1 means the reply itself mates.
    mate_in: int | None


class ForcedMateFacts(Contract):
    stage: Literal["started", "continued", "next", "slower", "hastened", "held"]
    winner: Literal["mover", "opponent"]
    mate_in: int
    best: Score
    actual: Score


class EvaluationChangeFacts(Contract):
    from_band: AdvantageBand
    to_band: AdvantageBand
    loss_cp: int | None
    lost_advantage: bool
    decisive: bool


class CriticalResourceFacts(Contract):
    only_good_at_depth: int
    difficult: bool
    purpose: Literal["decisive_resource", "defense"]


class SacrificeFacts(Contract):
    acceptance_move: str
    acceptance_score: Score
    sound_at_depth: int


class WitnessMove(Contract):
    ply: int
    san: str
    capture: str | None
    gives_check: bool


class WitnessPiece(Contract):
    piece: str
    color: Color


class TacticFacts(Contract):
    motif: str
    role: TacticRole
    # The beneficiary of a mover-caused opportunity (role "caused"), else None.
    opportunity_actor: Color | None
    rule_id: str
    frame_ply: int
    plies: list[int]
    moves: list[str]
    squares: list[str]
    roles: dict[str, list[str]]
    # Pins only: whether the pinned pieces were already pinned before the move.
    pinned_before: bool | None
    verification: Literal["engine_mate", "verified_line", "engine_defense"]
    context_fen: str | None
    context_move: str | None
    witness: list[WitnessMove]
    pieces: dict[str, WitnessPiece]
    settled_material_delta: int | None


class HumanContrastFacts(Contract):
    observations: list[Literal["natural_error", "unusual_strong_move", "engine_human_disagreement"]]
    played_naturalness: Naturalness
    best_naturalness: Naturalness
    confidence: Literal["structural", "heuristic", "limited", "unavailable"]
    domain: Domain | None
    conditioning: Conditioning | None


class ClockObservationFacts(Contract):
    before_band: Literal["critical", "low", "ample", "unknown"]
    tempo: Literal["fast_with_time", "long_think", "ordinary", "unknown"]
    before_seconds: float | None
    elapsed_seconds: float | None
    accompanied_error: bool | None
    causation: Literal["not_inferred"]


class OpeningDepartureFacts(Contract):
    catalogue: str
    previous_book_ply: int
    previous_name: str | None


class CheckFacts(Contract):
    gives_check: bool
    escapes_check: bool


class FinishFacts(Contract):
    termination: Literal["checkmate", "stalemate", "insufficient_material"]
    result: str


class _PositionalFacts(Contract):
    side: Color
    squares: list[str]
    line: Literal["actual", "best"]
    uci: str
    value_judgment: Literal["not_inferred"]


class FirstDevelopmentFacts(_PositionalFacts):
    feature: Literal["first_development"]
    before: str
    after: str
    piece: str


class CastlingFacts(_PositionalFacts):
    feature: Literal["castling"]
    before: str
    after: str
    adjacent_pawns: list[str]


class KingFlightsFacts(_PositionalFacts):
    feature: Literal["king_flights"]
    before: list[str]
    after: list[str]
    opened: list[str]
    king: str


class PawnSetFacts(_PositionalFacts):
    feature: Literal["passed_pawns", "isolated_pawns"]
    before: list[str]
    after: list[str]
    added: list[str]
    removed: list[str]


class DoubledFilesFacts(_PositionalFacts):
    feature: Literal["doubled_files"]
    before: list[str]
    after: list[str]
    added: list[str]
    removed: list[str]


class PassedPawnAdvanceFacts(_PositionalFacts):
    feature: Literal["passed_pawn_advance"]
    before: str
    after: str


class RookFileFacts(_PositionalFacts):
    feature: Literal["rook_file"]
    before: Literal["closed", "semi_open", "open"]
    after: Literal["closed", "semi_open", "open"]
    file: str


class PieceSupportFacts(_PositionalFacts):
    feature: Literal["piece_support"]
    before: list[str]
    after: list[str]
    piece: str
    target: str
    attacked: bool


class BishopPairFacts(_PositionalFacts):
    feature: Literal["bishop_pair"]
    before: int
    after: int


PositionalFacts = Annotated[
    FirstDevelopmentFacts
    | CastlingFacts
    | KingFlightsFacts
    | PawnSetFacts
    | DoubledFilesFacts
    | PassedPawnAdvanceFacts
    | RookFileFacts
    | PieceSupportFacts
    | BishopPairFacts,
    Field(discriminator="feature"),
]


class _Event(Contract):
    id: str
    actor: Color
    confidence: Literal["board_fact", "searched", "line_witness", "model_signal", "annotation"]
    importance: int = Field(ge=0, le=100)
    evidence: list[EvidenceReference] = Field(min_length=1)


class MateEvent(_Event):
    kind: Literal["mate"]
    facts: MateFacts


class ForcedMateEvent(_Event):
    kind: Literal["forced_mate"]
    facts: ForcedMateFacts


class EvaluationChangeEvent(_Event):
    kind: Literal["evaluation_change"]
    facts: EvaluationChangeFacts


class CriticalResourceEvent(_Event):
    kind: Literal["critical_resource"]
    facts: CriticalResourceFacts


class SacrificeEvent(_Event):
    kind: Literal["sacrifice"]
    facts: SacrificeFacts


class TacticEvent(_Event):
    kind: Literal["tactic"]
    facts: TacticFacts


class HumanContrastEvent(_Event):
    kind: Literal["human_contrast"]
    facts: HumanContrastFacts


class ClockObservationEvent(_Event):
    kind: Literal["clock_observation"]
    facts: ClockObservationFacts


class OpeningDepartureEvent(_Event):
    kind: Literal["opening_departure"]
    facts: OpeningDepartureFacts


class CheckEvent(_Event):
    kind: Literal["check"]
    facts: CheckFacts


class FinishEvent(_Event):
    kind: Literal["finish"]
    facts: FinishFacts


class PositionalEvent(_Event):
    kind: Literal["positional"]
    facts: PositionalFacts


ReviewEvent = Annotated[
    MateEvent
    | ForcedMateEvent
    | EvaluationChangeEvent
    | CriticalResourceEvent
    | SacrificeEvent
    | TacticEvent
    | HumanContrastEvent
    | ClockObservationEvent
    | OpeningDepartureEvent
    | CheckEvent
    | FinishEvent
    | PositionalEvent,
    Field(discriminator="kind"),
]
REVIEW_EVENT = TypeAdapter(ReviewEvent)


class MoveIntelligence(Contract):
    version: Literal[EVENTS_VERSION] = EVENTS_VERSION
    input_digest: str
    ply: int | None
    events: list[ReviewEvent]
    clock: ClockFacts | None
    limitations: list[str]


def report_events(report) -> list[ReviewEvent]:
    """A presented report's events as typed models, for readers of its facts."""
    return MoveIntelligence.model_validate(report["intelligence"]).events
