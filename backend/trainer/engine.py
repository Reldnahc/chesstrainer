import hashlib
import logging
import os
import shutil
import threading
from pathlib import Path

import chess
import chess.engine
from sqlalchemy import select

from trainer.cancellation import StripedLocks
from trainer.chess_core import Candidate, Score, digest, engine_context, legal_move
from trainer.config import Settings
from trainer.engine_search import cancellable_search, search_lock
from trainer.models import EngineAnalysis, keep_shared
from trainer.search_limits import EngineCancelled, SearchLimits

log = logging.getLogger(__name__)

# Bounded shared stripes prevent concurrent searches for an identical cache key.
# They contain no engine state and also cover the interactive engine.
_CACHE_LOCKS = StripedLocks(1024)
_BINARY_HASHES: dict[tuple[str, int, int], str] = {}
_BINARY_HASH_LOCK = threading.Lock()


def binary_sha256(path):
    """Executable identity, read once per (path, size, mtime) rather than on every start."""
    stat = os.stat(path)
    key = (path, stat.st_size, stat.st_mtime_ns)
    with _BINARY_HASH_LOCK:
        cached = _BINARY_HASHES.get(key)
    if cached is None:
        with open(path, "rb") as binary:
            cached = hashlib.file_digest(binary, "sha256").hexdigest()
        with _BINARY_HASH_LOCK:
            _BINARY_HASHES[key] = cached
    return cached


# Stockfish's UCI_Elo range for strength-limited play.
ENGINE_ELO = (1320, 3190)


class EngineUnavailable(RuntimeError):
    pass


class EngineReferenceMismatch(EngineUnavailable):
    """Stockfish is usable, but this position requires a different saved executable."""


# Part of every cached analysis's key: bump it when the adapter changes what a
# search with the same settings returns.
ADAPTER_VERSION = "2"


def search_config(
    settings,
    binary_hash,
    *,
    deep=False,
    root_moves=None,
    multipv=None,
    reference=None,
    classification_probe=False,
    limits=None,
):
    """The engine configuration one search runs with, and caches under.

    One profile applies: triage (the default) or ``deep`` from settings, the
    limits of a ``reference`` analysis being extended, the classification
    probe's, or explicit ``limits``. A reference cannot be combined with a probe
    or explicit limits, nor a probe with explicit limits.
    """
    if reference and (classification_probe or limits):
        raise ValueError("A classification probe cannot change grading reference limits")
    if classification_probe and limits:
        raise ValueError("Choose one explicit search profile")
    config = {
        "threads": settings.stockfish_threads,
        "hash_mb": settings.stockfish_hash_mb,
        "depth": settings.deep_depth if deep else settings.triage_depth,
        "time": settings.deep_time if deep else settings.triage_time,
        "nodes": settings.deep_nodes if deep else settings.triage_nodes,
        "multipv": multipv or (settings.multipv if deep else 1),
        "root_moves": sorted(root_moves) if root_moves else None,
        "binary_sha256": binary_hash,
        "adapter_version": ADAPTER_VERSION,
    }
    if reference:
        for name in ("threads", "hash_mb", "depth", "time", "nodes"):
            config[name] = reference.config[name]
    if classification_probe:
        config.update(
            depth=settings.classification_probe_depth,
            time=settings.classification_probe_time,
            nodes=None,
        )
    if limits:
        config.update(limits.model_dump())
    return config


