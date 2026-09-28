"""Ratings and domain provenance describe conditioning, never calibrated player odds."""

import re
from urllib.parse import urlsplit

import chess

from trainer.chess_core import engine_context
from trainer.game_library import pgn_rating
from trainer.human_models.types import Conditioning, Domain, HumanRequest


def source_domain(parsed, board):
    site = parsed.headers.get("Site", "").strip().lower()
    try:
        host = urlsplit(site).hostname if "://" in site else site
    except ValueError:
        host = None
    platform = "unknown"
    for suffix, name in (("lichess.org", "lichess"), ("chess.com", "chesscom")):
        if host and (host == suffix or host.endswith("." + suffix)):
            platform = name
    event = parsed.headers.get("Event", "").lower()
    match = re.search(r"\b(blitz|rapid|bullet|classical|correspondence)\b", event)
    speed = match[1] if match else None
    time_control = parsed.headers.get("TimeControl")
    if time_control in {None, "?", "-", ""}:
        time_control = None
    reasons = []
    alignment = "unknown"
    if platform == "chesscom" or speed and speed != "blitz":
        alignment = "shifted"
        reasons.append("outside_lichess_blitz_training_domain")
    elif platform == "lichess" and speed == "blitz":
        alignment = "related"
    else:
        reasons.append("source_or_speed_unknown")
    full = board.root().fen() == chess.STARTING_FEN
    if not full:
        reasons.append("pre_setup_history_unknown")
    return Domain(
        platform=platform,
        time_control=time_control,
        time_class=speed,
        alignment=alignment,
        history_from_start=full,
        reasons=reasons,
    )


def request_for(parsed, board, fallback):
    own, opponent = pgn_rating(parsed, board.turn), pgn_rating(parsed, not board.turn)
    return HumanRequest(
        history=engine_context(board),
        mover="white" if board.turn else "black",
        conditioning=Conditioning(
            self_rating=own if own is not None else fallback,
            opponent_rating=opponent if opponent is not None else fallback,
            self_source="pgn" if own is not None else "fallback",
            opponent_source="pgn" if opponent is not None else "fallback",
        ),
        domain=source_domain(parsed, board),
    )
