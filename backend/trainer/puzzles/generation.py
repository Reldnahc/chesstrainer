"""Mine verified multi-move puzzles from the learner's own saved games.

Candidates come from evidence the analysis job already saved; only the line
builder and the payoff check search. Every learner move in a kept line is the
engine's unique best move by the pack verifier's margins, every opponent reply
is the engine's best defence rather than the move the opponent chose, and the
line ends in mate or clearly ahead. Everything else is recorded as an abstention
with its reason, so a game is searched once per generator version and never
when a page opens. Generation writes no exercise, recall or weakness evidence.
"""

import io
from contextlib import nullcontext
from dataclasses import dataclass

import chess
import chess.pgn
from sqlalchemy import func, select
from sqlalchemy.orm import aliased

from trainer.chess_core import Score, legal_move, material, position_key
from trainer.contracts.puzzles import PuzzleProvenance
from trainer.lichess_patterns import recognize
from trainer.models import (
    AnalysisJob,
    Decision,
    EngineAnalysis,
    Game,
    GamePuzzle,
    GamePuzzleSearch,
    GameReviewMove,
)
from trainer.puzzles.definitions import PuzzleDefinition
from trainer.puzzles.verification import (
    MARGIN_CP,
    MATE_SCORE,
    PAYOFF_CP,
    describe,
    is_mate,
    payoff_ok,
    rival_verdict,
    score_int,
)
from trainer.search_limits import SearchLimits

GENERATOR_VERSION = "games-v1"
PROVIDER_ID = "your-games"
JOB_KIND = "puzzle_generation"
# A missed win: the learner gave up at least MIN_LOSS_CP from a position worth MIN_WIN_CP.
MIN_LOSS_CP = 150
MIN_WIN_CP = 150
# Lichess length tags count solver moves; a single decision is never a puzzle here.
LENGTH_THEMES = {2: "short", 3: "long"}


@dataclass(frozen=True)
class Prospect:
    """A learner decision whose saved evidence suggests a missed mate or win."""

    ply: int
    kind: str
    played_san: str
    source: str
    decision_id: str | None
    saved_best_san: str
    saved_unique: bool


@dataclass(frozen=True)
class Line:
    uci: str
    score: int  # The mover's perspective, mate-encoded like python-chess.
    pv: tuple[str, ...]
    depth: int


@dataclass(frozen=True)
class Built:
    solution: tuple[str, ...]
    decisions: list[dict]
    payoff: int
    stop: str


def classify_scores(best: int, played: int) -> str | None:
    """The candidate kind for two learner-perspective scores at one root, or None."""
    if is_mate(best) and best > 0:
        return None if is_mate(played) and played > 0 else "missed_mate"
    if best >= MIN_WIN_CP and played <= best - MIN_LOSS_CP:
        return "missed_win"
    return None


def _saved_unique(best: int, second: int | None) -> bool:
    return second is not None and rival_verdict(best, second) in {"unique", "slower_mate"}


def _score(payload) -> int:
    return score_int(Score.model_validate(payload))


def decision_prospects(db, game):
    """Candidates from the training pipeline's saved decisions, plus every judged ply."""
    played_analysis = aliased(EngineAnalysis)
    rows = db.execute(
        select(Decision, EngineAnalysis.candidates, played_analysis.candidates)
        .join(EngineAnalysis, EngineAnalysis.id == Decision.before_analysis_id)
        .join(played_analysis, played_analysis.id == Decision.played_analysis_id)
        .where(Decision.game_id == game.id)
        .order_by(Decision.ply)
    )
    found, plies = [], set()
    for decision, candidates, played in rows:
        plies.add(decision.ply)
        if not candidates or not played:
            continue
        best = _score(candidates[0]["score"])
        kind = classify_scores(best, _score(played[0]["score"]))
        if kind is None:
            continue
        second = _score(candidates[1]["score"]) if len(candidates) > 1 else None
        found.append(
            Prospect(
                ply=decision.ply,
                kind=kind,
                played_san=decision.move_san,
                source="decision",
                decision_id=decision.id,
                saved_best_san=candidates[0]["san"],
                saved_unique=_saved_unique(best, second),
            )
        )
    return found, plies


