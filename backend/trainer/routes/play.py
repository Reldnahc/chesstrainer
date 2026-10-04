"""Playing a game against the selected coach's bot."""

import random

import chess
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from trainer.chess_core import legal_move
from trainer.contracts.games import GameAnalysis
from trainer.contracts.play import (
    ActivePlay,
    PlayMoveRequest,
    PlayProfile,
    PlayRequest,
    PlayState,
    PlyRequest,
)
from trainer.engine import EngineUnavailable
from trainer.models import PlayGame, User
from trainer.play.level import LevelFits
from trainer.play.sessions import (
    analyze_ply,
    board_for,
    board_outcome,
    bot_to_move,
    choose_reply,
    finish,
    learner_is_white,
    result_for,
    state,
)
from trainer.workspaces import CurrentWorkspace


def create_router(*, settings, fits: LevelFits | None = None) -> APIRouter:
    router = APIRouter()
    fits = fits or LevelFits()

    def learner_name(db, workspace):
        user = db.get(User, workspace.user_id) if settings.accounts_enabled else None
        return user.username if user else "You"

    def require_play(db, play_id):
        play = db.get(PlayGame, play_id)
        if play is None:
            raise HTTPException(404, "That game was not found.")
        return play

    def active_play(db):
        return db.scalar(
            select(PlayGame).where(PlayGame.status == "active").order_by(PlayGame.created_at.desc())
        )

    def compute_reply(workspace, play):
        """Engine and model work runs between transactions, never inside one."""
        board = board_for(play)
        if not bot_to_move(play, board):
            return None
        with workspace.variation_lock:
            try:
                return choose_reply(
                    workspace.engine, workspace.human_models, workspace.sessions, play, board
                )
            except EngineUnavailable as exc:
                raise HTTPException(503, str(exc)) from exc

    def apply_reply(db, play, choice, name):
        """The bot answers, and the game ends here when the board says so. It never resigns."""
        if choice is None or play.status != "active":
            return None
        play.moves = [*play.moves, choice.uci]
        board = board_for(play)
        outcome = board_outcome(board)
        if outcome:
            finish(db, play, *result_for(outcome), name)
        return {
            "ply": len(play.moves),
            "san": choice.san,
            "uci": choice.uci,
            "source": choice.source,
        }

    def last_reply(play):
        """A repeated reply request after the bot has moved returns that same move."""
        if not play.moves:
            return None
        board = board_for(play, len(play.moves) - 1)
        move = chess.Move.from_uci(play.moves[-1])
        return {
            "ply": len(play.moves),
            "san": board.san(move),
            "uci": move.uci(),
            "source": "human",
        }

    @router.get("/api/play/profile", response_model=PlayProfile)
    def level_profile(workspace: CurrentWorkspace):
        return fits.profile(workspace)

    @router.post("/api/play/profile/refresh", response_model=PlayProfile)
    def refresh_level_profile(workspace: CurrentWorkspace):
        return fits.profile(workspace, refresh=True)

    @router.get("/api/play/active", response_model=ActivePlay, response_model_exclude_unset=True)
    def active_game(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            play = active_play(db)
            return {"game": state(play, learner_name(db, workspace)) if play else None}

    @router.post("/api/play", response_model=PlayState, response_model_exclude_unset=True)
    def start_game(workspace: CurrentWorkspace, data: PlayRequest):
        with workspace.mutation_lock:
            with workspace.sessions() as db:
                name = learner_name(db, workspace)
                previous = active_play(db)
                if previous:
                    # One game at a time. An abandoned game is not worth a review.
                    previous.status, previous.result = "finished", "*"
                    previous.termination = "abandoned"
                color = data.color if data.color != "random" else random.choice(["white", "black"])
                profile = fits.profile(workspace)
                play = PlayGame(
                    coach_id=data.coach_id,
                    coach_name=data.coach_name,
                    learner_color=color == "white",
                    opponent_kind=data.opponent,
                    opponent_rating=data.rating,
                    learner_rating=profile["default_rating"],
                    commentary="live",
                    moves=[],
                    reports={},
                )
                db.add(play)
                db.commit()
                return state(play, name)

    @router.get("/api/play/{play_id}", response_model=PlayState, response_model_exclude_unset=True)
    def game_state(workspace: CurrentWorkspace, play_id: str):
        with workspace.sessions() as db:
            play = require_play(db, play_id)
            return state(play, learner_name(db, workspace))

    @router.post(
        "/api/play/{play_id}/move", response_model=PlayState, response_model_exclude_unset=True
    )
    def play_move(workspace: CurrentWorkspace, play_id: str, data: PlayMoveRequest):
        with workspace.mutation_lock:
            with workspace.sessions() as db:
                play = require_play(db, play_id)
                name = learner_name(db, workspace)
                if play.status != "active":
                    raise HTTPException(409, "This game has finished.")
                if data.ply != len(play.moves):
                    raise HTTPException(409, "The board has moved on; refresh the game.")
                board = board_for(play)
                if board.turn != learner_is_white(play):
                    raise HTTPException(409, "It is not your move.")
                try:
                    move = legal_move(board, data.uci)
                except ValueError as exc:
                    raise HTTPException(422, str(exc)) from exc
                play.moves = [*play.moves, move.uci()]
                board.push(move)
                outcome = board_outcome(board)
                if outcome:
                    finish(db, play, *result_for(outcome), name)
                # The learner's move is saved and shown before any engine work; the
                # client asks for the reply separately, so the board never waits.
                db.commit()
                return state(play, name)

    @router.post(
        "/api/play/{play_id}/reply", response_model=PlayState, response_model_exclude_unset=True
    )
    def bot_reply(workspace: CurrentWorkspace, play_id: str):
        with workspace.mutation_lock:
            with workspace.sessions() as db:
                play = require_play(db, play_id)
                name = learner_name(db, workspace)
                if not bot_to_move(play, board_for(play)):
                    return state(play, name, last_reply(play) if play.status == "active" else None)
            choice = compute_reply(workspace, play)
            with workspace.sessions() as db:
                play = require_play(db, play_id)
                reply = (
                    apply_reply(db, play, choice, name)
                    if bot_to_move(play, board_for(play))
                    else last_reply(play)
                )
                db.commit()
                return state(play, name, reply)

    @router.post(
        "/api/play/{play_id}/analyze",
        response_model=GameAnalysis,
        response_model_exclude_unset=True,
    )
    def analyze_play_move(workspace: CurrentWorkspace, play_id: str, data: PlyRequest):
        with workspace.sessions() as db:
            play = require_play(db, play_id)
            name = learner_name(db, workspace)
            saved = play.reports.get(str(data.ply))
        if saved:
            return {"report": saved, "score": saved["white_score"], "best_move": None}
        if data.ply > len(play.moves):
            raise HTTPException(409, "That move has not been played yet.")
        with workspace.variation_lock:
            try:
                report = analyze_ply(
                    workspace.engine,
                    workspace.human_models,
                    workspace.sessions,
                    play,
                    data.ply,
                    name,
                )
            except EngineUnavailable as exc:
                raise HTTPException(503, str(exc)) from exc
        with workspace.mutation_lock, workspace.sessions() as db:
            play = require_play(db, play_id)
            play.reports = {**play.reports, str(data.ply): report}
            db.commit()
        return {"report": report, "score": report["white_score"], "best_move": None}

    @router.post(
        "/api/play/{play_id}/resign", response_model=PlayState, response_model_exclude_unset=True
    )
    def resign(workspace: CurrentWorkspace, play_id: str):
        with workspace.mutation_lock, workspace.sessions() as db:
            play = require_play(db, play_id)
            name = learner_name(db, workspace)
            if play.status != "active":
                raise HTTPException(409, "This game has finished.")
            finish(db, play, "0-1" if learner_is_white(play) else "1-0", "resignation", name)
            db.commit()
            return state(play, name)

    return router
