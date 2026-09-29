"""Small local provider boundary; no production packs or acquisition in this phase."""

from collections.abc import Iterable
from typing import Protocol

from sqlalchemy.orm import Session

from trainer.contracts.puzzles import PuzzleSource
from trainer.puzzles.definitions import PuzzleDefinition


class PuzzleProvider(Protocol):
    id: str
    name: str
    source: PuzzleSource

    def catalog(self, db: Session) -> Iterable[PuzzleDefinition]:
        """Return installed definitions visible to the bound account, without network work."""
        ...


class PuzzleProviders:
    def __init__(self, providers: Iterable[PuzzleProvider] = ()):
        self.providers = tuple(providers)
        if len({provider.id for provider in self.providers}) != len(self.providers):
            raise ValueError("Duplicate puzzle provider ID")

    def catalog(self, db: Session):
        for provider in self.providers:
            seen = set()
            for definition in provider.catalog(db):
                # Validate even a provider returning raw records or constructed models.
                record = (
                    definition.model_dump()
                    if isinstance(definition, PuzzleDefinition)
                    else definition
                )
                definition = PuzzleDefinition.model_validate(record)
                identity = (definition.key, definition.version)
                if identity in seen or definition.source != provider.source:
                    raise ValueError("Inconsistent puzzle provider catalogue")
                seen.add(identity)
                yield provider, definition
