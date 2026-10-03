"""Move choice for the coach's bot.

Human-like levels sample the Maia policy conditioned on the chosen rating. Stockfish
is only a guardrail: it vetoes the few mistakes players at that rating practically
never make, so the bot keeps a human error profile instead of an engine's
"perfect, then a random blunder" one. Engine levels use Stockfish's own limiter.
"""

import random
from dataclasses import dataclass

import chess

from trainer.chess_core import Score, digest, engine_context, evaluation_loss
from trainer.human_models.types import Conditioning, Domain, HumanRequest

VERSION = "coach-bot-1"
# From each rating upward the bot refuses moves that allow a forced mate, then
# moves that lose at least this many centipawns against the engine's best.
GUARDS = ((1200, "mate"), (1400, 900), (1800, 500), (2200, 300))
SAMPLES = 5
GUARD_MULTIPV = 4
ENGINE_MOVE_SECONDS = 0.4


@dataclass
class BotChoice:
    uci: str
    san: str
    source: str
    # The engine's view of the position before the move, from the bot's side.
    best_score: Score | None
    samples: int = 0


def bot_request(board: chess.Board, rating: int, opponent_rating: int) -> HumanRequest:
    """Condition the policy on the bot's rating against the learner's fitted one."""
    return HumanRequest(
        history=engine_context(board),
        mover="white" if board.turn else "black",
        conditioning=Conditioning(
            self_rating=rating,
            opponent_rating=opponent_rating,
            self_source="pgn",
            opponent_source="pgn",
        ),
        domain=Domain(
            platform="unknown",
            time_control=None,
            time_class=None,
            alignment="unknown",
            history_from_start=board.root().fen() == chess.STARTING_FEN,
            reasons=["live_game_against_bot"],
        ),
    )


def seeded(game_id: str, ply: int) -> random.Random:
    """A retry of the same move request must choose the same reply."""
    return random.Random(int(digest([VERSION, game_id, ply])[:12], 16))


def guard_violated(rating: int, loss) -> bool:
    for minimum, rule in GUARDS:
        if rating < minimum:
            continue
        if rule == "mate" and loss.allows_mate:
            return True
        if rule != "mate" and loss.cp is not None and loss.cp >= rule:
            return True
    return False


def sample_order(probabilities: dict[str, float], rng: random.Random, count: int) -> list[str]:
    """Weighted draws without replacement, most likely first among equal draws."""
    remaining = {uci: p for uci, p in probabilities.items() if p > 0}
    order = []
    while remaining and len(order) < count:
        total = sum(remaining.values())
        pick = rng.random() * total
        chosen = None
        for uci, p in sorted(remaining.items(), key=lambda row: (-row[1], row[0])):
            pick -= p
            chosen = uci
            if pick <= 0:
                break
        order.append(chosen)
        del remaining[chosen]
    return order


def human_move(engine, board: chess.Board, policy, rating: int, rng) -> BotChoice:
    probabilities = {row.uci: row.probability or 0.0 for row in policy.moves}
    legal = {move.uci() for move in board.legal_moves}
    probabilities = {uci: p for uci, p in probabilities.items() if uci in legal}
    if not probabilities:
        raise ValueError("The human policy covers none of the legal moves")
    guard = engine.analyze(board, multipv=min(GUARD_MULTIPV, len(legal)))
    scores = {c["uci"]: Score.model_validate(c["score"]) for c in guard.candidates}
    best = scores[guard.candidates[0]["uci"]]
    checked = []
    for uci in sample_order(probabilities, rng, SAMPLES):
        if uci not in scores:
            probe = engine.analyze(board, root_moves=[uci], multipv=1)
            scores[uci] = Score.model_validate(probe.candidates[0]["score"])
        loss = evaluation_loss(best, scores[uci])
        checked.append((uci, loss))
        if not guard_violated(rating, loss):
            return _choice(board, uci, "human", best, len(checked))
    # Every draw failed the guard: keep the least damaging human candidate rather
    # than switching to the engine's move, which would change the bot's character.
    uci = min(checked, key=lambda row: (row[1].allows_mate, row[1].cp or 0))[0]
    return _choice(board, uci, "fallback", best, len(checked))


def _choice(board, uci, source, best, samples):
    move = chess.Move.from_uci(uci)
    return BotChoice(
        uci=uci,
        san=board.san(move),
        source=source,
        best_score=best,
        samples=samples,
    )


def engine_move(engine, board: chess.Board, rating: int, rng) -> BotChoice:
    uci = engine.play_limited(board, rating, ENGINE_MOVE_SECONDS)
    move = chess.Move.from_uci(uci)
    return BotChoice(
        uci=uci,
        san=board.san(move),
        source="engine",
        best_score=None,
    )
