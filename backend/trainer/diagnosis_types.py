"""Auditable local outcomes and tactical witnesses, independent of scheduling."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from trainer.taxonomy import SKILLS

RULE_VERSION = "4.0-lichess-8d9faff6"

OUTCOME_SKILLS = {"material_loss", "missed_material_gain", "allowed_mate", "missed_mate"}
CUES = {
    "hanging_piece": "Before moving, check which of your pieces can be captured without a useful recapture.",
    "missed_tactical_capture": "Look for loose enemy pieces before choosing a quiet move.",
    "fork": "Check forcing moves that attack two valuable targets at once.",
    "pin": "Before moving a pinned piece, check what it exposes: your king or a more valuable piece.",
    "skewer": "Watch for an attack that exposes another valuable piece behind the first target.",
    "removing_defender": "Before exchanging a defender, check what it currently protects.",
    "discovered_attack": "Check what lines open when a blocking piece moves.",
    "double_attack": "Look for a move that creates two threats at once, including checks and opened lines.",
    "back_rank": "Check your king's escape squares before moving a back-rank defender.",
    "promotion_awareness": "Count the moves to promotion and check forcing pawn advances.",
    "material_loss": "Check captures and recaptures before committing to the move.",
    "missed_material_gain": "Scan checks and captures for a practical material gain.",
    "allowed_mate": "Check the opponent's forcing checks before continuing your plan.",
    "missed_mate": "Look for forcing checks when the enemy king has few safe squares.",
    "abandoned_defender": "Before moving a defender, check which pieces will lose its protection.",
    "opponent_threat_recognition": "After their move, check which captures and threats became possible.",
    "avoiding_bad_trades": "Count what you capture and what their recapture takes from you.",
    "deflection": "Check whether a forcing exchange pulls a defender away from another target.",
    "trapped_piece": "Before moving into an attack, check whether the piece has a safe way out.",
}

FindingMechanism = Literal[
    "fork_recognized",
    "fork_collected",
    "pin_prevents_capture",
    "pin_restricts_escape",
    "pin_defenders_no_recapture",
    "pin_collected",
    "skewer_collected",
    "king_skewer_collected",
    "defender_captured",
    "sole_defender_captured",
    "deflection",
    "deflection_collected",
    "discovered_capture",
    "discovered_check",
    "double_check",
    "double_attack_collected",
    "promotion",
    "promotion_material_retained",
    "undefended_capture",
    "undefended_capture_gain",
    "back_rank_mate",
    "abandoned_defender",
    "unfavorable_exchange",
    "previous_threat",
    "relative_pin_released",
]


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    skill_id: str
    rule_id: str
    direction: Literal["missed_opportunity", "allowed_opponent_tactic"]
    actor: Literal["white", "black"]
    analysis_id: str
    plies: list[int] = Field(min_length=1)
    squares: list[str]
    moves: list[str]
    explanation: str
    # Specific producer branch, not a motif inferred from wording or actor role.
    mechanism: FindingMechanism | None = None
    verification: Literal["engine_mate", "verified_line", "engine_defense"]
    cue: str = ""
    cue_key: str | None = None
    frame_ply: int = 0
    roles: dict[str, list[str]] = Field(default_factory=dict)
    context_fen: str | None = None
    context_move: str | None = None
    verification_analysis_ids: list[str] = Field(default_factory=list)

    @field_validator("skill_id")
    @classmethod
    def known_skill(cls, value):
        if value not in SKILLS or value == "unclassified":
            raise ValueError("Unknown local skill")
        return value


class Outcome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["material_loss", "missed_material_gain", "allowed_mate", "missed_mate"]
    analysis_id: str
    end_ply: int
    material_points: int | None = None
    explanation: str
    supporting_analysis_ids: list[str] = Field(default_factory=list)
