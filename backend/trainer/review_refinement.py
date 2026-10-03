"""Finite, resumable optional investigation after every baseline move is saved."""

from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event

from sqlalchemy import select

from trainer.chess_core import digest, legal_move
from trainer.engine import EngineReferenceMismatch, EngineUnavailable
from trainer.models import EngineAnalysis, GameReview, GameReviewMove, ReviewRefinement
from trainer.review_intelligence.refinement_plan import VERSION, plan_key, selection
from trainer.review_intelligence.refinement_search import (
    QueryBudgetReached,
    RefinementEngine,
    adoption_reason,
)
from trainer.review_reports import touch_report
from trainer.search_limits import EngineCancelled

TERMINAL = {"completed", "budget_limited", "unavailable"}


def prepare(runner, game_id):
    with runner.sessions() as db:
        review = db.get(GameReview, game_id)
        baseline = {
            r.ply: r.report
            for r in db.scalars(select(GameReviewMove).where(GameReviewMove.game_id == game_id))
        }
        key = plan_key(baseline, runner.settings)
        if review.refinement_plan and review.refinement_plan["key"] == key:
            return review.refinement_plan
        task_ids = []
        for ply, triggers in selection(baseline, runner.settings):
            report = baseline[ply]
            original = db.get(EngineAnalysis, report["before_analysis_id"])
            if original is None:
                continue
            broad = bool(
                set(triggers)
                & {
                    "narrow_resource",
                    "critical_alternative",
                    "human_disagreement",
                    "verify_sacrifice",
                    "verify_opportunity",
                }
            )
            config = dict(
                version=VERSION,
                engine_version=original.engine_version,
                binary_sha256=original.config["binary_sha256"],
                limits={
                    "depth": max(original.config["depth"], runner.settings.review_refinement_depth),
                    "time": max(original.config["time"], runner.settings.review_refinement_time),
                    "nodes": None,
                },
                multipv=runner.settings.review_refinement_multipv if broad else 2,
                max_queries=runner.settings.review_refinement_queries,
                threads=runner.settings.stockfish_threads,
                hash_mb=runner.settings.stockfish_hash_mb,
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
        db.commit()
        return plan


def run_refinement(runner, job_id, parsed, game_id):
    if not runner.settings.review_refinement_positions or runner.cancelled(job_id):
        return
    plan = prepare(runner, game_id)
    with runner.sessions() as db:
        pending = [
            task_id
            for task_id in plan["tasks"]
            if db.get(ReviewRefinement, task_id).status not in TERMINAL
        ]
    # Tasks are independent questions with fixed per-query limits, so they share
    # the baseline's engine count; only wall-clock time changes.
    workers = min(runner.settings.stockfish_workers, runner.settings.engine_slots, len(pending))
    engines = Queue()
    for _ in range(workers):
        engines.put(None)
    started = []
    stop = Event()

    def investigate(task_id):
        if stop.is_set() or runner.cancelled(job_id):
            return
        engine = engines.get()
        try:
            if engine is None:
                engine = runner.engine_factory(runner.settings, runner.sessions)
                started.append(engine)
            if refine(runner, job_id, parsed, game_id, task_id, engine):
                record_progress(runner, game_id, plan)
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
            record_progress(runner, game_id, plan)
    finally:
        for engine in started:
            engine.close()


def record_progress(runner, game_id, plan):
    with runner.import_lock, runner.sessions() as db:
        statuses = db.scalars(
            select(ReviewRefinement.status).where(ReviewRefinement.id.in_(plan["tasks"]))
        )
        review = db.get(GameReview, game_id)
        review.refinement_plan = dict(
            review.refinement_plan, completed=sum(status in TERMINAL for status in statuses)
        )
        db.commit()


def refine(runner, job_id, parsed, game_id, task_id, engine):
    """Answer one question; False means the job was cancelled mid-search."""
    with runner.sessions() as db:
        task = db.get(ReviewRefinement, task_id)
        baseline = db.get(GameReviewMove, (game_id, task.ply)).report
    board = parsed.board()
    for move in list(parsed.mainline_moves())[: task.ply - 1]:
        board.push(move)
    move = legal_move(board, baseline["actual"]["uci"])
    status, reason, report = "completed", None, None
    adopted = False
    try:
        from trainer.game_review import analyze_move

        bounded = RefinementEngine(engine, task, runner.sessions, lambda: runner.cancelled(job_id))
        report = analyze_move(bounded, board, move)
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
    with runner.import_lock, runner.sessions() as db:
        current = db.get(ReviewRefinement, task_id)
        current.status, current.reason, current.report = status, reason, report
        current.adopted = adopted and status == "completed"
        row = db.get(GameReviewMove, (game_id, task.ply))
        if current.adopted or row.refinement_id is None:
            row.refinement_id = current.id
        touch_report(db, row)
        following = db.get(GameReviewMove, (game_id, task.ply + 1))
        if current.adopted and following is not None:
            touch_report(db, following)
        db.commit()
    return True
