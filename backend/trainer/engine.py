import logging
import shutil
import threading
from pathlib import Path

import chess
import chess.engine
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert

from trainer.chess_core import Candidate, Score, digest, engine_context, legal_move
from trainer.config import Settings
from trainer.engine_search import cancellable_search, search_lock
from trainer.models import EngineAnalysis, uid
from trainer.search_limits import EngineCancelled, SearchLimits

log = logging.getLogger(__name__)

# Bounded shared stripes prevent concurrent searches for an identical cache key.
# They contain no engine state and also cover the interactive engine.
_CACHE_LOCKS = tuple(threading.Lock() for _ in range(1024))


class EngineUnavailable(RuntimeError):
    pass


class EngineReferenceMismatch(EngineUnavailable):
    """Stockfish is usable, but this position requires a different saved executable."""


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
                import hashlib

                with open(path, "rb") as binary:
                    self.binary_hash = hashlib.file_digest(binary, "sha256").hexdigest()
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
            count = multipv or (self.settings.multipv if deep else 1)
            config = {
                "threads": self.settings.stockfish_threads,
                "hash_mb": self.settings.stockfish_hash_mb,
                "depth": self.settings.deep_depth if deep else self.settings.triage_depth,
                "time": self.settings.deep_time if deep else self.settings.triage_time,
                "nodes": self.settings.deep_nodes if deep else self.settings.triage_nodes,
                "multipv": count,
                "root_moves": sorted(root_moves) if root_moves else None,
                "binary_sha256": self.binary_hash,
                "adapter_version": "2",
            }
            if reference:
                if classification_probe or limits:
                    raise ValueError(
                        "A classification probe cannot change grading reference limits"
                    )
                for name in ("threads", "hash_mb", "depth", "time", "nodes"):
                    config[name] = reference.config[name]
            if classification_probe:
                if limits:
                    raise ValueError("Choose one explicit search profile")
                config.update(
                    depth=self.settings.classification_probe_depth,
                    time=self.settings.classification_probe_time,
                    nodes=None,
                )
            if limits:
                config.update(limits.model_dump())
            key = digest(
                {"context": engine_context(board), "engine": self.version, "config": config}
            )
            with search_lock(_CACHE_LOCKS[int(key[:3], 16) % len(_CACHE_LOCKS)], cancelled):
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
                            multipv=count,
                            root_moves=roots,
                            cancelled=cancelled,
                        )
                        if cancelled is not None
                        else self.process.analyse(
                            board, limit, multipv=count, root_moves=roots, game=object()
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
                        insert(EngineAnalysis)
                        .values(
                            id=uid(),
                            cache_key=key,
                            fen=board.fen(),
                            engine_version=self.version,
                            config=config,
                            candidates=[c.model_dump() for c in candidates],
                        )
                        .on_conflict_do_nothing(index_elements=["cache_key"])
                    )
                    db.commit()
                    return db.scalar(select(EngineAnalysis).where(EngineAnalysis.cache_key == key))
