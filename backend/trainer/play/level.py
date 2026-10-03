"""Fit the Maia rating that best predicts the learner's own moves.

Platform ratings do not transfer to Maia's Lichess-blitz scale, so the bot's
"match my level" setting is measured from imported games instead of copied from
a PGN header. The result is a fitted conditioning value, not a rating claim.
"""

import io
import logging
import math
import random
import statistics
import threading
from datetime import datetime, timezone

import chess
import chess.pgn
from sqlalchemy import func, select

from trainer.chess_core import digest, engine_context
from trainer.contracts.play import FALLBACK_LEARNER_RATING
from trainer.game_library import pgn_rating
from trainer.human_models.context import source_domain
from trainer.human_models.runtime import HumanUnavailable
from trainer.human_models.types import Conditioning, HumanRequest
from trainer.models import Game, PlayProfile

log = logging.getLogger(__name__)

VERSION = "level-fit-1"
GRID = (800, 1000, 1200, 1400, 1600, 1800, 2000, 2200)
POSITIONS = 60
FIRST_PLY, LAST_PLY = 8, 70


def learner_positions(games, limit=POSITIONS):
    """A fixed, reproducible sample of the learner's own decisions across the library."""
    rows = []
    for game in games:
        parsed = chess.pgn.read_game(io.StringIO(game.pgn))
        if parsed is None or parsed.board().fen() != chess.STARTING_FEN:
            continue
        board = parsed.board()
        moves = []
        for move in parsed.mainline_moves():
            ply = len(moves)
            if FIRST_PLY <= ply <= LAST_PLY and board.turn == game.learner_color:
                rows.append((parsed, list(moves), move.uci(), pgn_rating(parsed, board.turn)))
            moves.append(move.uci())
            board.push(move)
    random.Random(int(digest([VERSION, sorted(g.id for g in games)])[:12], 16)).shuffle(rows)
    return rows[:limit]


def fit_level(sessions, human_models, games, cancelled=lambda: False):
    rows = learner_positions(games)
    if not rows:
        return None
    totals = dict.fromkeys(GRID, 0.0)
    platform = None
    for parsed, moves, actual, _ in rows:
        board = chess.Board()
        for uci in moves:
            board.push_uci(uci)
        domain = source_domain(parsed, board)
        platform = platform or (domain.platform if domain.platform != "unknown" else None)
        for rating in GRID:
            request = HumanRequest(
                history=engine_context(board),
                mover="white" if board.turn else "black",
                conditioning=Conditioning(
                    self_rating=rating,
                    opponent_rating=rating,
                    self_source="fallback",
                    opponent_source="fallback",
                ),
                domain=domain,
            )
            policy, _ = human_models.policy(sessions, request, cancelled)
            probability = next((row.probability for row in policy.moves if row.uci == actual), 0)
            totals[rating] += math.log(max(probability or 0.0, 1e-9))
    fitted = max(GRID, key=lambda rating: (totals[rating], -rating))
    own = [rating for *_, rating in rows if rating]
    return {
        "fitted_rating": fitted,
        "platform_rating": int(statistics.median(own)) if own else None,
        "platform": platform,
        "positions": len(rows),
        "games": len(games),
    }


def profile_payload(row, games, human_models):
    fallback = FALLBACK_LEARNER_RATING
    if not games:
        status = "no_games"
    elif not human_models.settings.human_model_enabled:
        status = "disabled"
    elif row is None or row.status == "computing":
        status = "computing"
    else:
        status = row.status
    return {
        "status": status,
        "fitted_rating": row.fitted_rating if row else None,
        "platform_rating": row.platform_rating if row else None,
        "platform": row.platform if row else None,
        "positions": row.positions if row else 0,
        "games": games,
        "computed_at": row.computed_at.isoformat() if row and row.computed_at else None,
        "default_rating": row.fitted_rating if row and row.fitted_rating else fallback,
    }


class LevelFits:
    """One background fit per account at a time; results persist in play_profiles."""

    def __init__(self):
        self._running = set()
        self._guard = threading.Lock()

    def profile(self, workspace, *, refresh=False):
        human_models = workspace.human_models
        with workspace.sessions() as db:
            games = db.scalar(select(func.count()).select_from(Game)) or 0
            row = db.get(PlayProfile, workspace.user_id)
        stale = (
            row is None
            or row.games != games
            or row.configuration_key != human_models.configuration_key
        )
        if games and human_models.settings.human_model_enabled and (refresh or stale):
            if human_models.can_attempt():
                self._start(workspace, games)
                if row is None or refresh:
                    with workspace.sessions() as db:
                        row = db.get(PlayProfile, workspace.user_id)
                        if row is None:
                            row = PlayProfile(user_id=workspace.user_id, status="computing")
                            db.add(row)
                        else:
                            row.status = "computing"
                        db.commit()
            elif row is None:
                return profile_payload(None, games, human_models) | {"status": "unavailable"}
        return profile_payload(row, games, human_models)

    def _start(self, workspace, games):
        with self._guard:
            if workspace.user_id in self._running:
                return
            self._running.add(workspace.user_id)
        sessions, human_models, user_id = (
            workspace.sessions,
            workspace.human_models,
            workspace.user_id,
        )

        def run():
            try:
                with sessions() as db:
                    rows = list(db.scalars(select(Game)))
                result = fit_level(sessions, human_models, rows)
                status = "ready" if result else "no_games"
            except HumanUnavailable:
                result, status = None, "unavailable"
            except Exception:
                log.exception("level_fit_failed")
                result, status = None, "unavailable"
            finally:
                with self._guard:
                    self._running.discard(user_id)
            with sessions() as db:
                row = db.get(PlayProfile, user_id)
                if row is None:
                    row = PlayProfile(user_id=user_id)
                    db.add(row)
                row.status = status
                row.games = games
                row.configuration_key = human_models.configuration_key
                row.computed_at = datetime.now(timezone.utc)
                if result:
                    row.fitted_rating = result["fitted_rating"]
                    row.platform_rating = result["platform_rating"]
                    row.platform = result["platform"]
                    row.positions = result["positions"]
                db.commit()

        threading.Thread(target=run, name="play-level-fit", daemon=True).start()
