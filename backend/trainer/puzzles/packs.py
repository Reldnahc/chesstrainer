"""Local, hash-pinned Lichess-compatible puzzle packs. Solving never needs the network.

A pack is a directory with ``manifest.json`` and one CSV in the public Lichess
puzzle layout: ``PuzzleId,FEN,Moves,Rating,...,Themes,...``. The FEN is the
position before the opponent's setup move; token 1 of ``Moves`` is that setup
move and the remaining tokens are the solver's line. The manifest pins the CSV
by SHA-256 so a silently edited or truncated file cannot be served as the
versioned pack it claims to be.
"""

import csv
import hashlib
import io
import threading
from functools import cache
from importlib.resources import files
from typing import Literal

from pydantic import Field, ValidationError

from trainer.chess_core import legal_move, valid_board
from trainer.contracts.common import Contract
from trainer.contracts.puzzles import PuzzleProvenance
from trainer.puzzles.definitions import PuzzleDefinition

MANIFEST = "manifest.json"
REQUIRED_COLUMNS = frozenset({"PuzzleId", "FEN", "Moves"})
STARTER_PACKAGE = "trainer.puzzles.starter_pack"


class PackError(ValueError):
    """The pack cannot be served: a missing/invalid manifest, hash mismatch or bad row."""


class PackManifest(Contract):
    format: Literal["lichess-csv-v1"]
    id: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str = Field(min_length=1, max_length=200)
    version: str = Field(min_length=1, max_length=100)
    license: str = Field(min_length=1, max_length=100)
    attribution: str = Field(min_length=1, max_length=500)
    url: str | None = None
    puzzle_url: str | None = None
    file: str = Field(pattern=r"^[A-Za-z0-9._-]+\.csv$")
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    count: int = Field(ge=1)
    build: dict[str, object] = {}
    # Engine evidence written by scripts/verify_puzzle_pack.py --record; see STUDY.md.
    verification: dict[str, object] | None = None


def definition_from_row(
    fields: dict[str, str],
    *,
    version: str,
    attribution: str,
    puzzle_url: str | None = None,
) -> PuzzleDefinition:
    """Convert one Lichess-layout row into a validated learner-to-move definition."""
    puzzle_id = (fields.get("PuzzleId") or "").strip()
    if not puzzle_id:
        raise PackError("Row has no PuzzleId")
    moves = (fields.get("Moves") or "").split()
    if len(moves) < 2:
        raise PackError(f"{puzzle_id}: Moves needs an opponent setup move and a solution")
    try:
        board = valid_board(fields.get("FEN") or "")
        board.push(legal_move(board, moves[0]))
    except ValueError as exc:
        raise PackError(f"{puzzle_id}: {exc}") from exc
    rating = (fields.get("Rating") or "").strip()
    try:
        return PuzzleDefinition(
            key=puzzle_id,
            version=version,
            source="generic",
            initial_fen=board.fen(),
            orientation="white" if board.turn else "black",
            solution=tuple(moves[1:]),
            themes=tuple(sorted(set((fields.get("Themes") or "").split()))),
            rating=int(rating) if rating.isdigit() else None,
            provenance=PuzzleProvenance(
                attribution=f"{attribution} · puzzle {puzzle_id}",
                url=puzzle_url.format(id=puzzle_id) if puzzle_url else None,
            ),
        )
    except ValidationError as exc:
        raise PackError(f"{puzzle_id}: {exc.errors()[0]['msg']}") from exc


def read_manifest(directory) -> PackManifest:
    try:
        text = directory.joinpath(MANIFEST).read_text(encoding="utf-8")
    except OSError as exc:
        raise PackError(f"Puzzle pack manifest is unreadable: {exc}") from exc
    try:
        manifest = PackManifest.model_validate_json(text)
    except ValidationError as exc:
        raise PackError(f"Puzzle pack manifest is invalid: {exc.errors()[0]['msg']}") from exc
    if manifest.puzzle_url is not None:
        try:
            manifest.puzzle_url.format(id="example")
        except (KeyError, IndexError, ValueError) as exc:
            raise PackError(
                "Puzzle pack manifest puzzle_url must be a template that uses only {id}"
            ) from exc
    return manifest


