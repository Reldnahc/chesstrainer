"""Game library, resumable whole-game review and legal variation analysis."""

from datetime import timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from trainer.chess_core import Score
from trainer.contracts.common import JobStarted
from trainer.contracts.games import (
    GameAnalysis,
    GameDetail,
    GameHistory,
    GamePosition,
    ReviewProgress,
)
from trainer.game_accuracy import review_accuracy
from trainer.game_library import pgn_rating, time_control_label
from trainer.game_review import analyze_move, branch_board, parsed_game, position, public_report
from trainer.models import (
    AnalysisJob,
    Game,
    GameReview,
    GameReviewMove,
    ImportBatch,
    ImportGame,
    ReviewRefinement,
)
from trainer.review_intelligence.context import move_contexts
from trainer.review_intelligence.history import cross_game_context
from trainer.review_intelligence.presentation import present_game
from trainer.review_reports import load_accuracy_scores, load_game_reports
from trainer.workspaces import CurrentWorkspace


class ReviewRequest(BaseModel):
    rating: int | None = Field(default=None, ge=400, le=3000)
    refine: bool = False


class VariationRequest(BaseModel):
    ply: int = Field(default=0, ge=0)
    moves: list[str] = Field(default_factory=list, max_length=128)


def job_progress(job, completed, total, review=None):
    plan = review.refinement_plan if review else None
    return (
        {
            "id": job.id,
            "status": job.status,
            "completed": min(completed, job.positions_triaged)
            if job.status in {"queued", "running"}
            else completed,
            "total": total,
            "error": job.error,
            "cancel_requested": job.cancel_requested,
            "phase": "complete"
            if job.status == "completed"
            else "refinement"
            if plan and job.positions_triaged >= total
            else "baseline",
            "refinement_completed": plan["completed"] if plan else 0,
            "refinement_total": len(plan["tasks"]) if plan else 0,
        }
        if job
        else None
    )


