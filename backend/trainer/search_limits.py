"""Explicit optional search limits; engine identity and caching remain in Stockfish."""

from pydantic import Field

from trainer.contracts.common import Contract


class EngineCancelled(RuntimeError):
    """No partial search result may be stored under a completed-search cache key."""


class SearchLimits(Contract):
    depth: int = Field(ge=1, le=50)
    time: float = Field(gt=0, le=60)
    nodes: int | None = Field(default=None, ge=1)
