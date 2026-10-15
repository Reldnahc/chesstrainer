"""State of a game against the coach's bot, and its hand-off into the game library."""

import chess
import chess.pgn
from sqlalchemy import select

from trainer.chess_core import Score
from trainer.engine import ENGINE_ELO
from trainer.errors import InvalidInput
from trainer.game_analysis import REQUESTED, queue_imported
from trainer.game_library import mover_rating
from trainer.game_review import (
    engine_facts,
    game_outcome,
    link_previous_scores,
    move_frames,
    public_report,
    review_move,
)
from trainer.human_models.context import request_for
from trainer.human_models.runtime import HumanUnavailable
from trainer.imports import import_games
from trainer.models import ImportGame, PlayGame, now
from trainer.play import PLAY_EVENT, PLAY_SITE
from trainer.play.book import (
    POLICY_RATING_CAP,
    book_for,
    book_reply,
    bot_moved,
    cached_book,
    carried_on,
    kept_playing,
    practice_view,
    replayed,
)
from trainer.play.bot import engine_move, human_move, seeded
from trainer.recent_cache import RecentCache
from trainer.review_intelligence.context import move_contexts


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


def fallback_elo(play: PlayGame) -> int:
    """The engine setting that answers for a Human-like bot without the human model."""
    return max(ENGINE_ELO[0], play.opponent_rating)


def fallback_plies(play: PlayGame) -> list[int]:
    return list(play.fallback_plies or [])


def bot_setting(play: PlayGame) -> str:
    """What really chose the bot's moves, for the saved PGN.

    The Elo headers carry the model's conditioning values, which the review reuses;
    they are settings, not ratings.
    """
    if play.opponent_kind == "engine":
        return f"Stockfish UCI_Elo {play.opponent_rating}"
    setting = f"Maia-3 conditioned at {play.opponent_rating}"
    stood_in = len(fallback_plies(play))
    if stood_in:
        moves = "move" if stood_in == 1 else "moves"
        setting += (
            f"; Stockfish UCI_Elo {fallback_elo(play)} played {stood_in} {moves}"
            " while the human model was unavailable"
        )
    return setting


def parsed_for(play: PlayGame, learner_name: str, board: chess.Board | None = None):
    """The game as a PGN, so ratings, Maia domain and the saved review read it alike."""
    board = board or board_for(play)
    white, black = names(play, learner_name)
    white_rating, black_rating = ratings(play)
    game = chess.pgn.Game()
    game.headers.update(
        Event=PLAY_EVENT,
        Site=PLAY_SITE,
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
    game.headers["Bot"] = bot_setting(play)
    node = game
    for move in board.move_stack:
        node = node.add_variation(move)
    return game


# Rendered reports per Play game, keyed by what each rendering depends on (the
# moves so far, the ply's book departure, the saved searches and the human
# evidence). Only the current game's plies are kept, so a take-back drops the
# abandoned line.
_rendered = RecentCache(64)


def _render_key(play, ply, report, context=None):
    human = report.get("human") or {}
    # The ply's book departure is set by the game's last book move, so later
    # moves that transpose back into the catalogue move it: it is keyed, not frozen.
    departure = context.opening_departure if context else None
    return (
        tuple(play.moves[:ply]),
        tuple(sorted(departure.items())) if departure else None,
        report.get("previous_score") is not None,
        report.get("before_analysis_id"),
        report.get("played_analysis_id"),
        human.get("status"),
        human.get("evidence_id"),
        human.get("configuration_key"),
        play.learner_rating,
    )


def rendered_reports(play: PlayGame, parsed) -> dict[int, dict]:
    """Saved engine facts rendered with the current rules, exactly as game review does."""
    saved = link_previous_scores(
        {int(ply): engine_facts(report) for ply, report in (play.reports or {}).items()}
    )
    if not saved:
        return {}
    contexts = move_contexts(parsed)
    starting = parsed.board().turn
    known = _rendered.get(play.id) or {}
    current = {}
    output = {}
    for ply, report in saved.items():
        key = _render_key(play, ply, report, contexts.get(ply))
        rendered = known.get(key)
        if rendered is None:
            color = starting if ply % 2 else not starting
            rendered = public_report(
                report,
                mover_rating(parsed, color, play.learner_rating),
                context=contexts.get(ply),
            )
        current[key] = output[ply] = rendered
    _rendered.put(play.id, current)
    return output


def frames_for(play: PlayGame, learner_name: str) -> list[dict]:
    reports = rendered_reports(play, parsed_for(play, learner_name))
    moves = [chess.Move.from_uci(uci) for uci in play.moves]
    return move_frames(chess.Board(), moves, reports)


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
        "status": play.status,
        "result": play.result,
        "termination": play.termination,
        "saved_game_id": play.saved_game_id,
        "reply": reply,
        "practice": practice_view(play.practice),
        "fallback_plies": fallback_plies(play),
        "fallback_elo": fallback_elo(play) if play.opponent_kind == "human" else None,
        "frames": frames_for(play, learner_name),
    }


def finish(db, play: PlayGame, result: str, termination: str, learner_name: str):
    """Close the game and save it like any imported game, so the ordinary review runs."""
    play.status, play.result, play.termination = "finished", result, termination
    play.finished_at = now()
    pgn = parsed_for(play, learner_name).accept(
        chess.pgn.StringExporter(headers=True, variations=False, comments=False)
    )
    outcome = import_games(
        db,
        "Fieldwork play",
        pgn,
        [],
        "white" if learner_is_white(play) else "black",
        commit=False,
    )
    saved = db.scalar(
        select(ImportGame.game_id).where(ImportGame.import_id == outcome["import_id"])
    )
    play.saved_game_id = saved
    # The learner just played it, so its review goes first.
    queue_imported(db, outcome["import_id"], REQUESTED)
    return outcome


