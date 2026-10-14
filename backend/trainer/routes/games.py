"""Game library, resumable whole-game review and legal variation analysis."""

import io
import math
from datetime import timezone
from typing import Annotated

import chess
import chess.pgn
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from trainer import job_lifecycle
from trainer.chess_core import Score
from trainer.contracts.common import JobStarted
from trainer.contracts.games import (
    GameAnalysis,
    GameDetail,
    GameExport,
    GameHistory,
    GamePosition,
    ReviewProgress,
)
from trainer.game_accuracy import review_accuracy
from trainer.game_analysis import DEFAULT_RATING, request_review
from trainer.game_library import pgn_rating, time_control_label
from trainer.game_review import analyze_move, branch_board, parsed_game, position, public_report
from trainer.job_lifecycle import JobStatus
from trainer.models import (
    AnalysisJob,
    Game,
    GameReview,
)
from trainer.review_intelligence.clocks import control as clock_control
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
            if job.status in job_lifecycle.ACTIVE
            else completed,
            "total": total,
            "error": job.error,
            "cancel_requested": job.cancel_requested,
            "phase": "complete"
            if job.status == JobStatus.COMPLETED
            else "refinement"
            if plan and job.positions_triaged >= total
            else "baseline",
            "refinement_completed": plan["completed"] if plan else 0,
            "refinement_total": len(plan["tasks"]) if plan else 0,
        }
        if job
        else None
    )


class GameView:
    """Read-only sessions bound to a game's owner, for anyone holding its link.

    With accounts enabled a review link opens for any visitor, signed in or not.
    Only the owner's own workspace may change the game, so writes keep using
    CurrentWorkspace and return 404 to everyone else. Single-user mode never
    reaches another account's games.
    """

    def __init__(self, sessions, owned):
        self.sessions, self.owned = sessions, owned


def game_view(request: Request, game_id: str):
    app = request.app.state
    if app.settings.accounts_enabled:
        user = getattr(request.state, "user", None)
        viewer = user["id"] if user else None
    else:
        viewer = "local"
    sql_engine = app.workspaces.sql_engine
    # The one cross-account read: which account owns this game, if any.
    with sql_engine.connect() as connection:
        owner = connection.scalar(select(Game.user_id).where(Game.id == game_id))
    if owner is None or (owner != viewer and not app.settings.accounts_enabled):
        raise HTTPException(404, "Game not found")
    return GameView(app.workspaces.sessions(owner), owner == viewer)


