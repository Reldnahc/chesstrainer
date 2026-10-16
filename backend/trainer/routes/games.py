"""Game library, resumable whole-game review and legal variation analysis."""

import io
from typing import Annotated

import chess
import chess.pgn
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select

from trainer import job_lifecycle
from trainer.authz import shared_links
from trainer.chess_core import Score
from trainer.contracts.common import JobStarted
from trainer.contracts.games import (
    GameAnalysis,
    GameDetail,
    GameExport,
    GameHistory,
    GamePosition,
    ReviewProgress,
    ReviewRequest,
    VariationRequest,
)
from trainer.game_accuracy import review_accuracy
from trainer.game_analysis import DEFAULT_RATING, request_review
from trainer.game_library import mover_rating, pgn_rating, time_control_label
from trainer.game_review import (
    PROGRESS_KEYS,
    branch_board,
    move_frames,
    parsed_game,
    position,
    public_report,
    review_move,
)
from trainer.job_lifecycle import JobStatus
from trainer.models import (
    AnalysisJob,
    Game,
    GameReview,
)
from trainer.ownership import LOCAL_USER_ID
from trainer.review_intelligence.clocks import annotation as clock_annotation
from trainer.review_intelligence.clocks import control as clock_control
from trainer.review_intelligence.context import move_contexts
from trainer.review_intelligence.history import (
    cross_game_context,
    recent_cross_game_context,
)
from trainer.review_intelligence.presentation import presented_review
from trainer.review_reports import load_accuracy_scores
from trainer.search_limits import DEEP
from trainer.workspaces import CurrentWorkspace


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
        viewer = LOCAL_USER_ID
    sql_engine = app.workspaces.sql_engine
    # The one cross-account read: which account owns this game, if any.
    with sql_engine.connect() as connection:
        owner = connection.scalar(select(Game.user_id).where(Game.id == game_id))
    if owner is None or (owner != viewer and not app.settings.accounts_enabled):
        raise HTTPException(404, "Game not found")
    return GameView(app.workspaces.sessions(owner), owner == viewer)


ViewedGame = Annotated[GameView, Depends(game_view)]


def create_router(*, settings):
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
                .order_by(Game.played_at.desc(), Game.created_at.desc(), Game.id.desc())
                .offset(offset)
                .limit(limit)
            ).all()
            completed_ids = [game.id for game, status in rows if status == JobStatus.COMPLETED]
            saved = load_accuracy_scores(db, completed_ids)
            items = []
            for game, status in rows:
                # Headers are enough for the library; replaying moves is the slow part.
                headers = chess.pgn.read_headers(io.StringIO(game.pgn)) or chess.pgn.Headers()
                plies = game.move_count
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
                        "played_at": game.played_at.isoformat() if game.played_at else None,
                        "result": headers.get("Result", "*"),
                        "time_control": time_control,
                        "time_control_label": time_control_label(time_control),
                        "move_count": (plies + 1) // 2,
                        "status": status or "not_started",
                        "accuracy": review_accuracy(
                            saved[game.id],
                            total=plies,
                            starting_board=headers.board(),
                            completed=status == JobStatus.COMPLETED,
                        ),
                    }
                )
            total = db.scalar(select(func.count()).select_from(Game))
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

    @shared_links.route(
        router.get,
        "/api/games/{game_id}",
        response_model=GameDetail,
        response_model_exclude_unset=True,
    )
    def game_detail(view: ViewedGame, game_id: str):
        with view.sessions() as db:
            game = require_game(db, game_id)
            parsed = parsed_game(game)
            board = parsed.board()
            review = db.get(GameReview, game_id)
            job = db.get(AnalysisJob, review.job_id) if review else None
            presented = presented_review(
                db, game, parsed, review, completed=bool(job and job.status == JobStatus.COMPLETED)
            )
            saved, revisions = presented.saved, presented.revisions
            reports, context = presented.reports, presented.context
            nodes = list(parsed.mainline())

            def clock(ply):
                # The same validated annotation Insights and clock facts read.
                remaining, _ = clock_annotation(nodes[ply - 1], "clk")
                return {} if remaining is None else {"clock": remaining}

            frames = move_frames(
                board,
                [node.move for node in nodes],
                reports,
                result=parsed.headers.get("Result"),
                extra=clock,
            )
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
                "rating": review.rating if review else DEFAULT_RATING,
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

    @shared_links.route(
        router.get,
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
            completed = bool(job and job.status == JobStatus.COMPLETED)
            presented = presented_review(db, game, parsed, review, completed=completed)
            saved, revisions = presented.saved, presented.revisions
            reports, context = presented.reports, presented.context
            if after_revision is not None:
                plies = [ply for ply in saved if revisions[ply] > after_revision]
            else:
                ceiling = job.positions_triaged if job.status in job_lifecycle.ACTIVE else total
                plies = [ply for ply in saved if after < ply <= ceiling]
            moves = []
            for ply in plies:
                report = reports[ply]
                # Board positions are loaded once. Progress needs new display
                # fields, not repeated full witness lines or legal-move lists.
                moves.append(
                    {
                        "ply": ply,
                        "report": {key: report[key] for key in PROGRESS_KEYS if key in report},
                    }
                )
            accuracy = None
            if job and job.status == JobStatus.COMPLETED:
                accuracy = review_accuracy(
                    saved, total=total, starting_board=parsed.board(), completed=True
                )
            revision = max([after_revision or 0, *(revisions[ply] for ply in plies)])
            history = (
                recent_cross_game_context(
                    db, settings, game, reports, context, (review.revision, completed)
                )
                if view.owned
                else None
            )
            return {
                "job": job_progress(job, len(saved), total, review),
                "moves": moves,
                "context": context,
                **({"history": history} if view.owned else {}),
                "accuracy": accuracy,
                "revision": revision,
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

    @shared_links.route(
        router.post,
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
        # The account's interactive engine, as Play uses: warm in single-user mode,
        # a pooled slot with accounts. One variation search at a time per account.
        with workspace.variation_lock:
            engine = workspace.engine
            if not board.move_stack:
                if board.is_game_over():
                    return {"report": None, "score": None, "best_move": None}
                result = engine.analyze(board, DEEP, multipv=2)
                best = result.candidates[0]
                score = Score.model_validate(best["score"])
                return {
                    "report": None,
                    "best_move": best["san"],
                    "score": (score if board.turn else score.negate()).model_dump(),
                }
            report = review_move(
                engine,
                workspace.human_models,
                workspace.sessions,
                parsed,
                board,
                fallback_rating=rating,
            )
            mover = not board.turn  # The side that made the analysed move.
            context = move_contexts(parsed).get(data.ply) if not data.moves else None
            report = public_report(report, mover_rating(parsed, mover, rating), context=context)
            return {"report": report, "score": report["white_score"], "best_move": None}

    return router
