"""The one clock and the one way timestamps are read, stored and compared.

Every timestamp the app keeps is UTC. ``now()`` is the clock; ``as_utc`` turns a
naive value (which this app only ever writes as UTC) or an aware one into an aware
UTC value; ``stored_text`` is the exact text ``models.UTCDateTime`` writes, for raw
SQL that compares against a timestamp column.
"""

from datetime import datetime, timezone

# Sorts before every real timestamp, for "no date" in a sort key.
EARLIEST = datetime.min.replace(tzinfo=timezone.utc)


def now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """``value`` as an aware UTC datetime; a naive value is already UTC wall time."""
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


def stored_text(value: datetime) -> str:
    """The text a UTCDateTime column holds for ``value``: naive UTC with microseconds,
    which SQLite compares in time order."""
    return as_utc(value).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S.%f")
