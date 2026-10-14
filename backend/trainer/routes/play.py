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
    PracticeCourses,
)
from trainer.models import PlayGame, User
from trainer.play.book import (
    book_for,
    book_moves,
    bot_moved,
    carried_on,
    deviation_verdict,
    judged,
    kept_playing,
    learner_moved,
    practice_courses,
    practice_lines,
    replayed,
    start_practice,
    taken_back,
)
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
from trainer.study_lessons.providers import CourseProviders
from trainer.workspaces import CurrentWorkspace


def create_router(
    *, settings, fits: LevelFits | None = None, courses: CourseProviders | None = None
) -> APIRouter:
    router = APIRouter()
    fits = fits or LevelFits()
    courses = courses or CourseProviders()

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

    def practice_book(db, play):
        """The game's book, from the course revision it started with when still installed."""
        if not play.practice:
            return None
        practice = play.practice
        installed = [course for course in courses.courses(db) if course.id == practice["course_id"]]
        course = next(
            (course for course in installed if course.revision == practice["revision"]),
            installed[-1] if installed else None,
        )
        return book_for(course) if course else None

    def off_book(play):
        """Off book, the bot does not answer until the learner goes back or carries on."""
        return bool(play.practice) and play.practice["status"] == "deviation"

    def waiting_on_learner(play):
        """Off book, or at the end of the line, the bot waits for the learner's choice."""
        return bool(play.practice) and play.practice["status"] in {"deviation", "book_end"}

    def rewind(db, play, ply):
        """Back to an earlier position on the learner's turn, to play another move there.

        The moves after it, and their reports, are gone. A practice game picks up its
        book where it stood; at the end of the line, the new move means playing on.
        """
        play.moves = play.moves[:ply]
        play.reports = {key: value for key, value in play.reports.items() if int(key) <= ply}
        if not play.practice:
            return
        book = practice_book(db, play)
        if book is not None:
            play.practice = replayed(play.practice, book, learner_is_white(play), play.moves)
        if play.practice["status"] == "book_end":
            play.practice = kept_playing(play.practice)
        elif play.practice["status"] == "deviation":
            play.practice = carried_on(play.practice)

    def compute_reply(workspace, play, book):
        """Engine and model work runs between transactions, never inside one."""
        board = board_for(play)
        if not bot_to_move(play, board):
            return None
        with workspace.variation_lock:
            return choose_reply(
                workspace.engine, workspace.human_models, workspace.sessions, play, board, book
            )

    def judge_deviation(workspace, play):
        deviation = play.practice["deviation"]
        before = board_for(play, deviation["ply"] - 1)
        with workspace.variation_lock:
            return deviation_verdict(
                workspace.engine, before, deviation["uci"], book_moves(play.practice)
            )

    def apply_reply(db, play, choice, name, book):
        """The bot answers, and the game ends here when the board says so. It never resigns."""
        if choice is None or play.status != "active":
            return None
        play.moves = [*play.moves, choice.uci]
        board = board_for(play)
        if play.practice and book is not None:
            play.practice = bot_moved(play.practice, book, board)
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

    @router.get("/api/play/openings", response_model=PracticeCourses)
    def opening_courses(workspace: CurrentWorkspace):
        with workspace.sessions() as db:
            return {"courses": practice_courses(courses.courses(db))}

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
                practice = None
                if data.course_id:
                    course = courses.get(db, data.course_id)
                    if not practice_lines(course):
                        raise HTTPException(422, "That course has no lines to practice.")
                    color, practice = course.learner_color, start_practice(course)
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
                    practice=practice,
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
                if data.rewind and data.ply < len(play.moves):
                    if board_for(play, data.ply).turn != learner_is_white(play):
                        raise HTTPException(409, "It is not your move there.")
                    rewind(db, play, data.ply)
                if data.ply != len(play.moves):
                    raise HTTPException(409, "The board has moved on; refresh the game.")
                board = board_for(play)
                if board.turn != learner_is_white(play):
                    raise HTTPException(409, "It is not your move.")
                if waiting_on_learner(play):
                    raise HTTPException(409, "Choose to keep playing or go again first.")
                move = legal_move(board, data.uci)
                if play.practice:
                    book = practice_book(db, play)
                    if book is not None:
                        play.practice = learner_moved(play.practice, book, board, move)
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
                if waiting_on_learner(play):
                    if not off_book(play) or play.practice["deviation"]["verdict"] is not None:
                        return state(play, name)
                elif not bot_to_move(play, board_for(play)):
                    return state(play, name, last_reply(play) if play.status == "active" else None)
                book = practice_book(db, play)
                # A rewind while the engine works makes its answer stale.
                moves = list(play.moves)
            if off_book(play):
                # Off book the bot waits; the reply request reports how the move compares.
                verdict = judge_deviation(workspace, play)
                with workspace.sessions() as db:
                    play = require_play(db, play_id)
                    if (
                        play.moves == moves
                        and off_book(play)
                        and play.practice["deviation"]["verdict"] is None
                    ):
                        before = board_for(play, play.practice["deviation"]["ply"] - 1)
                        play.practice = judged(play.practice, before, verdict)
                        db.commit()
                    return state(play, name)
            choice = compute_reply(workspace, play, book)
            with workspace.sessions() as db:
                play = require_play(db, play_id)
                if play.moves[: len(moves)] != moves:
                    raise HTTPException(409, "The game went back while the bot was thinking.")
                reply = (
                    apply_reply(db, play, choice, name, book)
                    if bot_to_move(play, board_for(play)) and not waiting_on_learner(play)
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
            analysed = play.moves[: data.ply]
        if saved:
            return {"report": saved, "score": saved["white_score"], "best_move": None}
        if data.ply > len(play.moves):
            raise HTTPException(409, "That move has not been played yet.")
        with workspace.variation_lock:
            report = analyze_ply(
                workspace.engine, workspace.human_models, workspace.sessions, play, data.ply, name
            )
        with workspace.mutation_lock, workspace.sessions() as db:
            play = require_play(db, play_id)
            # A take-back can replace the move while it is analysed; keep only a
            # report that still describes the game.
            if play.moves[: data.ply] != analysed:
                raise HTTPException(409, "That move was taken back.")
            play.reports = {**play.reports, str(data.ply): report}
            db.commit()
        return {"report": report, "score": report["white_score"], "best_move": None}

    def require_practice(db, play_id, status):
        play = require_play(db, play_id)
        if play.status != "active":
            raise HTTPException(409, "This game has finished.")
        if not play.practice or play.practice["status"] != status:
            raise HTTPException(409, "There is nothing to answer here.")
        return play

    def require_deviation(db, play_id):
        return require_practice(db, play_id, "deviation")

    @router.post(
        "/api/play/{play_id}/takeback", response_model=PlayState, response_model_exclude_unset=True
    )
    def take_back(workspace: CurrentWorkspace, play_id: str):
        """Opening practice: undo the learner's off-book move and try again."""
        with workspace.mutation_lock, workspace.sessions() as db:
            play = require_deviation(db, play_id)
            name = learner_name(db, workspace)
            ply = play.practice["deviation"]["ply"]
            play.moves = play.moves[: ply - 1]
            play.reports = {key: value for key, value in play.reports.items() if int(key) < ply}
            play.practice = taken_back(play.practice)
            db.commit()
            return state(play, name)

    @router.post(
        "/api/play/{play_id}/carry-on", response_model=PlayState, response_model_exclude_unset=True
    )
    def carry_on(workspace: CurrentWorkspace, play_id: str):
        """Opening practice: keep the off-book move and play on as an ordinary game."""
        with workspace.mutation_lock, workspace.sessions() as db:
            play = require_deviation(db, play_id)
            name = learner_name(db, workspace)
            play.practice = carried_on(play.practice)
            db.commit()
            return state(play, name)

    @router.post(
        "/api/play/{play_id}/keep-playing",
        response_model=PlayState,
        response_model_exclude_unset=True,
    )
    def keep_playing(workspace: CurrentWorkspace, play_id: str):
        """Opening practice: the line is over; play on as an ordinary game."""
        with workspace.mutation_lock, workspace.sessions() as db:
            play = require_practice(db, play_id, "book_end")
            name = learner_name(db, workspace)
            play.practice = kept_playing(play.practice)
            db.commit()
            return state(play, name)

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