def review_prospects(db, game, skip):
    """Candidates from full-game review reports on plies the training pipeline never judged."""
    rows = db.execute(
        select(GameReviewMove.ply, GameReviewMove.report)
        .where(GameReviewMove.game_id == game.id)
        .order_by(GameReviewMove.ply)
    )
    for ply, report in rows:
        frames = (report.get("actual_line") or {}).get("frames") or []
        if ply in skip or not frames:
            continue
        if (frames[0]["fen"].split()[1] == "w") != game.learner_color:
            continue
        best = _score(report["best"]["score"])
        kind = classify_scores(best, _score(report["actual"]["score"]))
        if kind is None:
            continue
        second = report.get("second_score")
        yield Prospect(
            ply=ply,
            kind=kind,
            played_san=report["actual"]["san"],
            source="review",
            decision_id=None,
            saved_best_san=report["best"]["san"],
            saved_unique=_saved_unique(best, _score(second) if second else None),
        )


def prospects(db, game) -> list[Prospect]:
    found, plies = decision_prospects(db, game)
    found.extend(review_prospects(db, game, plies))
    found.sort(key=lambda item: item.ply)
    return found


def root_board(game, ply) -> chess.Board:
    """The position before the learner's move at ``ply``, with its full history."""
    parsed = chess.pgn.read_game(io.StringIO(game.pgn))
    board = parsed.board()
    for index, move in enumerate(parsed.mainline_moves(), start=1):
        if index == ply:
            return board
        board.push(move)
    raise ValueError("Ply is beyond the saved game")


class EngineSearch:
    """Bounded searches through the application's cached Stockfish adapter."""

    def __init__(self, engine, settings):
        self.engine = engine
        self.limits = SearchLimits(
            depth=settings.puzzle_generation_depth, time=settings.puzzle_generation_time
        )
        self.analysis_ids = []
        self.engine_version = ""

    def __call__(self, board, *, multipv=1):
        analysis = self.engine.analyze(board, multipv=multipv, limits=self.limits)
        self.analysis_ids.append(analysis.id)
        self.engine_version = analysis.engine_version
        return [
            Line(
                uci=candidate["uci"],
                score=_score(candidate["score"]),
                pv=tuple(candidate["pv"]),
                depth=candidate.get("depth", 0),
            )
            for candidate in analysis.candidates
        ]


def build_line(search, root: chess.Board, *, max_plies: int):
    """Extend unique solver moves and best defences until the line settles.

    Returns ``(Built, None)`` or ``(None, reason)``. The solver must have at least
    two decisions, each the engine's unique best move, and the final position
    must be mate or at least PAYOFF_CP ahead with the opponent to move.
    """
    solver = root.turn
    board = root.copy(stack=True)
    line, decisions, stop = [], [], "end"
    while not board.is_game_over():
        if board.turn == solver:
            if board.legal_moves.count() == 1:
                if len(decisions) >= 2:
                    stop = "forced"
                    break
                return None, "forced_move"
            lines = search(board, multipv=2)
            if not lines:
                return None, "no_engine_line"
            best, rival = lines[0], lines[1] if len(lines) > 1 else None
            if not decisions and not payoff_ok(best.score):
                return None, f"not_winning {describe(best.score)}"
            verdict = "unique" if rival is None else rival_verdict(best.score, rival.score)
            if verdict in {"equal_mate", "close"}:
                if len(decisions) >= 2:
                    stop = "ambiguous"
                    break
                return None, f"ambiguous {describe(best.score)} vs {describe(rival.score)}"
            move = legal_move(board, best.uci)
            decisions.append(
                {
                    "ply": len(line),
                    "san": board.san(move),
                    "score": describe(best.score),
                    "rival": describe(rival.score) if rival else None,
                    "depth": best.depth,
                }
            )
            board.push(move)
            line.append(move.uci())
            if board.is_checkmate():
                stop = "mate"
                break
            if len(line) >= max_plies:
                stop = "cap"
                break
        else:
            lines = search(board, multipv=1)
            if not lines:
                return None, "no_engine_line"
            move = legal_move(board, lines[0].uci)
            board.push(move)
            line.append(move.uci())
    if line and len(line) % 2 == 0:
        # The line ends on a solver move; a trailing defence is not part of it.
        board.pop()
        line.pop()
    if len(decisions) < 2:
        return None, f"too_short {len(decisions)}"
    if board.is_checkmate():
        payoff = MATE_SCORE
    elif board.is_game_over():
        return None, "payoff draw"
    else:
        lines = search(board, multipv=1)
        if not lines:
            return None, "no_engine_line"
        payoff = -lines[0].score  # The opponent is to move; flip to the solver.
        if not payoff_ok(payoff):
            return None, f"payoff {describe(payoff)}"
    return Built(tuple(line), decisions, payoff, stop), None