ViewedGame = Annotated[GameView, Depends(game_view)]


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
            completed_ids = [game.id for game, status in rows if status == JobStatus.COMPLETED]
            saved = load_accuracy_scores(db, completed_ids)
            items = []
            backfill = {}
            for game, status in rows:
                # Headers are enough for the library; replaying moves is the slow part.
                headers = chess.pgn.read_headers(io.StringIO(game.pgn)) or chess.pgn.Headers()
                plies = game.move_count
                if plies is None:
                    plies = backfill[game.id] = sum(1 for _ in parsed_game(game).mainline_moves())
                time_control = headers.get("TimeControl")
                items.append(
                    {
                        "id": game.id,
                        "white": game.white,
                        "black": game.black,
                        "white_rating": pgn_rating(headers, True),
                        "black_rating": pgn_rating(headers, False),
                        "learner_color": "white" if game.learner_color else "black",
                        "played_on": game.played_on,
                        "played_at": game.played_at.replace(tzinfo=timezone.utc).isoformat()
                        if game.played_at
                        else None,
                        "result": headers.get("Result", "*"),
                        "time_control": time_control,
                        "time_control_label": time_control_label(time_control),
                        "move_count": (plies + 1) // 2,
                        "status": status or "not_started",
                        "accuracy": review_accuracy(
                            saved[game.id],
                            total=plies,
                            starting_board=chess.Board(headers["FEN"])
                            if "FEN" in headers
                            else chess.Board(),
                            completed=status == JobStatus.COMPLETED,
                        ),
                    }
                )
            total = db.scalar(select(func.count()).select_from(Game))
            if backfill:
                # Rows imported before move counts were saved: one short write per page.
                # The lock is taken before anything is written. Writing first (an
                # autoflushed row) and then waiting for the lock deadlocks with a
                # background job that holds the lock while waiting to write.
                with workspace.mutation_lock:
                    for game_id, plies in backfill.items():
                        db.execute(update(Game).where(Game.id == game_id).values(move_count=plies))
                    db.commit()
            return {"items": items, "total": total}

    @router.get("/api/games/{game_id}/export", response_model=GameExport)
    def game_export(view: ViewedGame, game_id: str):
        # Only what export needs: no reports, review state or legal moves.
        with view.sessions() as db:
            game = require_game(db, game_id)
            parsed = parsed_game(game)
            board = parsed.board()
            positions = [{"fen": board.fen(), "uci": None}]
            for move in parsed.mainline_moves():
                board.push(move)
                positions.append({"fen": board.fen(), "uci": move.uci()})
            return {
                "white": game.white,
                "black": game.black,
                "result": parsed.headers.get("Result", "*"),
                "orientation": "white" if game.learner_color else "black",
                "pgn": game.pgn.strip() + "\n",
                "positions": positions,
            }

    @router.get(
        "/api/games/{game_id}", response_model=GameDetail, response_model_exclude_unset=True
    )
    def game_detail(view: ViewedGame, game_id: str):
        with view.sessions() as db:
            game = require_game(db, game_id)
            parsed = parsed_game(game)
            board = parsed.board()
            review = db.get(GameReview, game_id)
            job = db.get(AnalysisJob, review.job_id) if review else None
            rating = review.rating if review else DEFAULT_RATING
            saved, revisions = load_game_reports(db, game_id)
            reports, context = present_game(
                parsed, saved, rating, completed=bool(job and job.status == JobStatus.COMPLETED)
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
            for ply, node in enumerate(parsed.mainline(), 1):
                move = node.move
                san, number, actor = board.san(move), board.fullmove_number, board.turn
                board.push(move)
                frame = position(board) | {
                    "san": san,
                    "uci": move.uci(),
                    "number": number,
                    "actor": "white" if actor else "black",
                    "report": reports.get(ply),
                }
                remaining = node.clock()
                if remaining is not None and math.isfinite(remaining) and remaining >= 0:
                    frame["clock"] = remaining
                frames.append(frame)
            _, clock_start, _ = clock_control(parsed.headers.get("TimeControl"))
            return {
                "id": game.id,
                "context": context,
                # The owner's other games stay private, so viewers get no history.
                **(
                    {"history": cross_game_context(db, settings, game, reports, context)}
                    if view.owned
                    else {}
                ),
                "read_only": not view.owned,
                "white": game.white,
                "black": game.black,
                "played_on": game.played_on,
                "result": parsed.headers.get("Result", "*"),
                "orientation": "white" if game.learner_color else "black",
                "rating": rating,
                "white_rating": pgn_rating(parsed, True),
                "black_rating": pgn_rating(parsed, False),
                **({"clock_start": clock_start} if clock_start is not None else {}),
                "frames": frames,
                "review_revision": max(revisions.values(), default=0),
                "job": job_progress(job, len(saved), len(frames) - 1, review),
                "accuracy": review_accuracy(
                    saved,
                    total=len(frames) - 1,
                    starting_board=parsed.board(),
                    completed=bool(job and job.status == JobStatus.COMPLETED),
                ),
            }

    @router.get(
        "/api/games/{game_id}/review",
        response_model=ReviewProgress,
        response_model_exclude_unset=True,
    )
    def review_progress(
        view: ViewedGame,
        game_id: str,
        after: int = Query(0, ge=0),
        after_revision: int | None = Query(None, ge=0),
    ):
        with view.sessions() as db:
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
                ceiling = job.positions_triaged if job.status in job_lifecycle.ACTIVE else total
                plies = [ply for ply in saved if after < ply <= ceiling]
            reports, context = present_game(
                parsed,
                saved,
                review.rating,
                completed=bool(job and job.status == JobStatus.COMPLETED),
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
                                "immediate_reply",
                                "immediate_recapture",
                            )
                            if key in report
                        },
                    }
                )
            accuracy = None
            if job and job.status == JobStatus.COMPLETED:
                accuracy = review_accuracy(
                    saved, total=total, starting_board=parsed.board(), completed=True
                )
            return {
                "job": job_progress(job, len(saved), total, review),
                "moves": moves,
                "context": context,
                **(
                    {"history": cross_game_context(db, settings, game, reports, context)}
                    if view.owned
                    else {}
                ),
                "accuracy": accuracy,
                "revision": max([after_revision or 0, *(revisions[ply] for ply in plies)]),
            }

    @router.post(
        "/api/games/{game_id}/review", response_model=JobStarted, response_model_exclude_unset=True
    )
    def begin_review(workspace: CurrentWorkspace, game_id: str, data: ReviewRequest):
        with workspace.mutation_lock, workspace.sessions() as db:
            job = request_review(
                db,
                require_game(db, game_id),
                rating=data.rating,
                refine=data.refine,
                settings=settings,
                human_models=workspace.human_models,
            )
            db.commit()
            return {"job_id": job.id, "status": job.status}

    @router.post(
        "/api/games/{game_id}/position",
        response_model=GamePosition,
        response_model_exclude_unset=True,
    )
    def variation_position(view: ViewedGame, game_id: str, data: VariationRequest):
        with view.sessions() as db:
            game = require_game(db, game_id)
            board = branch_board(game, data.ply, data.moves)
        san = None
        if board.move_stack:
            before = board.copy(stack=True)
            move = before.pop()
            san = before.san(move)
        return position(board) | {"san": san}

    @router.post(
        "/api/games/{game_id}/analyze",
        response_model=GameAnalysis,
        response_model_exclude_unset=True,
    )
    def analyze_variation(
        view: ViewedGame, workspace: CurrentWorkspace, game_id: str, data: VariationRequest
    ):
        # Signed-in viewers may analyze a shared game; the engine runs as their account.
        with view.sessions() as db:
            game = require_game(db, game_id)
            board = branch_board(game, data.ply, data.moves)
            parsed = parsed_game(game)
            review = db.get(GameReview, game_id)
            rating = review.rating if review else DEFAULT_RATING
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
