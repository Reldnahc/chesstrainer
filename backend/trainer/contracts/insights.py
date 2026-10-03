from typing import Literal

from trainer.contracts.common import Color, Contract

Speed = Literal["bullet", "blitz", "rapid", "classical", "daily"]
Outcome = Literal["win", "draw", "loss", "unfinished"]


class InsightGame(Contract):
    id: str
    opponent: str
    opponent_rating: int | None
    result: Outcome
    played_on: str | None
    ply: int | None


class RhythmCell(Contract):
    weekday: int
    part: Literal["night", "morning", "afternoon", "evening"]
    wins: int
    draws: int
    losses: int


class Rhythm(Contract):
    dated_games: int
    cells: list[RhythmCell]


class Ending(Contract):
    termination: str
    games: int


class Endings(Contract):
    win: list[Ending]
    draw: list[Ending]
    loss: list[Ending]


class Records(Contract):
    longest_win_streak: int
    longest_loss_streak: int
    current_win_streak: int
    best_win: InsightGame | None


class RatingPoint(Contract):
    date: str
    rating: int


class RatingSeries(Contract):
    site: str
    speed: str
    games: int
    first: int
    last: int
    points: list[RatingPoint]


class OpeningRecord(Contract):
    name: str
    color: Color
    games: int
    wins: int
    draws: int
    losses: int
    score: int | None
    accuracy: float | None
    reviewed_games: int


class TheoryOpening(Contract):
    name: str
    cost_cp: int
    games: int


class Theory(Contract):
    reviewed_games: int
    exits: int
    costly_exits: int
    average_exit_move: float | None
    average_cost_cp: float | None
    openings: list[TheoryOpening]


class Conversion(Contract):
    winning_games: int
    converted: int
    drawn: int
    lost: int
    slips: list[InsightGame]


class Escapes(Contract):
    lost_games: int
    won: int
    drawn: int
    still_lost: int
    saves: list[InsightGame]


class Bucket(Contract):
    label: str
    games: int


class Momentum(Contract):
    reviewed_games: int
    conversion: Conversion
    slip_moves: list[Bucket]
    escapes: Escapes


class Shape(Contract):
    shape: Literal["wire_to_wire", "back_and_forth", "unsettled", "slipped", "comeback"]
    games: int
    wins: int
    draws: int
    losses: int
    examples: list[InsightGame]


class MoveBucket(Contract):
    label: str
    moves: int
    accuracy: float | None


class PhaseRate(Contract):
    phase: Literal["opening", "middlegame", "endgame"]
    moves: int
    accuracy: float | None
    blunders_per_100: float | None


class MoveRates(Contract):
    reviewed_games: int
    by_move: list[MoveBucket]
    by_phase: list[PhaseRate]


class TiltRate(Contract):
    games: int
    blunders_per_100: float | None


class Rematches(Contract):
    games: int
    wins: int
    draws: int
    losses: int


class Tilt(Contract):
    after_loss: TiltRate
    after_other: TiltRate
    rematches_after_loss: Rematches


class ThinkTime(Contract):
    label: str
    seconds: float | None


class ClockBand(Contract):
    band: Literal["over_half", "quarter", "tenth", "under_tenth"]
    moves: int
    blunder_rate: float | None


class ClockStory(Contract):
    clocked_games: int
    time_trouble_games: int
    think_seconds: list[ThinkTime]
    blunders_by_clock: list[ClockBand]


class Punishment(Contract):
    opponent_errors: int
    punished: int
    own_errors: int
    unpunished: int


class EndgameRecord(Contract):
    kind: Literal["rook", "queen", "minor", "pawn"]
    games: int
    held: int


class Insights(Contract):
    version: str
    speed: Literal["all", "bullet", "blitz", "rapid", "classical", "daily"]
    days: int | None
    speeds: list[Speed]
    games: int
    reviewed_games: int
    wins: int
    draws: int
    losses: int
    rhythm: Rhythm
    endings: Endings
    records: Records
    ratings: list[RatingSeries]
    openings: list[OpeningRecord]
    theory: Theory
    momentum: Momentum
    shapes: list[Shape]
    moves: MoveRates
    tilt: Tilt
    clock: ClockStory
    punishment: Punishment
    endgames: list[EndgameRecord]