def replay(root: chess.Board, solution) -> list[chess.Board]:
    boards = [root.copy(stack=True)]
    for uci in solution:
        following = boards[-1].copy(stack=True)
        following.push(legal_move(following, uci))
        boards.append(following)
    return boards


def line_themes(boards, built: Built, label: str) -> tuple[str, ...]:
    """Lichess-style labels: tagger motifs, goal, mate distance, length and phase."""
    themes = set()
    try:
        themes.update(recognize(boards, 1, len(built.solution), label).themes)
    except ValueError:
        pass  # A line the tagger cannot frame still verified; labels are not a gate.
    decisions = len(built.decisions)
    if is_mate(built.payoff):
        themes.add("mate")
        if built.stop == "mate" and decisions <= 5:
            themes.add(f"mateIn{decisions}")
    else:
        themes.add("crushing" if built.payoff > 600 else "advantage")
    themes.add(LENGTH_THEMES.get(decisions, "veryLong"))
    root = boards[0]
    if material(root, True) + material(root, False) <= 26:
        themes.add("endgame")
    elif root.fullmove_number <= 10:
        themes.add("opening")
    else:
        themes.add("middlegame")
    return tuple(sorted(themes))


def definition_for(game, prospect: Prospect, root, built: Built, themes) -> PuzzleDefinition:
    you = "White" if game.learner_color else "Black"
    opponent = game.black if game.learner_color else game.white
    when = game.played_on or "date unknown"
    attribution = (
        f"Your game as {you} vs {opponent} · {when} · move {(prospect.ply + 1) // 2}. "
        f"You played {prospect.played_san}."
    )
    return PuzzleDefinition(
        key=f"{game.id}:{prospect.ply}",
        version=GENERATOR_VERSION,
        source="games",
        initial_fen=root.fen(),
        orientation="white" if root.turn else "black",
        solution=built.solution,
        themes=themes,
        rating=None,
        provenance=PuzzleProvenance(
            attribution=attribution, url=None, game_id=game.id, source_ply=prospect.ply
        ),
    )


