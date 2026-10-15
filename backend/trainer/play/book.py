"""Opening practice: a Lessons course's repertoire lines as the bot's book.

The lines are merged into one tree keyed by position, so a transposition (the
Dragon's 2.Nc3 and 3.Nc3 lines both reaching the main Dragon) joins the line it
transposes into. While the game stays in that tree the bot answers from it, choosing
among the book moves the way a player at the chosen rating would; once the learner
leaves it, or the book ends, the game carries on as an ordinary game.
"""

from dataclasses import dataclass

import chess

from trainer.chess_core import Score, evaluation_loss, position_key
from trainer.contracts.play import HUMAN_RATINGS
from trainer.human_models.runtime import HumanUnavailable
from trainer.play.bot import BotChoice, mate_lost_cp
from trainer.recent_cache import RecentCache

# Every book move keeps at least this share of the choice, so rarer lines still
# come up in practice instead of the most popular reply every time.
MINIMUM_SHARE = 0.1
# An off-book move this close to the book move by Stockfish is still fine.
FINE_LOSS_CP = 30
# Human-like play stops improving above the top human rating, so the policy is capped there.
POLICY_RATING_CAP = HUMAN_RATINGS[1]


@dataclass(frozen=True)
class Book:
    course_id: str
    title: str
    learner_color: str
    moves: dict[str, tuple[str, ...]]

    def book_moves(self, board: chess.Board) -> tuple[str, ...]:
        return self.moves.get(position_key(board), ())


def practice_lines(course):
    """Repertoire lines from the standard start; other lines are lesson drills."""
    return [
        line
        for line in course.lines
        if line.repertoire and line.position.initial_fen == chess.STARTING_FEN
    ]


def practice_courses(courses) -> list[dict]:
    return [
        {
            "id": course.id,
            "title": course.title,
            "learner_color": course.learner_color,
            "lines": len(lines),
        }
        for course in courses
        if (lines := practice_lines(course))
    ]


# Books by (course id, revision). Each admin edit makes a new revision, so only
# the most recently used few are kept.
_books = RecentCache(32)


def cached_book(course_id, revision) -> Book | None:
    """The book already built for this exact revision, without listing any course."""
    return _books.get((course_id, revision))


def book_for(course) -> Book:
    return _books.get_or_make((course.id, course.revision), lambda: _build(course))


def _build(course) -> Book:
    tree: dict[str, list[str]] = {}
    for line in practice_lines(course):
        board = chess.Board(line.position.initial_fen)
        for uci in line.position.moves + line.moves:
            continuations = tree.setdefault(position_key(board), [])
            if uci not in continuations:
                continuations.append(uci)
            board.push_uci(uci)
    return Book(
        course_id=course.id,
        title=course.title,
        learner_color=course.learner_color,
        moves={key: tuple(moves) for key, moves in tree.items()},
    )


def book_weights(book_moves, policy) -> dict[str, float]:
    """The policy restricted to the book moves, as shares summing to one.

    Every book move gets at least MINIMUM_SHARE; the rest keeps the policy's
    proportions. Without a policy, or with too many moves for the floor, the shares
    are equal.
    """
    shares = {uci: 0.0 for uci in book_moves}
    if policy is not None:
        for row in policy.moves:
            if row.uci in shares:
                shares[row.uci] = row.probability or 0.0
    total = sum(shares.values())
    equal = {uci: 1 / len(shares) for uci in shares}
    if total <= 0 or len(shares) * MINIMUM_SHARE >= 1:
        return equal
    floored: set[str] = set()
    while True:
        free = [uci for uci in shares if uci not in floored]
        free_total = sum(shares[uci] for uci in free)
        if not free or free_total <= 0:
            return equal
        mass = 1 - MINIMUM_SHARE * len(floored)
        scaled = {uci: mass * shares[uci] / free_total for uci in free}
        low = {uci for uci, share in scaled.items() if share < MINIMUM_SHARE}
        if not low:
            return {uci: scaled.get(uci, MINIMUM_SHARE) for uci in shares}
        floored |= low


def book_reply(human_models, sessions, request, board: chess.Board, book_moves, rng) -> BotChoice:
    """No engine work: book replies are ready as soon as the learner's move is saved.

    ``request`` is the bot's Maia request for this position (``bot_policy_request``).
    """
    policy = None
    if len(book_moves) > 1 and human_models is not None:
        try:
            policy, _ = human_models.policy(sessions, request)
        except HumanUnavailable:
            policy = None
    weights = book_weights(book_moves, policy)
    pick = rng.random() * sum(weights.values())
    chosen = book_moves[-1]
    for uci in book_moves:
        pick -= weights[uci]
        if pick <= 0:
            chosen = uci
            break
    move = chess.Move.from_uci(chosen)
    return BotChoice(uci=chosen, san=board.san(move), source="book", best_score=None)