def load_pack(directory) -> tuple[PackManifest, tuple[PuzzleDefinition, ...]]:
    """Verify the pinned CSV and validate every row; a pack is served whole or not at all."""
    manifest = read_manifest(directory)
    try:
        data = directory.joinpath(manifest.file).read_bytes()
    except OSError as exc:
        raise PackError(f"Puzzle pack file is unreadable: {exc}") from exc
    digest = hashlib.sha256(data).hexdigest()
    if digest != manifest.sha256:
        raise PackError(
            f"Puzzle pack {manifest.id} file {manifest.file} does not match its pinned hash"
        )
    try:
        reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig"), newline=""), strict=True)
        if not reader.fieldnames or not REQUIRED_COLUMNS <= set(reader.fieldnames):
            raise PackError(f"Puzzle pack {manifest.id} CSV needs PuzzleId, FEN and Moves columns")
        definitions, keys = [], set()
        for number, fields in enumerate(reader, 2):
            if None in fields or any(value is None for value in fields.values()):
                raise PackError(f"Puzzle pack {manifest.id} row {number} has a column mismatch")
            try:
                definition = definition_from_row(
                    fields,
                    version=manifest.version,
                    attribution=manifest.attribution,
                    puzzle_url=manifest.puzzle_url,
                )
            except PackError as exc:
                raise PackError(f"Puzzle pack {manifest.id} row {number}: {exc}") from exc
            if definition.key in keys:
                raise PackError(f"Puzzle pack {manifest.id} repeats puzzle {definition.key}")
            keys.add(definition.key)
            definitions.append(definition)
    except (csv.Error, UnicodeDecodeError) as exc:
        raise PackError(f"Puzzle pack {manifest.id} CSV is unreadable: {exc}") from exc
    if len(definitions) != manifest.count:
        raise PackError(
            f"Puzzle pack {manifest.id} holds {len(definitions)} puzzles, manifest says "
            f"{manifest.count}"
        )
    return manifest, tuple(definitions)


class PackProvider:
    """Serves one pinned pack. Definitions validate once per process and never change."""

    source = "generic"

    def __init__(self, directory, *, provider_id: str | None = None):
        self.directory = directory
        self.manifest = read_manifest(directory)
        self.id = provider_id or self.manifest.id
        self.name = self.manifest.name
        self.attribution = self.manifest.attribution
        self.url = self.manifest.url
        self._lock = threading.Lock()
        self._definitions: tuple[PuzzleDefinition, ...] | None = None
        self._index: dict[tuple[str, str], PuzzleDefinition] = {}

    def load(self) -> tuple[PuzzleDefinition, ...]:
        with self._lock:
            if self._definitions is None:
                _, definitions = load_pack(self.directory)
                self._index = {(item.key, item.version): item for item in definitions}
                self._definitions = definitions
            return self._definitions

    def catalog(self, db):
        return self.load()

    def find(self, db, key: str, version: str) -> PuzzleDefinition | None:
        self.load()
        return self._index.get((key, version))


@cache
def starter_pack() -> PackProvider:
    """The small bundled CC0 Lichess selection; see starter_pack/README.md."""
    return PackProvider(files(STARTER_PACKAGE))


def production_providers(settings) -> tuple:
    """Local packs plus the account's own-game puzzles; nothing is fetched at runtime.

    A configured installed pack is verified at startup.
    """
    from trainer.puzzles.game_provider import GamePuzzleProvider

    providers = []
    if settings.puzzle_starter_pack:
        providers.append(starter_pack())
    if settings.puzzle_pack_path is not None:
        installed = PackProvider(settings.puzzle_pack_path)
        installed.load()
        providers.append(installed)
    providers.append(GamePuzzleProvider())
    return tuple(providers)
