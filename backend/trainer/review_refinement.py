"""Finite, resumable optional investigation after every baseline move is saved."""

from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event

from sqlalchemy import select

from trainer.chess_core import digest, legal_move
from trainer.classification_stages import line_parameters
from trainer.engine import EngineReferenceMismatch, EngineUnavailable
from trainer.game_library import board_before
from trainer.game_review import analyze_move, mate_horizon_limits
from trainer.models import EngineAnalysis, GameReview, GameReviewMove, ReviewRefinement
from trainer.puzzles.generation import remine_after_refinement
from trainer.review_intelligence.refinement_plan import BROAD_TRIGGERS, VERSION, plan_key, selection
from trainer.review_intelligence.refinement_search import (
    QueryBudgetReached,
    RefinementEngine,
    adoption_reason,
)
from trainer.review_reports import touch_report
from trainer.search_limits import EngineCancelled

TERMINAL = {"completed", "budget_limited", "unavailable"}


def prepare(context, game_id):
    # Opening the game can reset the plan, so the plan is written in a write unit.
    with context.write() as db:
        review = db.get(GameReview, game_id)
        baseline = {
            r.ply: r.report
            for r in db.scalars(select(GameReviewMove).where(GameReviewMove.game_id == game_id))
        }
        key = plan_key(baseline, context.settings)
        if review.refinement_plan and review.refinement_plan["key"] == key:
            return review.refinement_plan
        task_ids = []
        for ply, triggers in selection(baseline, context.settings):
            report = baseline[ply]
            original = db.get(EngineAnalysis, report["before_analysis_id"])
            if original is None:
                continue
            broad = bool(set(triggers) & BROAD_TRIGGERS)
            config = dict(
                version=VERSION,
                engine_version=original.engine_version,
                binary_sha256=original.config["binary_sha256"],
                limits={
                    "depth": max(
                        original.config["depth"], context.settings.review_refinement_depth
                    ),
                    "time": max(original.config["time"], context.settings.review_refinement_time),
                    "nodes": None,
                },
                multipv=context.settings.review_refinement_multipv if broad else 2,
                max_queries=context.settings.review_refinement_queries,
                threads=context.settings.stockfish_threads,
                hash_mb=context.settings.stockfish_hash_mb,
                baseline_ids=[report["before_analysis_id"], report["played_analysis_id"]],
                human_configuration=(report.get("human") or {}).get("configuration_key"),
            )
            task_key = digest({"game": game_id, "ply": ply, "config": config, "triggers": triggers})
            task = db.scalar(select(ReviewRefinement).where(ReviewRefinement.task_key == task_key))
            if task is None:
                task = ReviewRefinement(
                    game_id=game_id, ply=ply, task_key=task_key, triggers=triggers, config=config
                )
                db.add(task)
                db.flush()
            task_ids.append(task.id)
        plan = dict(version=VERSION, key=key, tasks=task_ids, completed=0)
        review.refinement_plan = plan
        return plan


def run_refinement(context, parsed, game_id):
    if not context.settings.review_refinement_positions or context.cancelled():
        return
    plan = prepare(context, game_id)
    with context.read() as db:
        pending = [
            task_id
            for task_id in plan["tasks"]
            if db.get(ReviewRefinement, task_id).status not in TERMINAL
        ]
    # Tasks are independent questions with fixed per-query limits, so they share
    # the baseline's engine count; only wall-clock time changes.
    workers = min(context.settings.stockfish_workers, context.settings.engine_slots, len(pending))
    engines = Queue()
    for _ in range(workers):
        engines.put(None)
    started = []
    stop = Event()

    def investigate(task_id):
        if stop.is_set() or context.cancelled():
            return
        engine = engines.get()
        try:
            if engine is None:
                engine = context.engine_factory(context.settings, context.sessions)
                started.append(engine)
            if refine(context, parsed, game_id, task_id, engine):
                record_progress(context, game_id, plan)
            else:
                stop.set()
        except BaseException:
            stop.set()
            raise
        finally:
            engines.put(engine)

    try:
        if pending:
            with ThreadPoolExecutor(workers, thread_name_prefix="review-refinement") as executor:
                for future in [executor.submit(investigate, task_id) for task_id in pending]:
                    future.result()
        else:
            record_progress(context, game_id, plan)
    finally:
        for engine in started:
            engine.close()


def record_progress(context, game_id, plan):
    with context.write() as db:
        statuses = db.scalars(
            select(ReviewRefinement.status).where(ReviewRefinement.id.in_(plan["tasks"]))
        )
        review = db.get(GameReview, game_id)
        review.refinement_plan = dict(
            review.refinement_plan, completed=sum(status in TERMINAL for status in statuses)
        )


def refine(context, parsed, game_id, task_id, engine):
    """Answer one question; False means the job was cancelled mid-search."""
    with context.read() as db:
        task = db.get(ReviewRefinement, task_id)
        baseline = db.get(GameReviewMove, (game_id, task.ply)).report
    board = board_before(parsed, task.ply)
    move = legal_move(board, baseline["actual"]["uci"])
    status, reason, report = "completed", None, None
    adopted = False
    try:
        bounded = RefinementEngine(engine, task, context, context.cancelled)
        report = analyze_move(
            bounded,
            board,
            move,
            parameters=line_parameters(context.settings),
            mate_limits=mate_horizon_limits(context.settings),
        )
        reason = adoption_reason(baseline, report)
        adopted = reason is None
        # Compare a plausible human alternative only if the finite
        # budget has room; it cannot interrupt an otherwise complete root comparison.
        natural = (baseline.get("human") or {}).get("top_moves", [])
        if natural and len(bounded.queries) < task.config["max_queries"]:
            uci = natural[0]["uci"]
            known = {candidate["uci"] for candidate in report["root_candidates"]} | {move.uci()}
            if uci not in known:
                try:
                    bounded.analyze(board, root_moves=[uci], multipv=1)
                except EngineUnavailable:
                    reason = reason or "optional_alternative_unavailable"
    except EngineCancelled:
        return False
    except QueryBudgetReached:
        status, reason = "budget_limited", "query_budget"
    except EngineReferenceMismatch:
        status, reason = "unavailable", "incompatible_engine"
    except EngineUnavailable:
        status, reason = "unavailable", "engine_unavailable"
    with context.write() as db:
        save_outcome(db, task_id, status, reason, report, adopted)
    return True


def save_outcome(db, task_id, status, reason, report, adopted):
    """Record one answered question; an adopted answer becomes what the review shows."""
    current = db.get(ReviewRefinement, task_id)
    current.status, current.reason, current.report = status, reason, report
    current.adopted = adopted and status == "completed"
    row = db.get(GameReviewMove, (current.game_id, current.ply))
    if current.adopted or row.refinement_id is None:
        row.refinement_id = current.id
    touch_report(db, row)
    following = db.get(GameReviewMove, (current.game_id, current.ply + 1))
    if current.adopted and following is not None:
        touch_report(db, following)
    if current.adopted:
        # Own-game puzzles are mined from what the review shows, so look again.
        remine_after_refinement(db, current.game_id)
