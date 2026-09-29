"""Pinned named lines from the bundled catalogue, never a network/engine lookup."""

import csv
import io
from functools import cache
from importlib.resources import files
from threading import Lock

import chess.pgn
from fastapi import HTTPException

from trainer._vendor import lichess_openings
from trainer.chess_core import digest
from trainer.contracts.opening_studies import OpeningCatalogue, OpeningLine, OpeningLineSummary
from trainer.opening_book import VERSION
from trainer.study_lessons.content import Position

_lock = Lock()


@cache
def _load():
    records = {}
    for volume in "abcde":
        text = files(lichess_openings).joinpath(f"{volume}.tsv").read_text(encoding="utf-8")
        for row in csv.DictReader(io.StringIO(text), delimiter="\t"):
            game = chess.pgn.read_game(io.StringIO(row["pgn"]))
            if game is None or game.errors:
                raise ValueError(f"Invalid bundled opening: {row['name']}")
            moves = [move.uci() for move in game.mainline_moves()]
            initial_fen = game.board().fen()
            Position(initial_fen=initial_fen, moves=tuple(moves))
            key = digest(
                {"eco": row["eco"], "name": row["name"], "fen": initial_fen, "moves": moves}
            )
            records[key] = OpeningLine(
                source="lichess_catalogue",
                source_key=key,
                source_version=VERSION,
                name=row["name"],
                eco=row["eco"],
                initial_fen=initial_fen,
                moves=moves,
            )
    return records


def lines():
    # functools.cache alone can duplicate the initial parse on concurrent requests.
    with _lock:
        return tuple(_load().values())


def get(key, version=None):
    with _lock:
        line = _load().get(key)
    if line is None or (version is not None and version != line.source_version):
        raise HTTPException(404, "Opening catalogue revision not installed")
    return line.model_copy(deep=True)


def search(db, q="", eco="", offset=0, limit=40):
    query, code = q.strip().casefold(), eco.strip().upper()
    matches = [
        line
        for line in lines()
        if (not query or query in f"{line.eco} {line.name}".casefold())
        and (not code or line.eco.startswith(code))
    ]
    return OpeningCatalogue(
        version=VERSION,
        total=len(matches),
        items=[
            OpeningLineSummary(
                source_key=line.source_key,
                source_version=line.source_version,
                name=line.name,
                eco=line.eco,
                plies=len(line.moves),
                white_positions=(len(line.moves) + 1) // 2,
                black_positions=len(line.moves) // 2,
            )
            for line in matches[offset : offset + limit]
        ],
    )


def detail(db, key):
    from trainer.opening_studies.sources import line_view

    return line_view(get(key))
