"""Serve the account's own-game puzzles; the account-bound session does the filtering."""

from sqlalchemy import select

from trainer.models import GamePuzzle
from trainer.puzzles.definitions import PuzzleDefinition
from trainer.puzzles.generation import GENERATOR_VERSION, PROVIDER_ID


class GamePuzzleProvider:
    id = PROVIDER_ID
    name = "From your games"
    source = "games"
    attribution = "Built from your imported games"
    url = None

    @staticmethod
    def _ready():
        return select(GamePuzzle.definition).where(
            GamePuzzle.status == "ready", GamePuzzle.generator_version == GENERATOR_VERSION
        )

    def catalog(self, db):
        rows = db.scalars(self._ready().order_by(GamePuzzle.created_at.desc(), GamePuzzle.id))
        return tuple(PuzzleDefinition.model_validate(definition) for definition in rows)

    def find(self, db, key: str, version: str) -> PuzzleDefinition | None:
        if version != GENERATOR_VERSION:
            return None
        game_id, _, ply = key.rpartition(":")
        if not game_id or not ply.isdigit():
            return None
        definition = db.scalar(
            self._ready().where(GamePuzzle.game_id == game_id, GamePuzzle.ply == int(ply))
        )
        return None if definition is None else PuzzleDefinition.model_validate(definition)