class Stockfish:
    """A serialized native engine with a persistent, context-sensitive cache."""

    def __init__(self, settings: Settings, sessions):
        self.settings = settings
        self.sessions = sessions
        self.process = None
        self.version = ""
        self.binary_hash = ""
        self.lock = threading.RLock()
        self.hits = 0
        self.misses = 0

    def start(self, cancelled=None):
        with search_lock(self.lock, cancelled):
            if self.process is not None:
                return
            path = shutil.which(self.settings.stockfish_path)
            if not path and Path(self.settings.stockfish_path).is_file():
                path = str(Path(self.settings.stockfish_path).resolve())
            if not path:
                raise EngineUnavailable(
                    f"Stockfish executable not found at '{self.settings.stockfish_path}'. "
                    "Install native Stockfish and set STOCKFISH_PATH in .env."
                )
            try:
                self.binary_hash = binary_sha256(path)
                self.process = chess.engine.SimpleEngine.popen_uci(path, timeout=15)
                self.process.configure(
                    {
                        "Threads": self.settings.stockfish_threads,
                        "Hash": self.settings.stockfish_hash_mb,
                    }
                )
                self.version = self.process.id.get("name", "unknown")
                if "stockfish" not in self.version.lower():
                    raise EngineUnavailable(
                        "Configured UCI executable does not identify as Stockfish"
                    )
                log.info("engine_started", extra={"engine": self.version})
            except Exception as exc:
                self.close()
                raise EngineUnavailable(
                    "Unable to start Stockfish. Check executable compatibility and STOCKFISH_PATH."
                ) from exc

    def close(self):
        with self.lock:
            if self.process is not None:
                try:
                    self.process.quit()
                except (chess.engine.EngineError, TimeoutError):
                    self.process.close()
                self.process = None
                log.info("engine_stopped")

    def play_limited(self, board: chess.Board, elo: int, time: float, cancelled=None) -> str:
        """One strength-limited move for the engine opponent; never cached or graded."""
        with search_lock(self.lock, cancelled):
            self.start()
            try:
                self.process.configure(
                    {
                        "UCI_LimitStrength": True,
                        "UCI_Elo": max(ENGINE_ELO[0], min(ENGINE_ELO[1], int(elo))),
                    }
                )
                result = self.process.play(board, chess.engine.Limit(time=time), game=object())
            except (chess.engine.EngineError, TimeoutError) as exc:
                self.close()
                raise EngineUnavailable("Stockfish stopped responding during play.") from exc
            finally:
                if self.process is not None:
                    self.process.configure({"UCI_LimitStrength": False})
            if result.move is None:
                raise EngineUnavailable("Stockfish returned no move for this position")
            return result.move.uci()

    def analyze(
        self,
        board: chess.Board,
        deep=False,
        root_moves: list[str] | None = None,
        multipv: int | None = None,
        reference: EngineAnalysis | None = None,
        classification_probe: bool = False,
        limits: SearchLimits | None = None,
        cancelled=None,
    ) -> EngineAnalysis:
        with search_lock(self.lock, cancelled):
            self.start()
            if reference and (
                reference.engine_version != self.version
                or reference.config["binary_sha256"] != self.binary_hash
            ):
                raise EngineReferenceMismatch(
                    "This exercise was verified with a different Stockfish executable. "
                    "Restore that STOCKFISH_PATH to verify additional moves; "
                    "stored accepted answers remain usable."
                )
            config = search_config(
                self.settings,
                self.binary_hash,
                deep=deep,
                root_moves=root_moves,
                multipv=multipv,
                reference=reference,
                classification_probe=classification_probe,
                limits=limits,
            )
            key = digest(
                {"context": engine_context(board), "engine": self.version, "config": config}
            )
            with search_lock(_CACHE_LOCKS.for_key(key), cancelled):
                with self.sessions() as db:
                    cached = db.scalar(
                        select(EngineAnalysis).where(EngineAnalysis.cache_key == key)
                    )
                    if cached:
                        self.hits += 1
                        return cached
                self.misses += 1
                limit = chess.engine.Limit(
                    depth=config["depth"], time=config["time"], nodes=config["nodes"]
                )
                roots = [legal_move(board, uci) for uci in root_moves] if root_moves else None
                try:
                    self.process.configure(
                        {"Threads": config["threads"], "Hash": config["hash_mb"]}
                    )
                    infos = (
                        cancellable_search(
                            self.process,
                            board,
                            limit,
                            multipv=config["multipv"],
                            root_moves=roots,
                            cancelled=cancelled,
                        )
                        if cancelled is not None
                        else self.process.analyse(
                            board, limit, multipv=config["multipv"], root_moves=roots, game=object()
                        )
                    )
                    candidates = []
                    for info in infos:
                        pv = info.get("pv", [])
                        if not pv:
                            continue
                        replay = board.copy()
                        for move in pv:
                            legal_move(replay, move.uci())
                            replay.push(move)
                        candidates.append(
                            Candidate(
                                uci=pv[0].uci(),
                                san=board.san(pv[0]),
                                score=Score.from_engine(info["score"], board.turn),
                                pv=[m.uci() for m in pv],
                                depth=info.get("depth", 0),
                            )
                        )
                    if not candidates:
                        raise EngineUnavailable(
                            "Stockfish returned no candidate moves for this position"
                        )
                except EngineCancelled:
                    self.close()
                    raise
                except (chess.engine.EngineError, TimeoutError) as exc:
                    self.close()
                    raise EngineUnavailable(
                        "Stockfish stopped responding. Completed analysis is saved; retry the job."
                    ) from exc
                with self.sessions() as db:
                    db.execute(
                        keep_shared(
                            EngineAnalysis,
                            key,
                            fen=board.fen(),
                            engine_version=self.version,
                            config=config,
                            candidates=[c.model_dump() for c in candidates],
                        )
                    )
                    db.commit()
                    return db.scalar(select(EngineAnalysis).where(EngineAnalysis.cache_key == key))
