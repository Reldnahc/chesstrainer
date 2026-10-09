"""Opening practice: a Lessons course's repertoire lines as the bot's book.

The lines are merged into one tree keyed by position, so a transposition (the
Dragon's 2.Nc3 and 3.Nc3 lines both reaching the main Dragon) joins the line it
transposes into. While the game stays in that tree the bot answers from it, choosing
among the book moves the way a player at the chosen rating would; once the learner
leaves it, or the book ends, the game carries on as an ordinary game.
"""

from dataclasses import dataclass

import chess

from trainer.chess_core import Score, evaluation_loss
from trainer.human_models.runtime import HumanUnavailable
from trainer.play.bot import BotChoice, bot_request

# Every book move keeps at least this share of the choice, so rarer lines still
# come up in practice instead of the most popular reply every time.
MINIMUM_SHARE = 0.1
# An off-book move this close to the book move by Stockfish is still fine.
FINE_LOSS_CP = 30
# Human-like play stops improving above this rating, so the policy is capped there.
POLICY_RATING_CAP = 2500


def position_key(board: chess.Board) -> str:
    """The position without move counters, so transpositions share a node."""
    return board.epd()


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


_books: dict[tuple[str, str], Book] = {}


def book_for(course) -> Book:
    key = (course.id, course.revision)
    if key not in _books:
        _books[key] = _build(course)
    return _books[key]


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
    """The policy restricted to the book moves, with a floor for the rare ones."""
    shares = {uci: 0.0 for uci in book_moves}
    if policy is not None:
        for row in policy.moves:
            if row.uci in shares:
                shares[row.uci] = row.probability or 0.0
    total = sum(shares.values())
    if total <= 0:
        return {uci: 1.0 for uci in book_moves}
    return {uci: max(share / total, MINIMUM_SHARE) for uci, share in shares.items()}


def book_move(human_models, sessions, play, board: chess.Board, book_moves, rng) -> BotChoice:
    """No engine work: book replies are ready as soon as the learner's move is saved."""
    policy = None
    if len(book_moves) > 1 and human_models is not None:
        rating = min(play.opponent_rating, POLICY_RATING_CAP)
        try:
            policy, _ = human_models.policy(
                sessions, bot_request(board, rating, play.learner_rating)
            )
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
    best_uci, best = max(book_scores, key=lambda row: _order(row[1]))
    loss = evaluation_loss(best, scores[played])
    if loss.allows_mate or loss.mate_lost:
        return {"verdict": "worse", "loss_cp": None, "compared_with": best_uci}
    cp = loss.cp or 0
    return {
        "verdict": "fine" if cp <= FINE_LOSS_CP else "worse",
        "loss_cp": cp,
        "compared_with": best_uci,
    }


def _order(score: Score):
    """Sort key for scores from the mover's side: mates beat any centipawns."""
    if score.kind == "mate":
        if score.outcome() == 1:
            return (2, -score.value)
        return (0, -score.value)
    return (1, score.value)


# Where a practice game stands against its book. The state is stored on the game as
# JSON; every transition returns a new dict so the change is saved.


def start_practice(course) -> dict:
    return {
        "course_id": course.id,
        "revision": course.revision,
        "title": course.title,
        "status": "book",
        "ended": None,
        "deviation": None,
        "misses": {},
        "hint": [],
    }


def _ended(practice: dict, reason: str) -> dict:
    return {**practice, "status": "ended", "ended": reason, "deviation": None, "hint": []}


def learner_moved(practice: dict, book: Book, before: chess.Board, move: chess.Move) -> dict:
    """In book the game plays on; off book it waits for the learner's choice."""
    if practice["status"] != "book":
        return practice
    book_moves = book.book_moves(before)
    if not book_moves:
        return _ended(practice, "book_end")
    after = before.copy(stack=False)
    after.push(move)
    if move.uci() in book_moves:
        if not book.book_moves(after):
            return _ended(practice, "book_end")
        return {**practice, "hint": []}
    spot = str(before.ply())
    misses = {**practice.get("misses", {}), spot: practice.get("misses", {}).get(spot, 0) + 1}
    return {
        **practice,
        "status": "deviation",
        "misses": misses,
        "hint": [],
        "deviation": {
            "ply": before.ply() + 1,
            "san": before.san(move),
            "uci": move.uci(),
            "book": [before.san(chess.Move.from_uci(uci)) for uci in book_moves],
            "book_uci": list(book_moves),
            "verdict": None,
            "loss_cp": None,
            "compared_with": None,
            "repeated": misses[spot] > 1,
        },
    }


def bot_moved(practice: dict, book: Book, after: chess.Board) -> dict:
    if practice["status"] == "book" and not book.book_moves(after):
        return _ended(practice, "book_end")
    return practice


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
    """Back to the book; a spot missed more than once shows the book move."""
    deviation = practice["deviation"]
    repeated = deviation["repeated"]
    return {
        **practice,
        "status": "book",
        "deviation": None,
        "hint": list(deviation["book_uci"]) if repeated else [],
    }


def carried_on(practice: dict) -> dict:
    return _ended(practice, "carried_on")


def practice_view(practice: dict | None) -> dict | None:
    if not practice:
        return None
    deviation = practice["deviation"]
    return {
        "course_id": practice["course_id"],
        "title": practice["title"],
        "status": practice["status"],
        "ended": practice["ended"],
        "deviation": (
            {key: value for key, value in deviation.items() if key != "book_uci"}
            if deviation
            else None
        ),
        "hint": practice["hint"],
    }
