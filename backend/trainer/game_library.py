"""Display metadata from saved PGNs; no engine or remote profile requests."""

from math import isfinite

import chess.pgn


def pgn_rating(parsed, color):
    """The actual moving player's recorded rating; an absent value is not zero."""
    try:
        value = int(parsed.headers.get("WhiteElo" if color else "BlackElo", ""))
        return value if 0 < value <= 4000 else None
    except (ValueError, TypeError):
        return None


def time_control_label(value: str | None) -> str | None:
    if not value or value.strip() in {"?", ""}:
        return None
    value = value.strip()
    if value == "-":
        return "Unlimited"
    try:
        control = chess.pgn.parse_time_control(value)
    except (ValueError, IndexError, OverflowError):
        return None
    if not control.parts or any(
        part.time < 0
        or part.moves < 0
        or not isfinite(part.increment)
        or not isfinite(part.delay)
        or part.increment < 0
        or part.delay < 0
        for part in control.parts
    ):
        return None

    def duration(seconds):
        return f"{seconds / 60:g} min" if seconds >= 60 else f"{seconds:g} sec"

    labels = []
    for part in control.parts:
        if part.moves == 1 and part.time >= 86400 and part.time % 86400 == 0:
            days = part.time // 86400
            label = f"{days} {'day' if days == 1 else 'days'} / move"
        else:
            label = duration(part.time)
            if part.moves:
                label = f"{part.moves} moves / {label}"
        if part.increment:
            label += f" + {part.increment:g} sec"
        if part.delay:
            label += f" + {part.delay:g} sec delay"
        labels.append(label)
    return "; then ".join(labels)
