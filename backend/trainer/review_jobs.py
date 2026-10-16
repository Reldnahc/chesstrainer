"""Ordered baseline work followed by a finite independent refinement pass."""

from collections import deque
from concurrent.futures import ThreadPoolExecutor
from queue import Queue

from sqlalchemy import select

from trainer import game_review
from trainer.classification_stages import line_parameters
from trainer.game_library import board_before
from trainer.models import AnalysisJob, Game, GameReview, GameReviewMove
from trainer.review_refinement import run_refinement
from trainer.review_reports import stale_adopted, touch_report


def run_review(context, engine_override=None):
    parsed, game_id = run_baseline(context, engine_override)
    if not context.cancelled():
        run_refinement(context, parsed, game_id)


def run_baseline(context, engine_override=None):
    job_id = context.job_id
    with context.read() as db:
        review = db.scalar(select(GameReview).where(GameReview.job_id == job_id))
        game = db.get(Game, review.game_id)
        parsed = game_review.parsed_game(game)
        moves = list(parsed.mainline_moves())
        rating = review.rating
        saved = {
            row.ply: row.report
            for row in db.scalars(select(GameReviewMove).where(GameReviewMove.game_id == game.id))
        }
    parameters = line_parameters(context.settings)
    mate_limits = game_review.mate_horizon_limits(context.settings)
    with context.write() as db:
        # The review shows an adopted refinement over its baseline; its lines are
        # read again to the current horizon too, from its saved candidates.
        for task in stale_adopted(db, game.id, parameters):
            task.report = game_review.reread_lines(
                task.report, board_before(parsed, task.ply), parameters
            )
            # The review shows this report, so its row's revision moves for pollers.
            row = db.get(GameReviewMove, (game.id, task.ply))
            if row is not None:
                touch_report(db, row)
    missing = len(moves) - len(saved)
    workers = (
        1
        if engine_override
        else min(context.settings.stockfish_workers, context.settings.engine_slots, max(1, missing))
    )
    engines = (
        [engine_override]
        if engine_override
        else [
            context.engine_factory(context.settings, context.sessions)
            for _ in range(workers)
            if missing
        ]
    )
    available = Queue()
    for engine in engines:
        available.put(engine)

    human = context.human_models

    def analyze(board, move, cached):
        if context.cancelled():
            return None
        if cached is None:
            engine = available.get()
            try:
                # Preceding score is attached in game order below.
                report = game_review.analyze_move(
                    engine, board, move, parameters=parameters, mate_limits=mate_limits
                )
            finally:
                available.put(engine)
        elif game_review.lines_current(cached, parameters):
            report = dict(cached)
        else:
            # Saved before the shared line horizon, or under another one: its lines
            # are read again from the saved candidates, with no new search.
            report = game_review.reread_lines(cached, board, parameters)
        if human:
            report["human"] = human.evidence(
                context.sessions,
                parsed,
                board,
                move.uci(),
                report["best"].get("uci"),
                rating,
                context.cancelled,
            )
        return report

    if human and context.settings.human_model_device == "cuda":
        # A GPU scores a whole game in one batch far faster than move by move. On
        # CPU the per-move path is kept: it overlaps Maia with the Stockfish
        # searches, and CPU batching saves little (about 1.5x) since the
        # forward pass itself is the cost.
        board, boards = parsed.board(), []
        for ply, move in enumerate(moves, start=1):
            cached = saved.get(ply)
            if cached is None or human.needs_refresh(
                cached.get("human"), parsed, board.turn, rating
            ):
                boards.append(board.copy(stack=True))
            board.push(move)
        human.prefetch(context.sessions, parsed, boards, rating, context.cancelled)

    executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="game-review")
    try:
        board = parsed.board()
        pending = deque()
        next_ply = 1

        def fill():
            nonlocal next_ply
            # Bound both running work and queued boards. Cancellation never leaves
            # a whole game's searches waiting in the executor.
            while next_ply <= len(moves) and len(pending) < workers:
                if context.cancelled():
                    break
                move = moves[next_ply - 1]
                cached = saved.get(next_ply)
                refresh = (
                    human
                    and human.needs_refresh(
                        cached.get("human") if cached else None, parsed, board.turn, rating
                    )
                ) or (cached is not None and not game_review.lines_current(cached, parameters))
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
            with context.write() as db:
                if future:
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
            fill()
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
        if not engine_override:
            for engine in engines:
                engine.close()

    return parsed, game.id
