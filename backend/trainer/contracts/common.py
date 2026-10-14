from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from trainer.job_lifecycle import JobStatus as Status

Color = Literal["white", "black"]
JobStatusName = Literal[tuple(status.value for status in Status)]


class Contract(BaseModel):
    # Detect accidental additions as well as missing/wrongly typed output fields.
    model_config = ConfigDict(extra="forbid")


# Moves the client sends: either one UCI string, or a board's from/to squares.
UciMove = Annotated[str, Field(pattern="^[a-h][1-8][a-h][1-8][qrbn]?$")]
Square = Annotated[str, Field(pattern="^[a-h][1-8]$")]


class SquareMove(Contract):
    from_square: Square
    to_square: Square
    promotion: Literal["q", "r", "b", "n"] | None = None

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
