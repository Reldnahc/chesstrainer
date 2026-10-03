"""Playing a game against the selected coach: setup, moves, commentary and the level fit."""

from typing import Literal

from pydantic import Field, model_validator

from trainer.contracts.common import Color, Contract
from trainer.contracts.games import GameFrame
from trainer.contracts.preferences import CoachId

OpponentKind = Literal["human", "engine"]
PlayStatus = Literal["active", "finished"]

# Human-like play comes from the Maia policy, whose rating dial was measured to
# scale strength smoothly up to about 2500. Engine play uses Stockfish's own
# strength limit, which cannot imitate anyone weaker than a strong club player.
HUMAN_RATINGS = (600, 2500)
ENGINE_RATINGS = (1800, 2600)
FALLBACK_LEARNER_RATING = 1200


class PlayRequest(Contract):
    coach_id: CoachId
    coach_name: str = Field(min_length=1, max_length=40)
    color: Literal["white", "black", "random"] = "random"
    opponent: OpponentKind = "human"
    rating: int = Field(ge=600, le=2600)

    @model_validator(mode="after")
    def rating_within_the_opponent_range(self):
        low, high = HUMAN_RATINGS if self.opponent == "human" else ENGINE_RATINGS
        if not low <= self.rating <= high:
            raise ValueError(f"{self.opponent} opponents play between {low} and {high}")
        return self


class PlayMoveRequest(Contract):
    ply: int = Field(ge=0, le=1024)
    uci: str = Field(min_length=4, max_length=5)


class PlyRequest(Contract):
    ply: int = Field(ge=1, le=1024)


class PlayReply(Contract):
    ply: int
    san: str
    uci: str
    source: Literal["human", "engine", "fallback"]


class PlayState(Contract):
    id: str
    coach_id: str
    coach_name: str
    white: str
    black: str
    learner_color: Color
    opponent: OpponentKind
    rating: int
    learner_rating: int
    white_rating: int
    black_rating: int
    status: PlayStatus
    result: str | None
    termination: str | None
    saved_game_id: str | None
    reply: PlayReply | None
    frames: list[GameFrame]


class ActivePlay(Contract):
    game: PlayState | None


class PlayProfile(Contract):
    status: Literal["ready", "computing", "unavailable", "no_games", "disabled"]
    fitted_rating: int | None
    platform_rating: int | None
    platform: str | None
    positions: int
    games: int
    computed_at: str | None
    # The rating a "match my level" game uses right now: the fit when it exists.
    default_rating: int
