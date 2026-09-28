"""Resume bounded questions using the existing Stockfish cache and move analyzer."""

from trainer.chess_core import Score, digest, engine_context
from trainer.engine import EngineReferenceMismatch
from trainer.models import EngineAnalysis, ReviewRefinement
from trainer.review_scores import score_order
from trainer.search_limits import EngineCancelled, SearchLimits


class QueryBudgetReached(RuntimeError):
    pass


class RefinementEngine:
    def __init__(self, native, task, sessions, cancelled):
        self.native, self.task, self.sessions, self.cancelled = native, task, sessions, cancelled
        self.queries = list(task.queries)

    def analyze(self, board, deep=False, root_moves=None, multipv=None):
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
            deep=True,
            root_moves=root_moves,
            multipv=count,
            limits=SearchLimits.model_validate(self.task.config["limits"]),
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
    best = Score.model_validate(refined["best"]["score"])
    actual = Score.model_validate(refined["actual"]["score"])

    # Restricted roots can discover a line missed by the unrestricted search.
    # Do not publish an internally inconsistent best/played comparison.
    if score_order(actual) > score_order(best):
        return "inconsistent_roots"
    return None
