"""Small browser-only provider; production imports neither this module nor its data."""

import chess
from trainer.puzzles.definitions import PuzzleDefinition


class BrowserPuzzleProvider:
    id = "browser-fixtures"
    name = "Development fixtures"
    source = "generic"

    def __init__(self):
        self._accounts = {}

    def catalog(self, db):
        return tuple(self._accounts.get(db.info["user_id"], {}).values())

    def install(self, user_id, key):
        promotion = key.startswith("promotion-")
        definition = PuzzleDefinition(
            key=key,
            version="fixture-v1",
            source="generic",
            initial_fen=("4k3/P7/8/8/8/8/8/4K3 w - - 0 1" if promotion else chess.STARTING_FEN),
            orientation="white",
            solution=("a7a8q",) if promotion else ("e2e4", "e7e5", "g1f3"),
            themes=("promotion",) if promotion else (),
            provenance={"attribution": "Original development fixture"},
        )
        self._accounts.setdefault(user_id, {})[key] = definition
        return definition


class BrowserGamePuzzleProvider:
    """A games-source fixture; its provenance names a game the spec only links to."""

    id = "browser-game-fixtures"
    name = "From your games"
    source = "games"
    attribution = "Built from your imported games"
    url = None

    def __init__(self):
        self._accounts = {}

    def catalog(self, db):
        return tuple(self._accounts.get(db.info["user_id"], {}).values())

    def install(self, user_id, key):
        definition = PuzzleDefinition(
            key=key,
            version="fixture-games-v1",
            source="games",
            # Nd5+ forks king and rook; Nxb6+ collects it with a pawn left to win.
            initial_fen="8/4k3/1r6/8/8/2N5/7P/4K3 w - - 0 1",
            orientation="white",
            solution=("c3d5", "e7d7", "d5b6"),
            themes=("fork", "crushing", "short", "endgame"),
            provenance={
                "attribution": (
                    "Your game as White vs fixture-opponent · 2026.10.01 · move 14. "
                    "You played Ne4."
                ),
                "url": None,
                "game_id": "fixture-game",
                "source_ply": 27,
            },
        )
        self._accounts.setdefault(user_id, {})[key] = definition
        return definition