def generate_for_game(db, search, settings, game, *, cancelled=lambda: False, write_lock=None):
    """Mine one game once per generator version.

    Returns the candidate and kept counts, or None when the game was already
    searched or the work was cancelled before the search record could be written
    (judged candidates are kept, so a later run resumes where this one stopped).
    """
    lock = nullcontext() if write_lock is None else write_lock
    searched = db.scalar(
        select(GamePuzzleSearch.id).where(
            GamePuzzleSearch.game_id == game.id,
            GamePuzzleSearch.generator_version == GENERATOR_VERSION,
        )
    )
    if searched is not None:
        return None
    found = prospects(db, game)
    judged = set(
        db.scalars(
            select(GamePuzzle.ply).where(
                GamePuzzle.game_id == game.id, GamePuzzle.generator_version == GENERATOR_VERSION
            )
        )
    )
    for prospect in found:
        if prospect.ply in judged:
            continue
        if cancelled():
            return None
        root = root_board(game, prospect.ply)
        key = position_key(root)
        first_search = len(search.analysis_ids)
        built, reason = build_line(search, root, max_plies=settings.puzzle_generation_max_plies)
        if built is not None:
            duplicate = db.scalar(
                select(GamePuzzle.id).where(
                    GamePuzzle.position_key == key,
                    GamePuzzle.status == "ready",
                    GamePuzzle.generator_version == GENERATOR_VERSION,
                )
            )
            if duplicate is not None:
                built, reason = None, "duplicate_position"
        definition = None
        if built is not None:
            boards = replay(root, built.solution)
            label = prospect.decision_id or f"{game.id}:{prospect.ply}"
            definition = definition_for(
                game, prospect, root, built, line_themes(boards, built, label)
            )
        row = GamePuzzle(
            game_id=game.id,
            ply=prospect.ply,
            decision_id=prospect.decision_id,
            generator_version=GENERATOR_VERSION,
            position_key=key,
            kind=prospect.kind,
            status="ready" if definition is not None else "abstained",
            reason=reason,
            definition=None if definition is None else definition.model_dump(mode="json"),
            evidence={
                "generator": GENERATOR_VERSION,
                "engine": search.engine_version,
                "depth": settings.puzzle_generation_depth,
                "time": settings.puzzle_generation_time,
                "thresholds": {"margin_cp": MARGIN_CP, "payoff_cp": PAYOFF_CP},
                "source": prospect.source,
                "saved_best": prospect.saved_best_san,
                "saved_unique_first": prospect.saved_unique,
                "analysis_ids": search.analysis_ids[first_search:],
                "decisions": built.decisions if built else [],
                "payoff": describe(built.payoff) if built else None,
                "stop": built.stop if built else None,
            },
        )
        with lock:
            db.add(row)
            db.commit()
    kept = db.scalar(
        select(func.count())
        .select_from(GamePuzzle)
        .where(
            GamePuzzle.game_id == game.id,
            GamePuzzle.generator_version == GENERATOR_VERSION,
            GamePuzzle.status == "ready",
        )
    )
    with lock:
        db.add(
            GamePuzzleSearch(
                game_id=game.id,
                generator_version=GENERATOR_VERSION,
                engine_version=search.engine_version,
                candidates=len(found),
                kept=kept,
            )
        )
        db.commit()
    return {"candidates": len(found), "kept": kept}


def _analyzed_games():
    return select(Decision.game_id).distinct()


def _searched_games():
    return select(GamePuzzleSearch.game_id).where(
        GamePuzzleSearch.generator_version == GENERATOR_VERSION
    )


def unsearched_games(db, limit: int) -> list[str]:
    """Analyzed games not yet mined under this generator version, newest first."""
    return db.scalars(
        select(Game.id)
        .where(Game.id.in_(_analyzed_games()), Game.id.not_in(_searched_games()))
        .order_by(Game.played_at.desc().nulls_last(), Game.created_at.desc(), Game.id)
        .limit(limit)
    ).all()


def generation_status(db, *, automatic: bool) -> dict:
    """Counts for the library; nothing here is a mastery or transfer claim."""
    analyzed = db.scalar(
        select(func.count()).select_from(Game).where(Game.id.in_(_analyzed_games()))
    )
    unsearched = db.scalar(
        select(func.count())
        .select_from(Game)
        .where(Game.id.in_(_analyzed_games()), Game.id.not_in(_searched_games()))
    )
    searched, candidates, kept, last = db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(GamePuzzleSearch.candidates), 0),
            func.coalesce(func.sum(GamePuzzleSearch.kept), 0),
            func.max(GamePuzzleSearch.searched_at),
        ).where(GamePuzzleSearch.generator_version == GENERATOR_VERSION)
    ).one()
    puzzles = db.scalar(
        select(func.count())
        .select_from(GamePuzzle)
        .where(GamePuzzle.status == "ready", GamePuzzle.generator_version == GENERATOR_VERSION)
    )
    job_status = db.scalar(
        select(AnalysisJob.status)
        .where(AnalysisJob.kind == JOB_KIND, AnalysisJob.status.in_(["queued", "running"]))
        .order_by(AnalysisJob.created_at.desc())
        .limit(1)
    )
    return {
        "automatic": automatic,
        "analyzed_games": analyzed,
        "searched_games": searched,
        "unsearched_games": unsearched,
        "puzzles": puzzles,
        "candidates": candidates,
        "kept": kept,
        "last_searched_at": None if last is None else str(last),
        "job_status": job_status,
    }
