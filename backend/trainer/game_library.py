"""Display metadata from saved PGNs; no engine or remote profile requests."""

import io
from math import isfinite

import chess.pgn


def parsed_game(game):
    """A saved game's PGN, parsed."""
    return chess.pgn.read_game(io.StringIO(game.pgn))


def board_before(parsed, ply):
    """The position before mainline move ``ply`` (1-based), with its full history.

    None when the game has no move ``ply``.
    """
    board = parsed.board()
    for index, move in enumerate(parsed.mainline_moves(), start=1):
        if index == ply:
            return board
        board.push(move)
    return None


# The rating a review assumes when the game records none.
DEFAULT_RATING = 1000


def mover_rating(parsed, color, fallback):
    """The rating every review grade uses for ``color``'s moves: the PGN's, else ``fallback``.

    Review badges, Insights and Play all grade a move against this, so a blunder
    counts the same on every screen.
    """
    return pgn_rating(parsed, color) or fallback or DEFAULT_RATING


def pgn_rating(parsed, color):
    """The actual moving player's recorded rating; an absent value is not zero.

    Accepts a parsed game or its headers alone.
    """
    headers = getattr(parsed, "headers", parsed)
    try:
        value = int(headers.get("WhiteElo" if color else "BlackElo", ""))
        return value if 0 < value <= 4000 else None
    except (ValueError, TypeError):
        return None


def parse_time_control(value: str | None):
    """A PGN TimeControl tag as validated stages, or None when it gives none.

    Surrounding whitespace is ignored. "?" (unknown) and "-" (no limit) have no
    stages, and a value with a negative or non-finite stage is rejected.
    """
    value = (value or "").strip()
    if value in {"", "?", "-"}:
        return None
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
    return control


def time_control_label(value: str | None) -> str | None:
    if (value or "").strip() == "-":
        return "Unlimited"
    control = parse_time_control(value)
    if control is None:
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