def deviation_verdict(engine, board: chess.Board, played: str, book_moves) -> dict:
    """Compare the learner's move with the best book move in one restricted search."""
    roots = list(dict.fromkeys([played, *book_moves]))
    result = engine.analyze(board, root_moves=roots, multipv=len(roots))
    scores = {c["uci"]: Score.model_validate(c["score"]) for c in result.candidates}
    book_scores = [(uci, scores[uci]) for uci in book_moves if uci in scores]
    if played not in scores or not book_scores:
        return {"verdict": "fine", "loss_cp": 0}
    best_uci, best = max(book_scores, key=lambda row: row[1].order_key())
    loss = evaluation_loss(best, scores[played])
    if loss.allows_mate:
        # Shown as walking into a mate the book move avoids.
        return {"verdict": "worse", "loss_cp": None, "compared_with": best_uci}
    # A mate the book move had and the learner's move gives up counts as a forced
    # mate's usual 1000 cp, so it is reported as a loss, not a mate walked into.
    cp = loss.cp if loss.cp is not None else mate_lost_cp(best, scores[played])
    return {
        "verdict": "fine" if cp <= FINE_LOSS_CP else "worse",
        "loss_cp": cp,
        "compared_with": best_uci,
    }


# Where a practice game stands against its book. The state is stored on the game as
# JSON; every transition returns a new dict so the change is saved. "book_moves" are
# the learner's book moves at the spot they are deciding: the current position on
# their turn in book, or the position they left the book from.


def start_practice(course) -> dict:
    book = book_for(course)
    learner_first = course.learner_color == "white"
    return {
        "course_id": course.id,
        "revision": course.revision,
        "title": course.title,
        "status": "book",
        "ended": None,
        "deviation": None,
        "book_moves": list(book.book_moves(chess.Board())) if learner_first else [],
    }


def _book_end(practice: dict) -> dict:
    """The line is over; the game waits until the learner keeps playing or goes again."""
    return {**practice, "status": "book_end", "deviation": None, "book_moves": []}


def _ended(practice: dict, reason: str) -> dict:
    return {**practice, "status": "ended", "ended": reason, "deviation": None, "book_moves": []}


def learner_moved(practice: dict, book: Book, before: chess.Board, move: chess.Move) -> dict:
    """In book the game plays on; off book it waits for the learner's choice."""
    if practice["status"] != "book":
        return practice
    book_moves = book.book_moves(before)
    if not book_moves:
        return _book_end(practice)
    after = before.copy(stack=False)
    after.push(move)
    if move.uci() in book_moves:
        if not book.book_moves(after):
            return _book_end(practice)
        return {**practice, "book_moves": []}
    return {
        **practice,
        "status": "deviation",
        "book_moves": list(book_moves),
        "deviation": {
            "ply": before.ply() + 1,
            "san": before.san(move),
            "uci": move.uci(),
            "book": [before.san(chess.Move.from_uci(uci)) for uci in book_moves],
            "verdict": None,
            "loss_cp": None,
            "compared_with": None,
        },
    }


def bot_moved(practice: dict, book: Book, after: chess.Board) -> dict:
    if practice["status"] != "book":
        return practice
    book_moves = book.book_moves(after)
    if not book_moves:
        return _book_end(practice)
    return {**practice, "book_moves": list(book_moves)}


def judged(practice: dict, before: chess.Board, verdict: dict) -> dict:
    deviation = dict(practice["deviation"])
    compared = verdict.get("compared_with")
    deviation.update(
        verdict=verdict["verdict"],
        loss_cp=verdict["loss_cp"],
        compared_with=before.san(chess.Move.from_uci(compared)) if compared else None,
    )
    return {**practice, "deviation": deviation}


def taken_back(practice: dict) -> dict:
    """Back to the book, at the spot the learner left it."""
    return {**practice, "status": "book", "deviation": None}


def replayed(practice: dict, book: Book, learner_white: bool, moves) -> dict:
    """Where the practice stands after these moves, for a game rewound to them.

    A spot the learner already answered (off book, or the end of the line) followed
    by more moves was answered by playing on, so the replay plays on there too.
    """
    board = chess.Board()
    state = {
        **practice,
        "status": "book",
        "ended": None,
        "deviation": None,
        "book_moves": list(book.book_moves(board)) if learner_white else [],
    }
    for uci in moves:
        if state["status"] == "deviation":
            state = carried_on(state)
        elif state["status"] == "book_end":
            state = kept_playing(state)
        move = chess.Move.from_uci(uci)
        if board.turn == learner_white:
            state = learner_moved(state, book, board, move)
            board.push(move)
        else:
            board.push(move)
            state = bot_moved(state, book, board)
    return state


def carried_on(practice: dict) -> dict:
    return _ended(practice, "carried_on")


def kept_playing(practice: dict) -> dict:
    return _ended(practice, "book_end")


DEVIATION_FIELDS = ("ply", "san", "uci", "book", "verdict", "loss_cp", "compared_with")


def book_moves(practice: dict) -> list[str]:
    """Games started before "Show book move" kept the off-book spot's moves elsewhere."""
    deviation = practice.get("deviation") or {}
    return practice.get("book_moves") or deviation.get("book_uci") or []


def practice_view(practice: dict | None) -> dict | None:
    if not practice:
        return None
    deviation = practice["deviation"]
    return {
        "course_id": practice["course_id"],
        "title": practice["title"],
        "status": practice["status"],
        "ended": practice["ended"],
        "deviation": {key: deviation[key] for key in DEVIATION_FIELDS} if deviation else None,
        "book_moves": book_moves(practice),
    }
