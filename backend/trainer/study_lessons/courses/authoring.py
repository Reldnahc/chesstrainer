"""Small SAN authoring helpers; the course model validates the resulting graph."""

import chess

from trainer.study_lessons.content import Position


def position(san="", fen=chess.STARTING_FEN):
    board = chess.Board(fen)
    moves = [board.push_san(token).uci() for token in san.split()]
    return Position(initial_fen=fen, moves=tuple(moves))


def step(kind, identity, title, text, san="", fen=chess.STARTING_FEN, **fields):
    return dict(
        kind=kind, id=identity, title=title, text=text, position=position(san, fen), **fields
    )


def demo(identity, title, text, before, after, next_step, fen=chess.STARTING_FEN):
    start, end = position(before, fen), position(after, fen)
    if end.moves[: len(start.moves)] != start.moves:
        raise ValueError("A demonstration must continue its starting history")
    return step(
        "demonstration",
        identity,
        title,
        text,
        before,
        fen,
        moves=end.moves[len(start.moves) :],
        next_step=next_step,
    )


def decision(
    identity, title, text, before, san, reply, next_step, feedback, hint, fen=chess.STARTING_FEN
):
    board = position(before, fen).board()
    move = board.push_san(san).uci()
    replies = [board.push_san(reply).uci()] if reply else []
    return step(
        "decision",
        identity,
        title,
        text,
        before,
        fen,
        hint=hint,
        choices=[dict(uci=move, reply=replies, next_step=next_step, feedback=feedback)],
    )
