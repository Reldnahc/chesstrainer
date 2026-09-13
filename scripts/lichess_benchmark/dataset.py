"""One-pass CSV sampling with memory bounded by selected themes and sample size."""

import csv
import gzip
import hashlib
import io
import random
from collections import Counter
from contextlib import ExitStack
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .themes import ThemeMapping

SAMPLING_VERSION = "independent-reservoir-v1"


class DatasetError(ValueError):
    pass


@dataclass(frozen=True)
class PuzzleRow:
    record_number: int
    fields: dict[str, str]
    problem: str | None = None
    extra_fields: tuple[str, ...] = ()

    @property
    def themes(self) -> tuple[str, ...]:
        return tuple(sorted(set(self.fields.get("Themes", "").split())))

    @property
    def puzzle_id(self) -> str | None:
        return self.fields.get("PuzzleId") or None


@dataclass
class Sample:
    rows: dict[str, list[PuzzleRow]]
    theme_counts: Counter
    rows_seen: int
    malformed_rows: int
    malformed_without_themes: int
    input_sha256: str
    input_bytes: int


class DigestReader(io.RawIOBase):
    """Hash original file bytes while CSV/decompressors consume bounded chunks."""

    def __init__(self, source):
        self.source = source
        self.digest = hashlib.sha256()
        self.bytes_read = 0

    def readable(self):
        return True

    def readinto(self, buffer):
        size = self.source.readinto(buffer)
        if size:
            self.digest.update(memoryview(buffer)[:size])
            self.bytes_read += size
        return size


class ZstdFramesReader(io.RawIOBase):
    """Validate frame completion, including concatenated frames.

    zstandard.stream_reader silently accepts a truncated final frame. The
    decompress-object EOF flag is needed for an honest complete-input claim.
    Small compressed chunks bound the decoded burst, including highly compressed
    repeated rows; no whole frame or dataset is buffered.
    """

    def __init__(self, source, zstandard):
        self.source = source
        self.zstandard = zstandard
        self.context = zstandard.ZstdDecompressor()
        self.decoder = None
        self.pending = memoryview(b"")

    def readable(self):
        return True

    def readinto(self, buffer):
        while not self.pending:
            compressed = self.source.read(256)
            if not compressed:
                if self.decoder is None or not self.decoder.eof:
                    raise DatasetError("Truncated or empty Zstandard frame; input is incomplete")
                return 0
            pieces = []
            while compressed:
                if self.decoder is None or self.decoder.eof:
                    self.decoder = self.context.decompressobj()
                try:
                    pieces.append(self.decoder.decompress(compressed))
                except self.zstandard.ZstdError as exc:
                    raise DatasetError(f"Invalid Zstandard input: {exc}") from exc
                compressed = self.decoder.unused_data if self.decoder.eof else b""
            self.pending = memoryview(b"".join(pieces))
        size = min(len(buffer), len(self.pending))
        buffer[:size] = self.pending[:size]
        self.pending = self.pending[size:]
        return size


def sample_dataset(
    path: Path,
    mappings: tuple[ThemeMapping, ...],
    count: int,
    seed: int,
    progress: Callable[[int], None] | None = None,
) -> Sample:
    if count < 1:
        raise ValueError("Sample count per motif must be positive")
    if not path.is_file():
        raise DatasetError(f"Dataset file not found: {path}")
    if path.suffix.lower() not in {".csv", ".gz", ".zst"}:
        raise DatasetError("Use a local .csv, .csv.gz or .csv.zst dataset")
    if not mappings:
        raise ValueError("At least one mapping is required")
    reservoirs = {mapping.theme: [] for mapping in mappings}
    generators = {
        theme: random.Random(
            int.from_bytes(
                hashlib.sha256(f"{SAMPLING_VERSION}:{seed}:{theme}".encode()).digest(), "big"
            )
        )
        for theme in reservoirs
    }
    seen, malformed, unassigned = 0, 0, 0
    themes_seen = Counter()
    before = path.stat()
    with ExitStack() as stack:
        file = stack.enter_context(path.open("rb"))
        hashing = DigestReader(file)
        raw = stack.enter_context(io.BufferedReader(hashing))
        decoded = raw
        if path.suffix.lower() == ".gz":
            decoded = stack.enter_context(gzip.GzipFile(fileobj=raw, mode="rb"))
        elif path.suffix.lower() == ".zst":
            try:
                import zstandard
            except ImportError as exc:
                raise DatasetError(
                    "Zstandard input needs the optional developer dependency: "
                    "python -m pip install -r scripts/lichess_benchmark/requirements.txt "
                    "(or decompress to CSV first)"
                ) from exc
            decoded = stack.enter_context(io.BufferedReader(ZstdFramesReader(raw, zstandard)))
        text = stack.enter_context(io.TextIOWrapper(decoded, encoding="utf-8-sig", newline=""))
        reader = csv.reader(text, strict=True)
        try:
            header = next(reader, None)
            if not header or not {"FEN", "Moves", "Themes"} <= set(header):
                raise DatasetError(
                    "CSV header must contain FEN, Moves and Themes; PuzzleId is optional"
                )
            if len(set(header)) != len(header):
                raise DatasetError("CSV header contains duplicate columns")
            for number, values in enumerate(reader, 2):
                if not values:
                    continue
                seen += 1
                fields = dict(zip(header, values))
                row = PuzzleRow(
                    number,
                    fields,
                    "column_count_mismatch" if len(values) != len(header) else None,
                    tuple(values[len(header) :]),
                )
                tags = row.themes
                themes_seen.update(tags)
                if row.problem:
                    malformed += 1
                    unassigned += not bool(tags)
                # Sample BEFORE chess validation and outcome checks. Replenishing
                # invalid/short/missed examples would bias the positive denominator.
                for theme in reservoirs.keys() & set(tags):
                    pool = reservoirs[theme]
                    if len(pool) < count:
                        pool.append(row)
                    else:
                        slot = generators[theme].randrange(themes_seen[theme])
                        if slot < count:
                            pool[slot] = row
                if progress and seen % 250_000 == 0:
                    progress(seen)
        except (csv.Error, UnicodeError, EOFError) as exc:
            raise DatasetError(
                f"Unreadable dataset near CSV line {reader.line_num}: {exc}. "
                "No complete benchmark can be reported."
            ) from exc
        # Finish reading before recording identity. A changed input cannot support
        # a reproducible sample even if the CSV happened to remain parseable.
        after = path.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise DatasetError("Dataset changed while being read")
        if hashing.bytes_read != before.st_size:
            raise DatasetError("Dataset stream did not consume the complete input file")
    return Sample(
        {key: sorted(rows, key=lambda row: row.record_number) for key, rows in reservoirs.items()},
        themes_seen,
        seen,
        malformed,
        unassigned,
        hashing.digest.hexdigest(),
        hashing.bytes_read,
    )
