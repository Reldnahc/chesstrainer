"""State of a game against the coach's bot, and its hand-off into the game library."""

from datetime import datetime, timezone

import chess
import chess.pgn
from sqlalchemy import select

from trainer.chess_core import Score
from trainer.game_library import pgn_rating
from trainer.game_review import analyze_move, position, public_report
from trainer.human_models.runtime import HumanUnavailable
from trainer.imports import import_games
from trainer.models import ImportGame, PlayGame
from trainer.play.bot import bot_request, engine_move, human_move, seeded

RESIGN_SCORE_CP = -900
RESIGN_STREAK = 2
RESIGN_FROM_PLY = 20
DRAW_ACCEPT_CP = 60
DRAW_FROM_PLY = 40
LOSING_DRAW_CP = -300


def board_for(play: PlayGame, upto: int | None = None) -> chess.Board:
    board = chess.Board()
    for uci in play.moves[: len(play.moves) if upto is None else upto]:
        board.push_uci(uci)
    return board


def learner_is_white(play: PlayGame) -> bool:
    return bool(play.learner_color)


def bot_to_move(play: PlayGame, board: chess.Board) -> bool:
    return play.status == "active" and board.turn != learner_is_white(play)


def names(play: PlayGame, learner_name: str) -> tuple[str, str]:
    bot = f"{play.coach_name} (bot)"
    return (learner_name, bot) if learner_is_white(play) else (bot, learner_name)


def ratings(play: PlayGame) -> tuple[int, int]:
    learner, bot = play.learner_rating, play.opponent_rating
    return (learner, bot) if learner_is_white(play) else (bot, learner)


def parsed_for(play: PlayGame, learner_name: str, board: chess.Board | None = None):
    """The game as a PGN, so ratings, Maia domain and the saved review read it alike."""
    board = board or board_for(play)
    white, black = names(play, learner_name)
    white_rating, black_rating = ratings(play)
    game = chess.pgn.Game()
    game.headers.update(
        Event="Fieldwork play",
        Site="Fieldwork",
        Date=play.created_at.strftime("%Y.%m.%d") if play.created_at else "????.??.??",
        Round="-",
        White=white,
        Black=black,
        Result=play.result or "*",
        WhiteElo=str(white_rating),
        BlackElo=str(black_rating),
        TimeControl="-",
        Termination=play.termination or "unterminated",
    )
    node = game
    for move in board.move_stack:
        node = node.add_variation(move)
    return game


def frames_for(play: PlayGame) -> list[dict]:
    board = chess.Board()
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
    for ply, uci in enumerate(play.moves, 1):
        move = chess.Move.from_uci(uci)
        san, number, actor = board.san(move), board.fullmove_number, board.turn
        board.push(move)
        frames.append(
            position(board)
            | {
                "san": san,
                "uci": uci,
                "number": number,
                "actor": "white" if actor else "black",
                "report": play.reports.get(str(ply)),
            }
        )
    return frames


def state(play: PlayGame, learner_name: str, reply=None) -> dict:
    white, black = names(play, learner_name)
    white_rating, black_rating = ratings(play)
    return {
        "id": play.id,
        "coach_id": play.coach_id,
        "coach_name": play.coach_name,
        "white": white,
        "black": black,
        "learner_color": "white" if learner_is_white(play) else "black",
        "opponent": play.opponent_kind,
        "rating": play.opponent_rating,
        "learner_rating": play.learner_rating,
        "white_rating": white_rating,
        "black_rating": black_rating,
        "commentary": play.commentary,
        "status": play.status,
        "result": play.result,
        "termination": play.termination,
        "saved_game_id": play.saved_game_id,
        "reply": reply,
        "draw_declined": bool(play.draw_declined),
        "frames": frames_for(play),
    }


def finish(db, play: PlayGame, result: str, termination: str, learner_name: str):
    """Close the game and save it like any imported game, so the ordinary review runs."""
    play.status, play.result, play.termination = "finished", result, termination
    play.finished_at = datetime.now(timezone.utc)
    pgn = parsed_for(play, learner_name).accept(
        chess.pgn.StringExporter(headers=True, variations=False, comments=False)
    )
    outcome = import_games(
        db,
        "Fieldwork play",
        pgn,
        [],
        "white" if learner_is_white(play) else "black",
        queue_analysis=True,
        commit=False,
    )
    saved = db.scalar(
        select(ImportGame.game_id).where(ImportGame.import_id == outcome["import_id"])
    )
    play.saved_game_id = saved
    return outcome


def board_outcome(board: chess.Board):
    return board.outcome(claim_draw=True)


def result_for(outcome) -> tuple[str, str]:
    return outcome.result(), outcome.termination.name.replace("_", " ").lower()


def choose_reply(engine, human_models, sessions, play: PlayGame, board: chess.Board):
    rng = seeded(play.id, len(play.moves))
    if play.opponent_kind == "engine":
        return engine_move(engine, board, play.opponent_rating, rng)
    request = bot_request(board, play.opponent_rating, play.learner_rating)
    try:
        policy, _ = human_models.policy(sessions, request)
    except HumanUnavailable:
        policy = None
    if policy is None:
        # Without the human model the bot still answers, at the engine's weakest
        # human-like setting, and says so through the reply's source.
        choice = engine_move(engine, board, max(1320, play.opponent_rating), rng)
        choice.source = "fallback"
        return choice
    return human_move(engine, board, policy, play.opponent_rating, rng)


def bot_resigns(play: PlayGame, choice) -> bool:
    """A clearly lost bot resigns after a couple of hopeless moves, like a person would."""
    if play.opponent_kind != "human" or play.opponent_rating < 1000:
        return False
    score = choice.best_score
    hopeless = score is not None and (
        (score.kind == "cp" and score.value <= RESIGN_SCORE_CP) or score.outcome() == -1
    )
    play.losing_streak = play.losing_streak + 1 if hopeless else 0
    return hopeless and play.losing_streak >= RESIGN_STREAK and len(play.moves) >= RESIGN_FROM_PLY


def bot_accepts_draw(engine, play: PlayGame, board: chess.Board) -> bool:
    """Accept when the bot stands no better than level late on, or is clearly worse."""
    if board.is_game_over(claim_draw=True):
        return True
    result = engine.analyze(board, multipv=1)
    score = Score.model_validate(result.candidates[0]["score"])
    if board.turn == learner_is_white(play):
        score = score.negate()
    if score.kind == "mate":
        return score.outcome() == -1
    if len(play.moves) >= DRAW_FROM_PLY:
        return score.value <= DRAW_ACCEPT_CP
    return score.value <= LOSING_DRAW_CP


def analyze_ply(engine, human_models, sessions, play: PlayGame, ply: int, learner_name: str):
    """The review's own per-move report for the move at this ply, saved on the game."""
    if not 1 <= ply <= len(play.moves):
        raise ValueError("That move has not been played")
    board = board_for(play, ply)
    parsed = parsed_for(play, learner_name, board)
    move = board.pop()
    fallback = play.learner_rating
    rating = pgn_rating(parsed, board.turn) or fallback
    previous_score = None
    if board.move_stack:
        previous = board.copy(stack=True)
        previous.pop()
        result = engine.analyze(previous, deep=True, multipv=2)
        previous_score = Score.model_validate(result.candidates[0]["score"]).negate()
    report = analyze_move(engine, board, move, previous_score)
    report["human"] = human_models.evidence(
        sessions, parsed, board, move.uci(), report["best"]["uci"], fallback
    )
    return public_report(report, rating)
