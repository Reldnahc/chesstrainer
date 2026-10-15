"""Resume bounded questions using the existing Stockfish cache and move analyzer."""

from trainer.chess_core import digest, engine_context
from trainer.engine import EngineReferenceMismatch
from trainer.models import EngineAnalysis, ReviewRefinement
from trainer.search_limits import EngineCancelled, SearchLimits, SearchProfile


class QueryBudgetReached(RuntimeError):
    pass


class RefinementEngine:
    def __init__(self, native, task, sessions, cancelled):
        self.native, self.task, self.sessions, self.cancelled = native, task, sessions, cancelled
        self.queries = list(task.queries)

    def analyze(self, board, profile=None, *, root_moves=None, multipv=None):
        # Every refinement question runs at the task's own deeper limits, whatever
        # profile the shared move analysis asks for.
        if self.cancelled():
            raise EngineCancelled()
        count = multipv if root_moves else self.task.config["multipv"]
        key = digest({"context": engine_context(board), "roots": root_moves, "multipv": count})
        saved = next((row for row in self.queries if row["key"] == key), None)
        if saved:
            with self.sessions() as db:
                result = db.get(EngineAnalysis, saved["analysis_id"])
                if result is not None:
                    return result
        if len(self.queries) >= self.task.config["max_queries"]:
            raise QueryBudgetReached()
        self.native.start(cancelled=self.cancelled)
        if (self.native.version, self.native.binary_hash) != (
            self.task.config["engine_version"],
            self.task.config["binary_sha256"],
        ):
            raise EngineReferenceMismatch("Refinement requires the baseline's Stockfish executable")
        result = self.native.analyze(
            board,
            SearchProfile.explicit(SearchLimits.model_validate(self.task.config["limits"])),
            root_moves=root_moves,
            multipv=count,
            cancelled=self.cancelled,
        )
        # A pool may lease a different process for start and analyze. Verify the
        # returned evidence too, including a binary replaced while the host runs.
        if (result.engine_version, result.config["binary_sha256"]) != (
            self.task.config["engine_version"],
            self.task.config["binary_sha256"],
        ):
            raise EngineReferenceMismatch("Refinement returned an incompatible engine identity")
        self.queries.append(
            {
                "key": key,
                "analysis_id": result.id,
                "fen": board.fen(),
                "root_moves": root_moves,
                "multipv": count,
                "question": "restricted_alternative" if root_moves else "root_comparison",
            }
        )
        # No account lock: only the running refinement writes its own task's query
        # log, and opening the game resets only tasks that are not running.
        with self.sessions() as db:
            db.get(ReviewRefinement, self.task.id).queries = list(self.queries)
            db.commit()
        return result


def adoption_reason(baseline, refined):
    depths = [refined["depth"], *(row["depth"] for row in refined.get("root_candidates", []))]
    if min(depths) < baseline["depth"]:
        return "insufficient_depth"
    if refined["engine_version"] != baseline["engine_version"]:
        return "incompatible_engine"
    # Restricted roots can find the played move stronger than the unrestricted
    # search's best. Presentation already promotes such a move to best (as for
    # baseline reports), so the deeper evidence is adopted rather than rejected.
    return None
