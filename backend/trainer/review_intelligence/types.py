"""Versioned semantic facts, independent of the selected coach."""

from typing import Literal

from pydantic import Field

from trainer.contracts.common import Contract

Naturalness = Literal["preferred", "plausible", "unusual", "unknown"]
DifficultyBand = Literal["forced", "natural", "challenging", "difficult", "unknown"]


class DifficultyComponents(Contract):
    best_rank: int | None = None
    best_probability: float | None = None
    played_rank: int | None = None
    played_probability: float | None = None
    normalized_entropy: float | None = None
    top_three_mass: float | None = None
    candidate_gap_cp: int | None = None
    acceptable_count_lower_bound: int
    alternatives_complete: bool
    only_good_move_at_depth: bool | None
    best_forcing_plies: int
    best_supported_horizon: int
    verified_sacrifice: bool
    mate_transition: Literal["allowed", "missed", "none"]


class PracticalAssessment(Contract):
    version: Literal["practical-1"] = "practical-1"
    input_digest: str
    stockfish_analysis_ids: list[str]
    human_evidence_id: str | None
    calibration: Literal["uncalibrated"] = "uncalibrated"
    probe_version: Literal["synthetic-probe-1"] = "synthetic-probe-1"
    confidence: Literal["structural", "heuristic", "limited", "unavailable"]
    limitations: list[str]
    best_find_difficulty: DifficultyBand
    played_naturalness: Naturalness
    best_naturalness: Naturalness
    components: DifficultyComponents
    interpretations: list[
        Literal[
            "forced_reply",
            "natural_error",
            "unusual_strong_move",
            "natural_best",
            "hard_to_find_defense",
            "immediate_mate_missed",
        ]
    ] = Field(default_factory=list)
