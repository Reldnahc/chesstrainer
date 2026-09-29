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
