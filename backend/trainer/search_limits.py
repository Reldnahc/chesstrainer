"""Search profiles and explicit limits; engine identity and caching remain in Stockfish."""

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import Field

from trainer.contracts.common import Contract


class EngineCancelled(RuntimeError):
    """No partial search result may be stored under a completed-search cache key."""


class SearchLimits(Contract):
    depth: int = Field(ge=1, le=50)
    time: float = Field(gt=0, le=60)
    nodes: int | None = Field(default=None, ge=1)


@dataclass(frozen=True)
class SearchProfile:
    """Where one search's limits come from, as one whole choice.

    Use ``TRIAGE``, ``DEEP`` or ``PROBE``, or build one with ``extending`` or
    ``explicit``; a profile cannot mix two sources. ``Stockfish`` resolves it
    against its settings in ``engine.search_config``.
    """

    kind: Literal["triage", "deep", "probe", "reference", "explicit"]
    # The saved analysis whose limits a "reference" search reuses.
    reference: Any = None
    limits: SearchLimits | None = None

    def __post_init__(self):
        if (self.reference is not None) != (self.kind == "reference"):
            raise ValueError("Only a reference profile carries a reference analysis")
        if (self.limits is not None) != (self.kind == "explicit"):
            raise ValueError("Only an explicit profile carries search limits")

    @classmethod
    def extending(cls, reference):
        """Search more moves at the exact limits of a saved grading analysis."""
        return cls("reference", reference=reference)

    @classmethod
    def explicit(cls, limits: SearchLimits):
        return cls("explicit", limits=limits)

    @property
    def single_line(self):
        """Whether the search shows one line unless asked for more; the other
        profiles default to the configured MultiPV."""
        return self.kind in {"triage", "probe"}


# Fast first-pass limits from settings.
TRIAGE = SearchProfile("triage")
# Grading limits from settings.
DEEP = SearchProfile("deep")
# The classification probe's limits from settings, with no node cap.
PROBE = SearchProfile("probe")
