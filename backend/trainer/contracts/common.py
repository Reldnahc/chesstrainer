from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from trainer.job_kinds import JobKind, JobStatus

Color = Literal["white", "black"]
JobStatusName = Literal[tuple(status.value for status in JobStatus)]
JobKindName = Literal[tuple(kind.value for kind in JobKind)]


class Contract(BaseModel):
    # Detect accidental additions as well as missing/wrongly typed output fields.
    model_config = ConfigDict(extra="forbid")


def from_row(contract, row, **computed):
    """The fields ``contract`` declares, read off an ORM row, plus computed ones.

    Only declared fields are read, so a new table column is neither exposed nor
    a validation failure until the contract chooses to include it.
    """
    return {
        name: getattr(row, name)
        for name in contract.model_fields
        if name not in computed and hasattr(row, name)
    } | computed


def _distinct_squares(uci: str) -> str:
    # python-chess refuses a move that starts and ends on one square (only the
    # null move "0000" may), so such a request is invalid input, not a server error.
    if uci[:2] == uci[2:4]:
        raise ValueError("A move must leave its square")
    return uci


# Moves the client sends: either one UCI string, or a board's from/to squares.
UciMove = Annotated[
    str, Field(pattern="^[a-h][1-8][a-h][1-8][qrbn]?$"), AfterValidator(_distinct_squares)
]
Square = Annotated[str, Field(pattern="^[a-h][1-8]$")]


class SquareMove(Contract):
    from_square: Square
    to_square: Square
    promotion: Literal["q", "r", "b", "n"] | None = None

    @model_validator(mode="after")
    def _leaves_its_square(self):
        _distinct_squares(self.uci)
        return self

    @property
    def uci(self) -> str:
        return self.from_square + self.to_square + (self.promotion or "")


class LegalMove(Contract):
    from_square: str
    to_square: str
    promotion: Literal["q", "r", "b", "n"] | None
    capture: bool


class JobCreated(Contract):
    job_id: str


class JobStarted(JobCreated):
    status: JobStatusName


class JobStatus(Contract):
    status: JobStatusName


class CreatedId(Contract):
    id: str


class Rejected(Contract):
    rejected: bool


class Ok(Contract):
    ok: bool


class ApiError(Contract):
    detail: str
