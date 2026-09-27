"""Measure optional investigation on the fixed synthetic corpus, never private games."""

import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import RLock
from time import perf_counter
from types import SimpleNamespace

import chess.pgn
from review_benchmark.corpus import board_for, load_corpus
from review_benchmark.metrics import machine
from sqlalchemy import select
from trainer.chess_core import digest, legal_move
from trainer.config import Settings
from trainer.db import database, migrate
from trainer.engine import Stockfish
from trainer.game_review import analyze_move, classify
from trainer.models import AnalysisJob, Game, GameReview, GameReviewMove, ReviewRefinement
from trainer.review_refinement import run_refinement
from trainer.review_reports import load_game_reports


def run(executable, targeted=False):
    corpus = load_corpus()
    if targeted:
        corpus = load_corpus(Path(__file__).parent / "review_benchmark" / "refinement_cases.json")
    output = []
    with TemporaryDirectory(prefix="fieldwork-refinement-") as directory:
        settings = Settings(
            _env_file=None,
            database_path=Path(directory) / "probe.sqlite3",
            stockfish_path=str(Path(executable).resolve()),
        )
        sql_engine, sessions = database(settings.database_path)
        migrate(sql_engine)
        native = Stockfish(settings, sessions)
        runner = SimpleNamespace(
            settings=settings,
            sessions=sessions,
            import_lock=RLock(),
            engine_factory=Stockfish,
            cancelled=lambda _: False,
        )
        try:
            for item in corpus["positions"]:
                board = board_for(item)
                move = legal_move(board, item["played"])
                start = perf_counter()
                baseline = analyze_move(native, board, move)
                baseline_seconds = perf_counter() - start
                final = board.copy(stack=True)
                final.push(move)
                parsed = chess.pgn.Game.from_board(final)
                ply = len(final.move_stack)
                with sessions() as db:
                    game = Game(
                        fingerprint=item["id"],
                        white="Synthetic",
                        black="Probe",
                        learner_color=board.turn,
                        pgn=str(parsed),
                    )
                    job = AnalysisJob(kind="game_review")
                    db.add_all([game, job])
                    db.flush()
                    db.add(GameReview(game_id=game.id, job_id=job.id, rating=1200))
                    db.flush()
                    db.add(GameReviewMove(game_id=game.id, ply=ply, report=baseline))
                    db.commit()
                start = perf_counter()
                run_refinement(runner, job.id, parsed, game.id)
                seconds = perf_counter() - start
                with sessions() as db:
                    reports, _ = load_game_reports(db, game.id)
                    task = db.scalar(
                        select(ReviewRefinement).where(ReviewRefinement.game_id == game.id)
                    )
                    effective = reports[ply]
                    task_data = (
                        {
                            "triggers": task.triggers,
                            "config": task.config,
                            "queries": task.queries,
                            "status": task.status,
                            "adopted": task.adopted,
                            "reason": task.reason,
                            "report": task.report,
                        }
                        if task
                        else None
                    )
                    assert db.get(GameReviewMove, (game.id, ply)).report == baseline
                output.append(
                    dict(
                        id=item["id"],
                        baseline_seconds=baseline_seconds,
                        refinement_seconds=seconds,
                        baseline=baseline,
                        effective=effective,
                        task=task_data,
                        baseline_quality=classify(baseline, 1200)[0],
                        effective_quality=classify(effective, 1200)[0],
                    )
                )
                print(
                    item["id"],
                    "not nominated" if task is None else (task.status, task.adopted, task.reason),
                    round(seconds, 3),
                    flush=True,
                )
            return dict(
                version="refinement-probe-1",
                corpus_digest=digest(corpus),
                machine=machine(),
                rows=output,
            )
        finally:
            native.close()
            sql_engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stockfish", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--targeted", action="store_true", help="Probe two documented public ambiguity positions"
    )
    args = parser.parse_args()
    result = run(args.stockfish, args.targeted)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(result, output, indent=2)
