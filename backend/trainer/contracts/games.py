from typing import Literal

from trainer.chess_core import Candidate, Score
from trainer.contracts.common import Color, Contract, LegalMove
from trainer.diagnosis_types import Finding
from trainer.explanations import Frame
from trainer.human_models.types import HumanEvidence
from trainer.review_intelligence.events_types import MoveIntelligence
from trainer.review_intelligence.game_types import GameContext
from trainer.review_intelligence.history import CrossGameContext
from trainer.review_intelligence.narrative import GameNarrative
from trainer.review_intelligence.types import PracticalAssessment

MoveQuality = Literal[
    "Brilliant", "Great", "Best", "Good", "Book", "Inaccuracy", "Mistake", "Miss", "Blunder"
]


class GameAccuracy(Contract):
    version: str
    white: float
    black: float


class GameHistoryItem(Contract):
    id: str
    white: str
    black: str
    white_rating: int | None
    black_rating: int | None
    learner_color: Color
    played_on: str | None
    played_at: str | None
    result: str
    time_control: str | None
    time_control_label: str | None
    move_count: int
    status: str
    accuracy: GameAccuracy | None


class GameHistory(Contract):
    items: list[GameHistoryItem]
    total: int


class GamePosition(Contract):
    fen: str
    turn: Color
    legal_moves: list[LegalMove]
    result: str | None
    termination: str | None
    san: str | None


class BoardArrow(Contract):
    startSquare: str
    endSquare: str
    kind: Literal["move", "reply", "threat"]


class BoardCues(Contract):
    fen: str
    arrows: list[BoardArrow]
    roles: dict[str, list[str]]
    caption: str


class BookOpening(Contract):
    version: str
    eco: str | None
    name: str | None


class GameMoveReport(Contract):
    intelligence: MoveIntelligence | None = None
    human: HumanEvidence | None = None
    practical: PracticalAssessment | None = None
    refinement: "RefinementInfo | None" = None
    label: MoveQuality
    engine_label: MoveQuality
    opening: BookOpening | None
    reason: str
    coach: str
    best: Candidate
    actual: Candidate
    white_score: Score
    depth: int
    engine_version: str
    board_cues: BoardCues | None


class ReviewLine(Contract):
    frames: list[Frame]
    findings: list[Finding]
    material_delta: int | None
    settled: bool


class SacrificeEvidence(Contract):
    capture: str
    analysis_id: str
    score: Score


class GameReviewReport(GameMoveReport):
    version: str
    before_analysis_id: str
    played_analysis_id: str
    second_score: Score | None
    root_candidates: list[Candidate] | None = None
    previous_score: Score | None
    legal_count: int
    loss_cp: int | None
    sacrifice: SacrificeEvidence | None
    opportunity_missed: bool
    actual_line: ReviewLine
    best_line: ReviewLine


class GameFrame(GamePosition):
    san: str
    uci: str | None
    number: int
    actor: Color | None
    report: GameReviewReport | None


class ReviewJob(Contract):
    id: str
    status: str
    completed: int
    total: int
    error: str | None
    cancel_requested: bool
    phase: Literal["baseline", "refinement", "complete"] = "baseline"
    refinement_completed: int = 0
    refinement_total: int = 0


class GameDetail(Contract):
    narrative: GameNarrative | None = None
    history: CrossGameContext | None = None
    context: GameContext | None = None
    review_revision: int = 0
    id: str
    white: str
    black: str
    played_on: str | None
    result: str
    orientation: Color
    rating: int
    white_rating: int | None
    black_rating: int | None
    frames: list[GameFrame]
    job: ReviewJob | None
    accuracy: GameAccuracy | None


class ReviewedMove(Contract):
    ply: int
    report: GameMoveReport


class ReviewProgress(Contract):
    narrative: GameNarrative | None = None
    history: CrossGameContext | None = None
    context: GameContext | None = None
    revision: int = 0
    job: ReviewJob | None
    moves: list[ReviewedMove]
    accuracy: GameAccuracy | None


class GameAnalysis(Contract):
    report: GameReviewReport | None
    score: Score | None
    best_move: str | None


class RefinementInfo(Contract):
    version: str
    task_id: str
    status: str
    triggers: list[str]
    adopted: bool
    reason: str | None
    baseline_depth: int
    refined_depth: int | None
    queries: int