def create_router(*, settings, engine_factory):
    router = APIRouter()

    def require_game(db, game_id):
        game = db.get(Game, game_id)
        if game is None:
            raise HTTPException(404, "Game not found")
        return game

    @router.get("/api/games", response_model=GameHistory, response_model_exclude_unset=True)
    def games(
        workspace: CurrentWorkspace,
        offset: int = Query(0, ge=0),
        limit: int = Query(30, ge=1, le=100),
    ):
        with workspace.sessions() as db:
            rows = db.execute(
                select(Game, AnalysisJob.status)
                .outerjoin(GameReview, GameReview.game_id == Game.id)
                .outerjoin(AnalysisJob, AnalysisJob.id == GameReview.job_id)
                .order_by(Game.played_at.desc(), Game.created_at.desc(), Game.id)
                .offset(offset)
                .limit(limit)
            ).all()
            completed_ids = [game.id for game, status in rows if status == "completed"]
            saved = load_accuracy_scores(db, completed_ids)
            items = []
            for game, status in rows:
                parsed = parsed_game(game)
                plies = sum(1 for _ in parsed.mainline_moves())
                time_control = parsed.headers.get("TimeControl")
                items.append(
                    {
                        "id": game.id,
                        "white": game.white,
                        "black": game.black,
                        "white_rating": pgn_rating(parsed, True),
                        "black_rating": pgn_rating(parsed, False),
                        "learner_color": "white" if game.learner_color else "black",
                        "played_on": game.played_on,
                        "played_at": game.played_at.replace(tzinfo=timezone.utc).isoformat()
                        if game.played_at
                        else None,
                        "result": parsed.headers.get("Result", "*"),
                        "time_control": time_control,
                        "time_control_label": time_control_label(time_control),
                        "move_count": (plies + 1) // 2,
                        "status": status or "not_started",
                        "accuracy": review_accuracy(
                            saved[game.id],
                            total=plies,
                            starting_board=parsed.board(),
                            completed=status == "completed",
                        ),
                    }
                )
            return {"items": items, "total": db.scalar(select(func.count()).select_from(Game))}

    @router.get(
        "/api/games/{game_id}", response_model=GameDetail, response_model_exclude_unset=True
    )
    def game_detail(workspace: CurrentWorkspace, game_id: str):
        with workspace.sessions() as db:
            game = require_game(db, game_id)
            parsed = parsed_game(game)
            board = parsed.board()
            review = db.get(GameReview, game_id)
            job = db.get(AnalysisJob, review.job_id) if review else None
            rating = review.rating if review else 1000
            saved, revisions = load_game_reports(db, game_id)
            reports, context = present_game(
                parsed, saved, rating, completed=bool(job and job.status == "completed")
            )
            frames = [
                position(board)
                | {
                    "san": "Start",
                    "uci": None,
                    "number": board.fullmove_number,
                    "actor": None,
                    "report": None,
                }
            ]
            for ply, move in enumerate(parsed.mainline_moves(), 1):
                san, number, actor = board.san(move), board.fullmove_number, board.turn
                board.push(move)
                frames.append(
                    position(board)
                    | {
                        "san": san,
                        "uci": move.uci(),
                        "number": number,
                        "actor": "white" if actor else "black",
                        "report": reports.get(ply),
                    }
                )
            return {
                "id": game.id,
                "context": context,
                "history": cross_game_context(db, settings, game, reports, context),
                "white": game.white,
                "black": game.black,
                "played_on": game.played_on,
                "result": parsed.headers.get("Result", "*"),
                "orientation": "white" if game.learner_color else "black",
                "rating": rating,
                "white_rating": pgn_rating(parsed, True),
                "black_rating": pgn_rating(parsed, False),
                "frames": frames,
                "review_revision": max(revisions.values(), default=0),
                "job": job_progress(job, len(saved), len(frames) - 1, review),
                "accuracy": review_accuracy(
                    saved,
                    total=len(frames) - 1,
                    starting_board=parsed.board(),
                    completed=bool(job and job.status == "completed"),
                ),
            }

    @router.get(
        "/api/games/{game_id}/review",
        response_model=ReviewProgress,
        response_model_exclude_unset=True,
    )
    def review_progress(
        workspace: CurrentWorkspace,
        game_id: str,
        after: int = Query(0, ge=0),
        after_revision: int | None = Query(None, ge=0),
    ):
        with workspace.sessions() as db:
            game = require_game(db, game_id)
            review = db.get(GameReview, game_id)
            if review is None:
                return {"job": None, "moves": [], "accuracy": None, "revision": 0}
            job = db.get(AnalysisJob, review.job_id)
            parsed = parsed_game(game)
            total = sum(1 for _ in parsed.mainline_moves())
            saved, revisions = load_game_reports(db, game_id)
            if after_revision is not None:
                plies = [ply for ply in saved if revisions[ply] > after_revision]
            else:
                ceiling = job.positions_triaged if job.status in {"queued", "running"} else total
                plies = [ply for ply in saved if after < ply <= ceiling]
            reports, context = present_game(
                parsed, saved, review.rating, completed=bool(job and job.status == "completed")
            )
            moves = []
            for ply in plies:
                report = reports[ply]
                # Board positions are loaded once. Progress needs new display
                # fields, not repeated full witness lines or legal-move lists.
                moves.append(
                    {
                        "ply": ply,
                        "report": {
                            key: report[key]
                            for key in (
                                "label",
                                "engine_label",
                                "opening",
                                "reason",
                                "coach",
                                "best",
                                "actual",
                                "white_score",
                                "depth",
                                "engine_version",
                                "board_cues",
                                "human",
                                "practical",
                                "refinement",
                                "intelligence",
                            )
                            if key in report
                        },
                    }
                )
            accuracy = None
            if job and job.status == "completed":
                accuracy = review_accuracy(
                    saved, total=total, starting_board=parsed.board(), completed=True
                )
            return {
                "job": job_progress(job, len(saved), total, review),
                "moves": moves,
                "context": context,
                "history": cross_game_context(db, settings, game, reports, context),
                "accuracy": accuracy,
                "revision": max([after_revision or 0, *(revisions[ply] for ply in plies)]),
            }

    @router.post(
        "/api/games/{game_id}/review", response_model=JobStarted, response_model_exclude_unset=True
    )
    def begin_review(workspace: CurrentWorkspace, game_id: str, data: ReviewRequest):
        with workspace.mutation_lock, workspace.sessions() as db:
            game = require_game(db, game_id)
            review = db.get(GameReview, game_id)
            if review:
                if data.rating is not None:
                    review.rating = data.rating
                job = db.get(AnalysisJob, review.job_id)
                refresh = job.status == "completed" and bool(
                    settings.review_refinement_positions
                    and (data.refine or review.refinement_plan is None)
                )
                if data.refine and job.status not in {"queued", "running"}:
                    review.refinement_plan = None
                    for task in db.scalars(
                        select(ReviewRefinement).where(
                            ReviewRefinement.game_id == game_id,
                            ReviewRefinement.status == "unavailable",
                        )
                    ):
                        task.status, task.reason = "pending", None
                if job.status == "completed" and workspace.human_models.can_attempt():
                    parsed = parsed_game(game)
                    starting = parsed.board().turn
                    refresh = refresh or any(
                        workspace.human_models.needs_refresh(
                            row.report.get("human"),
                            parsed,
                            starting if row.ply % 2 else not starting,
                            review.rating,
                        )
                        for row in db.scalars(
                            select(GameReviewMove).where(GameReviewMove.game_id == game_id)
                        )
                    )
                if job.status in {"failed", "cancelled"} or refresh:
                    job.status, job.cancel_requested, job.error = "queued", False, None
                    job.positions_triaged = 0
            else:
                job = AnalysisJob(kind="game_review", games_total=1)
                db.add(job)
                db.flush()
                db.add(GameReview(game_id=game_id, job_id=job.id, rating=data.rating or 1000))
            db.commit()
            return {"job_id": job.id, "status": job.status}

    @router.post(
        "/api/games/{game_id}/position",
        response_model=GamePosition,
        response_model_exclude_unset=True,
    )
    def variation_position(workspace: CurrentWorkspace, game_id: str, data: VariationRequest):
        with workspace.sessions() as db:
            game = require_game(db, game_id)
            board = branch_board(game, data.ply, data.moves)
        san = None
        if board.move_stack:
            before = board.copy(stack=True)
            move = before.pop()
            san = before.san(move)
        return position(board) | {"san": san}

    @router.post(
        "/api/games/{game_id}/train",
        status_code=202,
        response_model=JobStarted,
        response_model_exclude_unset=True,
    )
    def train_game(workspace: CurrentWorkspace, game_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            require_game(db, game_id)
            active = db.scalar(
                select(AnalysisJob)
                .join(ImportGame, ImportGame.import_id == AnalysisJob.import_id)
                .where(
                    ImportGame.game_id == game_id,
                    AnalysisJob.kind == "training",
                    AnalysisJob.status.in_(["queued", "running"]),
                )
            )
            if active:
                return {"job_id": active.id, "status": active.status}
            batch = ImportBatch(filename="Selected game training", original_pgn="")
            db.add(batch)
            db.flush()
            db.add(ImportGame(import_id=batch.id, game_id=game_id, is_new=True))
            job = AnalysisJob(kind="training", import_id=batch.id, games_total=1)
            db.add(job)
            db.commit()
            return {"job_id": job.id, "status": job.status}

    @router.post(
        "/api/games/{game_id}/analyze",
        response_model=GameAnalysis,
        response_model_exclude_unset=True,
    )
    def analyze_variation(workspace: CurrentWorkspace, game_id: str, data: VariationRequest):
        with workspace.sessions() as db:
            game = require_game(db, game_id)
            board = branch_board(game, data.ply, data.moves)
            parsed = parsed_game(game)
            review = db.get(GameReview, game_id)
            rating = review.rating if review else 1000
        with workspace.variation_lock:
            engine = engine_factory(settings, workspace.sessions)
            try:
                if not board.move_stack:
                    if board.is_game_over():
                        return {"report": None, "score": None, "best_move": None}
                    result = engine.analyze(board, deep=True, multipv=2)
                    best = result.candidates[0]
                    score = Score.model_validate(best["score"])
                    return {
                        "report": None,
                        "best_move": best["san"],
                        "score": (score if board.turn else score.negate()).model_dump(),
                    }
                move = board.pop()
                fallback = rating
                rating = pgn_rating(parsed, board.turn) or fallback
                previous_score = None
                if board.move_stack:
                    previous = board.copy(stack=True)
                    previous.pop()
                    result = engine.analyze(previous, deep=True, multipv=2)
                    previous_score = Score.model_validate(result.candidates[0]["score"]).negate()
                report = analyze_move(engine, board, move, previous_score)
            finally:
                engine.close()
            report["human"] = workspace.human_models.evidence(
                workspace.sessions,
                parsed,
                board,
                move.uci(),
                report["best"]["uci"],
                fallback,
            )
            context = move_contexts(parsed).get(data.ply) if not data.moves else None
            report = public_report(report, rating, context=context)
            return {"report": report, "score": report["white_score"], "best_move": None}

    return router
