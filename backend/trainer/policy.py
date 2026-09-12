from typing import Literal

from pydantic import BaseModel

from trainer.chess_core import Candidate, Score, evaluation_loss
from trainer.config import Settings


class MovePolicy(BaseModel):
    version: str = "1"
    mode: Literal["best_only", "engine_tolerance", "practical", "custom"] = "practical"
    tolerance_cp: int = 100
    failure_cp: int = 150

    @classmethod
    def from_settings(cls, settings: Settings):
        tolerance = (
            settings.practical_tolerance_cp
            if settings.acceptance_mode == "practical"
            else settings.tolerance_cp
        )
        return cls(
            mode=settings.acceptance_mode,
            tolerance_cp=tolerance,
            failure_cp=max(tolerance + 1, settings.mistake_threshold_cp),
        )

    def grade(self, best: Candidate, uci: str, score: Score) -> str:
        if uci == best.uci:
            return "correct"
        if self.mode == "best_only":
            return "failure"
        loss = evaluation_loss(best.score, score)
        if loss.mate_lost or loss.allows_mate:
            return "failure"
        if loss.cp is None:
            # Mate length is not a pseudo-centipawn loss. Preserve winning mate; in already
            # forced-lost positions, avoid pretending a longer loss is a pedagogical win.
            return "acceptable" if score.outcome() >= best.score.outcome() else "failure"
        if loss.cp <= self.tolerance_cp:
            return "acceptable"
        return "inaccuracy" if loss.cp < self.failure_cp else "failure"

    def meaningful(self, best: Score, played: Score) -> bool:
        loss = evaluation_loss(best, played)
        return (
            loss.mate_lost
            or loss.allows_mate
            or (loss.cp is not None and loss.cp >= self.failure_cp)
        )
