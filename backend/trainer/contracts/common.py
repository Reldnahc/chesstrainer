from typing import Literal

from pydantic import BaseModel, ConfigDict

from trainer.job_lifecycle import JobStatus as Status

Color = Literal["white", "black"]
JobStatusName = Literal[tuple(status.value for status in Status)]


class Contract(BaseModel):
    # Detect accidental additions as well as missing/wrongly typed output fields.
    model_config = ConfigDict(extra="forbid")


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
