"""Provider-neutral import requests and normalized, checkpointable batches."""

from collections.abc import Callable, Generator
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from pydantic import BaseModel, Field, field_validator, model_validator


class ProviderError(RuntimeError):
    pass


class ProviderRateLimited(ProviderError):
    """Pause requests to this provider across all accounts on the host."""

    retry_after = 60


class ImportCancelled(RuntimeError):
    pass


class ProviderImportRequest(BaseModel):
    analyze: bool = Field(default=True, exclude=True)
    username: str = Field(min_length=1, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    time_class: str = "rapid"
    months: int = Field(default=3, ge=0, le=120)
    max_games: int = Field(default=100, ge=1, le=1000)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("From date must be on or before To date.")
        return self


@dataclass(frozen=True)
class ProviderBatch:
    key: str
    games: list[dict]
    total: int | None = None
    # Every record key this batch completes when a provider groups several
    # independently keyed records into one checkpointed write. Defaults to the key.
    keys: tuple[str, ...] | None = None

    def checkpoint_keys(self) -> tuple[str, ...]:
        return self.keys or (self.key,)


def check_cancel(cancelled):
    if cancelled():
        raise ImportCancelled()


class GameProviderClient(Protocol):
    """Adapters own transport/normalization; the shared pipeline owns persistence.

    Batches are newest first and use stable keys across retries. Closing the
    generator must release any active network response. PGNs remain authoritative.
    """

    def batches(
        self, request, anchor: datetime, cancelled: Callable[[], bool], completed: set[str]
    ) -> Generator[ProviderBatch, None, None]: ...

    def close(self) -> None: ...
