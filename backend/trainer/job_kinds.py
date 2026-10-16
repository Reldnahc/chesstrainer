"""Job kinds and statuses: the only values ``analysis_jobs`` accepts (CHECK constraints)."""

from enum import StrEnum


class JobKind(StrEnum):
    GAME_REVIEW = "game_review"  # One game: review, then training decisions.
    CLASSIFICATION = "classification"  # Re-label every saved decision.
    ENRICHMENT = "enrichment"  # Extra engine probes for unsettled classifications.
    PUZZLE_GENERATION = "puzzle_generation"  # Mine analyzed games for puzzles.
    SYNC = "sync"  # The poller's fetch of new provider games.
    PROVIDER_FETCH = "provider_fetch"  # A manual import from any provider.
    LEVEL_FIT = "level_fit"  # Measure the learner's level for Play from their games.
    # Whole-import analysis from before per-game reviews. Nothing creates it now;
    # rows saved by older versions still run to completion.
    ANALYSIS = "analysis"
    # A job of a feature that has since been removed (teaching, for one). Kept as
    # history; it never runs and cannot be retried.
    RETIRED = "retired"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


def allowed(column, values):
    """A CHECK constraint's SQL: ``column`` holds one of ``values``."""
    return f"{column} IN ({', '.join(repr(str(value)) for value in values)})"
