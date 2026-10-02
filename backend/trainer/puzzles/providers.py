"""Small local provider boundary; packs and fixtures are installed explicitly, never fetched."""

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
        self._by_id = {provider.id: provider for provider in self.providers}

    @staticmethod
    def _checked(provider, definition) -> PuzzleDefinition:
        # A constructed definition already replayed its line; raw records validate here.
        if not isinstance(definition, PuzzleDefinition):
            definition = PuzzleDefinition.model_validate(definition)
        if definition.source != provider.source:
            raise ValueError("Inconsistent puzzle provider catalogue")
        return definition

    def provider_catalog(self, provider, db):
        seen = set()
        for definition in provider.catalog(db):
            definition = self._checked(provider, definition)
            identity = (definition.key, definition.version)
            if identity in seen:
                raise ValueError("Inconsistent puzzle provider catalogue")
            seen.add(identity)
            yield definition

    def catalog(self, db):
        for provider in self.providers:
            for definition in self.provider_catalog(provider, db):
                yield provider, definition

    def find(self, db, provider_id: str, key: str, version: str):
        """Exact definition lookup; providers with an index avoid a catalogue scan."""
        provider = self._by_id.get(provider_id)
        if provider is None:
            return None
        finder = getattr(provider, "find", None)
        if finder is not None:
            definition = finder(db, key, version)
            return None if definition is None else self._checked(provider, definition)
        return next(
            (
                definition
                for definition in self.provider_catalog(provider, db)
                if (definition.key, definition.version) == (key, version)
            ),
            None,
        )
