"""Serve the account's own-game puzzles; the account-bound session does the filtering."""

from sqlalchemy import select

from trainer.models import GamePuzzle
from trainer.puzzles.definitions import PuzzleDefinition
from trainer.puzzles.generation import GENERATOR_VERSION, PROVIDER_ID
from trainer.recent_cache import RecentCache

# Validating a definition replays its line. A ready puzzle row never changes, so
# each is validated once per process; the most recently used are kept.
DEFINITIONS_KEPT = 4096


class GamePuzzleProvider:
    id = PROVIDER_ID
    name = "From your games"
    source = "games"
    attribution = "Built from your imported games"
    url = None

    def __init__(self):
        self._definitions = RecentCache(DEFINITIONS_KEPT)

    def _definition(self, row_id, record):
        return self._definitions.get_or_make(
            row_id, lambda: PuzzleDefinition.model_validate(record)
        )

    @staticmethod
    def _ready():
        return select(GamePuzzle.id, GamePuzzle.definition).where(
            GamePuzzle.status == "ready", GamePuzzle.generator_version == GENERATOR_VERSION
        )

    def catalog(self, db):
        rows = db.execute(self._ready().order_by(GamePuzzle.created_at.desc(), GamePuzzle.id))
        return tuple(self._definition(row_id, record) for row_id, record in rows)

    def find(self, db, key: str, version: str) -> PuzzleDefinition | None:
        if version != GENERATOR_VERSION:
            return None
        game_id, _, ply = key.rpartition(":")
        if not game_id or not ply.isdigit():
            return None
        row = db.execute(
            self._ready().where(GamePuzzle.game_id == game_id, GamePuzzle.ply == int(ply))
        ).first()
        return None if row is None else self._definition(*row)