def board_outcome(board: chess.Board):
    return game_outcome(board)


def result_for(outcome) -> tuple[str, str]:
    return outcome.result(), outcome.termination.name.replace("_", " ").lower()


def bot_policy_request(play: PlayGame, board: chess.Board):
    """The bot's Maia request: the bot's rating against the learner's fitted one.

    It is built from the game's own PGN exactly as the live commentary's request is,
    so the bot's move and the commentary on it share one Maia answer. Book choices
    cap the bot's rating where the human policy stops improving.
    """
    parsed = parsed_for(play, "", board)
    rating = min(play.opponent_rating, POLICY_RATING_CAP)
    if rating == play.opponent_rating:
        return request_for(parsed, board, play.learner_rating)
    return request_for(parsed, board, None, ratings=(rating, play.learner_rating))


def choose_reply(engine, human_models, sessions, play: PlayGame, board: chess.Board, book=None):
    rng = seeded(play.id, len(play.moves))
    if book is not None and play.practice and play.practice["status"] == "book":
        book_moves = book.book_moves(board)
        if book_moves:
            request = bot_policy_request(play, board)
            return book_reply(human_models, sessions, request, board, book_moves, rng)
    if play.opponent_kind == "engine":
        return engine_move(engine, board, play.opponent_rating)
    request = bot_policy_request(play, board)
    try:
        policy, _ = human_models.policy(sessions, request)
    except HumanUnavailable:
        policy = None
    if policy is None:
        # Without the human model the bot still answers, at the engine's weakest
        # setting, and says so through the reply's source; the game records it.
        choice = engine_move(engine, board, fallback_elo(play))
        choice.source = "fallback"
        return choice
    return human_move(engine, board, policy, play.opponent_rating, rng)


def analyze_ply(engine, human_models, sessions, play: PlayGame, ply: int, learner_name: str):
    """The review's own engine evidence for the move at this ply, to save on the game.

    The previous score comes from the saved report for the ply before when there is
    one, as game review links them, so only an unanalysed predecessor costs a search.
    """
    if not 1 <= ply <= len(play.moves):
        raise InvalidInput("That move has not been played")
    board = board_for(play, ply)
    before = (play.reports or {}).get(str(ply - 1))
    previous = (
        Score.model_validate(before["best"]["score"]).negate() if before is not None else None
    )
    return review_move(
        engine,
        human_models,
        sessions,
        parsed_for(play, learner_name, board),
        board,
        fallback_rating=play.learner_rating,
        previous_score=previous,
    )


# The game's state machine. Routes load, lock and commit around these.


def practice_book(db, courses, play: PlayGame):
    """The game's book, from the course revision it started with when still installed."""
    if not play.practice:
        return None
    practice = play.practice
    book = cached_book(practice["course_id"], practice["revision"])
    if book is not None:
        return book
    installed = [course for course in courses.courses(db) if course.id == practice["course_id"]]
    course = next(
        (course for course in installed if course.revision == practice["revision"]),
        installed[-1] if installed else None,
    )
    return book_for(course) if course else None


def off_book(play: PlayGame) -> bool:
    """Off book, the bot does not answer until the learner goes back or carries on."""
    return bool(play.practice) and play.practice["status"] == "deviation"


def waiting_on_learner(play: PlayGame) -> bool:
    """Off book, or at the end of the line, the bot waits for the learner's choice."""
    return bool(play.practice) and play.practice["status"] in {"deviation", "book_end"}


def truncate(play: PlayGame, ply: int):
    """Keep the first ``ply`` moves and their reports; everything after is gone."""
    play.moves = play.moves[:ply]
    play.reports = {key: value for key, value in play.reports.items() if int(key) <= ply}
    if play.last_reply and play.last_reply["ply"] > ply:
        play.last_reply = None
    if play.fallback_plies:
        play.fallback_plies = [kept for kept in play.fallback_plies if kept <= ply]


def rewind(db, courses, play: PlayGame, ply: int):
    """Back to an earlier position on the learner's turn, to play another move there.

    A practice game picks up its book where it stood; at the end of the line, the
    new move means playing on.
    """
    truncate(play, ply)
    if not play.practice:
        return
    book = practice_book(db, courses, play)
    if book is not None:
        play.practice = replayed(play.practice, book, learner_is_white(play), play.moves)
    if play.practice["status"] == "book_end":
        play.practice = kept_playing(play.practice)
    elif play.practice["status"] == "deviation":
        play.practice = carried_on(play.practice)


def apply_reply(db, play: PlayGame, choice, learner_name: str, book):
    """The bot answers, and the game ends here when the board says so. It never resigns."""
    if choice is None or play.status != "active":
        return None
    play.moves = [*play.moves, choice.uci]
    board = board_for(play)
    if play.practice and book is not None:
        play.practice = bot_moved(play.practice, book, board)
    play.last_reply = {
        "ply": len(play.moves),
        "san": choice.san,
        "uci": choice.uci,
        "source": choice.source,
    }
    if choice.source == "fallback":
        play.fallback_plies = [*fallback_plies(play), len(play.moves)]
    outcome = board_outcome(board)
    if outcome:
        finish(db, play, *result_for(outcome), learner_name)
    return play.last_reply


def last_reply(play: PlayGame):
    """A repeated reply request after the bot has moved returns that same move and source."""
    if not play.moves:
        return None
    if play.last_reply and play.last_reply["ply"] == len(play.moves):
        return play.last_reply
    # Games saved before replies were recorded.
    board = board_for(play, len(play.moves) - 1)
    move = chess.Move.from_uci(play.moves[-1])
    return {"ply": len(play.moves), "san": board.san(move), "uci": move.uci(), "source": "human"}
