"""Ordered baseline work followed by a finite independent refinement pass."""

from collections import deque
from concurrent.futures import ThreadPoolExecutor
from queue import Queue

from sqlalchemy import select

from trainer import game_review
from trainer.chess_core import Score
from trainer.models import AnalysisJob, Game, GameReview, GameReviewMove
from trainer.review_refinement import run_refinement
from trainer.review_reports import touch_report


def run_review(runner, job_id, engine_override=None):
    parsed, game_id = run_baseline(runner, job_id, engine_override)
    if not runner.cancelled(job_id):
        run_refinement(runner, job_id, parsed, game_id)


def run_baseline(runner, job_id, engine_override=None):
    with runner.sessions() as db:
        review = db.scalar(select(GameReview).where(GameReview.job_id == job_id))
        game = db.get(Game, review.game_id)
        parsed = game_review.parsed_game(game)
        moves = list(parsed.mainline_moves())
        rating = review.rating
        saved = {
            row.ply: row.report
            for row in db.scalars(select(GameReviewMove).where(GameReviewMove.game_id == game.id))
        }
    missing = len(moves) - len(saved)
    workers = (
        1
        if engine_override
        else min(runner.settings.stockfish_workers, runner.settings.engine_slots, max(1, missing))
    )
    engines = (
        [engine_override]
        if engine_override
        else [
            runner.engine_factory(runner.settings, runner.sessions)
            for _ in range(workers)
            if missing
        ]
    )
    available = Queue()
    for engine in engines:
        available.put(engine)

    human = getattr(runner, "human_models", None)

    def analyze(board, move, cached):
        if runner.cancelled(job_id):
            return None
        if cached is None:
            engine = available.get()
            try:
                # Preceding score is attached in game order below.
                report = game_review.analyze_move(engine, board, move)
            finally:
                available.put(engine)
        else:
            report = dict(cached)
        if human:
            report["human"] = human.evidence(
                runner.sessions,
                parsed,
                board,
                move.uci(),
                report["best"].get("uci"),
                rating,
                lambda: runner.cancelled(job_id),
            )
        return report

    executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="game-review")
    try:
        board = parsed.board()
        pending = deque()
        next_ply = 1
        previous = None

        def fill():
            nonlocal next_ply
            # Bound both running work and queued boards. Cancellation never leaves
            # a whole game's searches waiting in the executor.
            while next_ply <= len(moves) and len(pending) < workers:
                if runner.cancelled(job_id):
                    break
                move = moves[next_ply - 1]
                cached = saved.get(next_ply)
                refresh = human and human.needs_refresh(
                    cached.get("human") if cached else None, parsed, board.turn, rating
                )
                future = (
                    None
                    if cached is not None and not refresh
                    else executor.submit(analyze, board.copy(stack=True), move, cached)
                )
                pending.append((next_ply, future))
                board.push(move)
                next_ply += 1

        fill()
        while pending:
            ply, future = pending.popleft()
            report = future.result() if future else saved[ply]
            if report is None:
                break
            with runner.import_lock, runner.sessions() as db:
                if future:
                    report["previous_score"] = previous.model_dump() if previous else None
                    row = db.get(GameReviewMove, (game.id, ply))
                    if row is None:
                        row = GameReviewMove(game_id=game.id, ply=ply)
                        db.add(row)
                    row.report = report
                    row.human_analysis_id = report.get("human", {}).get("evidence_id")
                    touch_report(db, row)
                job = db.get(AnalysisJob, job_id)
                job.positions_triaged = ply
                job.games_processed = int(ply == len(moves))
                db.commit()
            previous = Score.model_validate(report["best"]["score"]).negate()
            fill()
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
        if not engine_override:
            for engine in engines:
                engine.close()

    return parsed, game.id
