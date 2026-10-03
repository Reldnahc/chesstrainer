"""Library-wide patterns from saved PGNs and completed reviews; no engine work.

Everything here is a description of the learner's own saved games. Engine-based
sections use only completed original-game reviews and say how many games they
cover; PGN-only sections (results, dates, ratings, clocks, openings) use every
game in the selection. Nothing is stored: the summary is recomputed per request.
"""

import io
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import chess
import chess.pgn

from trainer._vendor.lichess_accuracy import move_accuracy, win_percent
from trainer.chess_core import Score, evaluation_loss
from trainer.game_accuracy import accuracy_cp
from trainer.game_library import pgn_rating
from trainer.game_review import blunder_kind
from trainer.opening_book import book_move
from trainer.review_intelligence.clocks import clock_facts, control

VERSION = "insights-1"
SPEEDS = ("bullet", "blitz", "rapid", "classical", "daily")
# Learner-relative thresholds. "Clearly" winning or lost is three pawns, the same
# size of swing that makes an ordinary move a Blunder for most ratings.
DECISIVE_CP = 300
LEAD_CP = 150
MISTAKE_CP = 100
SESSION_GAP = timedelta(minutes=90)
MOVE_BUCKETS = ((1, 5), (6, 10), (11, 15), (16, 20), (21, 30), (31, None))
SLIP_BUCKETS = ((1, 10), (11, 20), (21, 30), (31, 40), (41, None))
THINK_BUCKETS = ((1, 10), (11, 30), (31, None))
CLOCK_BUCKETS = (
    ("over_half", 0.5, None),
    ("quarter", 0.25, 0.5),
    ("tenth", 0.1, 0.25),
    ("under_tenth", None, 0.1),
)
DAY_PARTS = ("night", "morning", "afternoon", "evening")


@dataclass
class Ply:
    ply: int
    learner: bool
    fullmove: int
    phase: str
    learner_cp: int | None = None  # Learner-relative evaluation after this ply.
    loss_cp: int | None = None
    blunder: bool = False
    mistake: bool = False
    accuracy: float | None = None
    clock_before: float | None = None
    clock_after: float | None = None
    elapsed: float | None = None


@dataclass
class GameFacts:
    id: str
    opponent: str
    opponent_rating: int | None
    learner_rating: int | None
    learner_white: bool
    played_at: datetime | None
    played_on: str | None
    result: str | None  # win, draw, loss; None for unfinished games.
    speed: str
    site: str
    termination: str
    opening: str | None
    plies: list[Ply] = field(default_factory=list)
    reviewed: bool = False
    initial_seconds: float | None = None
    clocked: bool = False
    book_exit: int | None = None  # The learner's own move that left the opening book.
    endgame: str | None = None
    endgame_entry: int | None = None


def speed_of(time_control):
    if time_control and time_control.strip().startswith("1/"):
        return "daily"
    kind, initial, increment = control(time_control)
    if initial is None:
        return "unknown"
    # Lichess's published estimate: base time plus forty moves of increment.
    estimate = initial + 40 * (increment or 0)
    return (
        "bullet"
        if estimate < 180
        else "blitz"
        if estimate < 480
        else "rapid"
        if estimate < 1500
        else "classical"
    )


def site_of(headers):
    site = (headers.get("Site") or "").lower()
    link = (headers.get("Link") or "").lower()
    if "chess.com" in site or "chess.com" in link:
        return "Chess.com"
    if "lichess" in site:
        return "Lichess"
    return "PGN"


def learner_result(result, learner_white):
    if result == "1/2-1/2":
        return "draw"
    if result in {"1-0", "0-1"}:
        return "win" if (result == "1-0") == learner_white else "loss"
    return None


def termination_of(headers, board, result):
    """Chess.com writes a sentence; Lichess writes Normal/Time forfeit; mates are on the board."""
    if board.is_checkmate():
        return "checkmate"
    if board.is_stalemate():
        return "stalemate"
    if board.is_insufficient_material():
        return "insufficient_material"
    text = (headers.get("Termination") or "").lower()
    for needle, name in (
        ("abandon", "abandoned"),
        ("insufficient", "insufficient_material"),
        ("time", "time"),
        ("resign", "resignation"),
        ("agreement", "agreement"),
        ("repetition", "repetition"),
        ("50", "fifty_moves"),
        ("fifty", "fifty_moves"),
        ("stalemate", "stalemate"),
        ("checkmate", "checkmate"),
    ):
        if needle in text:
            return name
    if text == "normal" and result in {"1-0", "0-1"}:
        return "resignation"
    if text == "normal" and result == "1/2-1/2":
        return "agreement"
    return "other"


def pieces(board):
    return sum(
        len(board.pieces(kind, color))
        for kind in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
        for color in chess.COLORS
    )


def phase_of(board):
    """Simple, documented divider: six or fewer pieces is an endgame."""
    count = pieces(board)
    if count <= 6:
        return "endgame"
    return "opening" if board.fullmove_number <= 10 and count > 10 else "middlegame"


def endgame_class(board):
    queens = any(board.pieces(chess.QUEEN, color) for color in chess.COLORS)
    rooks = any(board.pieces(chess.ROOK, color) for color in chess.COLORS)
    minors = any(
        board.pieces(kind, color) for kind in (chess.KNIGHT, chess.BISHOP) for color in chess.COLORS
    )
    return "queen" if queens else "rook" if rooks else "minor" if minors else "pawn"


def opening_family(name):
    return name.split(":")[0].strip() if name else None


def game_facts(game, scores=None, rating=None):
    """Facts for one saved game. scores: {ply: {white_score, best: {score}}} when reviewed."""
    parsed = chess.pgn.read_game(io.StringIO(game.pgn))
    headers = parsed.headers
    learner_white = bool(game.learner_color)
    learner_rating = pgn_rating(headers, learner_white)
    opponent_rating = pgn_rating(headers, not learner_white)
    raw_result = headers.get("Result", "*")
    time_control = headers.get("TimeControl")
    _, initial, _ = control(time_control)
    clocks = clock_facts(parsed)
    board = parsed.board()
    total = sum(1 for _ in parsed.mainline_moves())
    reviewed = scores is not None and set(scores) == set(range(1, total + 1)) and total > 0
    review_rating = rating or learner_rating or 1000
    previous_white = 15 if board.fen() == chess.STARTING_FEN else None
    facts = GameFacts(
        id=game.id,
        opponent=game.black if learner_white else game.white,
        opponent_rating=opponent_rating,
        learner_rating=learner_rating,
        learner_white=learner_white,
        played_at=game.played_at.replace(tzinfo=timezone.utc) if game.played_at else None,
        played_on=game.played_on,
        result=learner_result(raw_result, learner_white),
        speed=speed_of(time_control),
        site=site_of(headers),
        termination="other",
        opening=None,
        reviewed=reviewed,
        initial_seconds=initial,
    )
    in_book = True
    for ply, move in enumerate(parsed.mainline_moves(), 1):
        mover_white = board.turn == chess.WHITE
        learner = mover_white == learner_white
        row = Ply(ply=ply, learner=learner, fullmove=board.fullmove_number, phase=phase_of(board))
        if row.phase == "endgame" and facts.endgame is None:
            facts.endgame, facts.endgame_entry = endgame_class(board), ply
        if in_book:
            opening = book_move(board.fen(), move.uci())
            if opening is None:
                in_book = False
                if learner and ply > 1:
                    facts.book_exit = ply
            elif opening["name"]:
                facts.opening = opening["name"]
        clock = clocks.get(ply)
        if clock and clock.status == "annotated":
            row.clock_before, row.clock_after = clock.before_seconds, clock.after_seconds
            row.elapsed = clock.elapsed_seconds
            facts.clocked = True
        if reviewed:
            try:
                white = Score.model_validate(scores[ply]["white_score"])
                best = Score.model_validate(scores[ply]["best"]["score"])
            except (KeyError, TypeError, ValueError):
                facts.reviewed, reviewed = False, False
            else:
                actual = white if mover_white else white.negate()
                white_cp = accuracy_cp(white)
                row.learner_cp = white_cp if learner_white else -white_cp
                loss = evaluation_loss(best, actual)
                row.loss_cp = (
                    loss.cp
                    if loss.cp is not None
                    else 1000
                    if loss.mate_lost or loss.allows_mate
                    else 0
                )
                row.blunder = blunder_kind(best, actual, review_rating) is not None
                row.mistake = row.blunder or (loss.cp or 0) >= MISTAKE_CP or loss.mate_lost
                if previous_white is not None:
                    before = win_percent(previous_white if mover_white else -previous_white)
                    after = win_percent(white_cp if mover_white else -white_cp)
                    row.accuracy = move_accuracy(before, after)
                previous_white = white_cp
        facts.plies.append(row)
        board.push(move)
    facts.termination = termination_of(headers, board, raw_result)
    if not facts.reviewed:
        for row in facts.plies:
            row.learner_cp = row.loss_cp = row.accuracy = None
            row.blunder = row.mistake = False
    return facts


# --- aggregation ---------------------------------------------------------------


def record(games):
    counts = Counter(game.result for game in games)
    return {"wins": counts["win"], "draws": counts["draw"], "losses": counts["loss"]}


def example(game, ply=None):
    return {
        "id": game.id,
        "opponent": game.opponent,
        "opponent_rating": game.opponent_rating,
        "result": game.result or "unfinished",
        "played_on": game.played_on,
        "ply": ply,
    }


def recent_examples(games, limit=4, ply_of=None):
    ordered = sorted(
        games,
        key=lambda game: game.played_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return [example(game, ply_of(game) if ply_of else None) for game in ordered[:limit]]


def bucket_label(low, high):
    return f"{low}+" if high is None else f"{low}–{high}"


def in_bucket(value, low, high):
    return (low is None or value >= low) and (high is None or value <= high)


def mean(values):
    values = list(values)
    return round(sum(values) / len(values), 1) if values else None


def per_hundred(count, moves):
    return round(100 * count / moves, 1) if moves else None


def rhythm(games, offset):
    cells = defaultdict(list)
    for game in games:
        if game.played_at is None or game.result is None:
            continue
        local = game.played_at + offset
        cells[(local.weekday(), local.hour // 6)].append(game)
    grid = [
        {"weekday": weekday, "part": DAY_PARTS[part], **record(items)}
        for (weekday, part), items in sorted(cells.items())
    ]
    return {"dated_games": sum(len(items) for items in cells.values()), "cells": grid}


def endings(games):
    output = {}
    for outcome in ("win", "draw", "loss"):
        counts = Counter(game.termination for game in games if game.result == outcome)
        output[outcome] = [
            {"termination": name, "games": count}
            for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        ]
    return output


def chronological(games):
    return sorted(
        (game for game in games if game.result is not None),
        key=lambda game: (game.played_at or datetime.min.replace(tzinfo=timezone.utc), game.id),
    )


def streaks(games):
    ordered = chronological(games)
    best = {"win": 0, "loss": 0}
    run, current = 0, None
    for game in ordered:
        run = run + 1 if game.result == current else 1
        current = game.result
        if current in best:
            best[current] = max(best[current], run)
    current_wins = 0
    for game in reversed(ordered):
        if game.result != "win":
            break
        current_wins += 1
    rated_wins = [game for game in ordered if game.result == "win" and game.opponent_rating]
    top = max(rated_wins, key=lambda game: game.opponent_rating, default=None)
    return {
        "longest_win_streak": best["win"],
        "longest_loss_streak": best["loss"],
        "current_win_streak": current_wins,
        "best_win": example(top) if top else None,
    }


def ratings(games):
    series = defaultdict(list)
    for game in chronological(games):
        if game.learner_rating and game.played_at:
            series[(game.site, game.speed)].append((game.played_at, game.learner_rating))
    output = []
    for (site, speed), points in sorted(series.items(), key=lambda item: -len(item[1])):
        step = max(1, len(points) // 60)
        sampled = points[::step]
        if sampled[-1] != points[-1]:
            sampled.append(points[-1])
        output.append(
            {
                "site": site,
                "speed": speed,
                "games": len(points),
                "first": points[0][1],
                "last": points[-1][1],
                "points": [
                    {"date": at.date().isoformat(), "rating": value} for at, value in sampled
                ],
            }
        )
    return output


def openings(games):
    groups = defaultdict(list)
    for game in games:
        groups[(opening_family(game.opening) or "Unrecognized", game.learner_white)].append(game)
    rows = []
    for (name, white), items in groups.items():
        accuracies = [
            row.accuracy
            for game in items
            if game.reviewed
            for row in game.plies
            if row.learner and row.accuracy is not None
        ]
        finished = [game for game in items if game.result]
        rows.append(
            {
                "name": name,
                "color": "white" if white else "black",
                "games": len(items),
                **record(items),
                "score": round(
                    100
                    * sum({"win": 1, "draw": 0.5}.get(g.result, 0) for g in finished)
                    / len(finished)
                )
                if finished
                else None,
                "accuracy": mean(accuracies),
                "reviewed_games": sum(1 for game in items if game.reviewed),
            }
        )
    rows.sort(key=lambda row: (-row["games"], row["name"], row["color"]))
    return rows


def theory(games):
    reviewed = [game for game in games if game.reviewed]
    exits = []
    for game in reviewed:
        if game.book_exit is None:
            continue
        row = game.plies[game.book_exit - 1]
        exits.append((game, row))
    costly = [(game, row) for game, row in exits if row.mistake]
    by_opening = defaultdict(lambda: {"cost_cp": 0, "games": 0})
    for game, row in costly:
        entry = by_opening[opening_family(game.opening) or "Unrecognized"]
        entry["cost_cp"] += min(row.loss_cp or 0, 1000)
        entry["games"] += 1
    return {
        "reviewed_games": len(reviewed),
        "exits": len(exits),
        "costly_exits": len(costly),
        "average_exit_move": mean(row.fullmove for _, row in costly),
        "average_cost_cp": mean(min(row.loss_cp or 0, 1000) for _, row in costly),
        "openings": [
            {"name": name, **values}
            for name, values in sorted(by_opening.items(), key=lambda item: -item[1]["cost_cp"])[:5]
        ],
    }


def learner_series(game):
    return [row for row in game.plies if row.learner_cp is not None]


def slip_ply(game):
    rows = learner_series(game)
    last = max(
        (index for index, row in enumerate(rows) if row.learner_cp >= DECISIVE_CP), default=None
    )
    if last is None or last + 1 >= len(rows):
        return None
    return rows[last + 1].ply


def fullmove_of(game, ply):
    return game.plies[ply - 1].fullmove if ply else None


def momentum(games):
    reviewed = [game for game in games if game.reviewed and game.result]
    winning = [
        game for game in reviewed if any(r.learner_cp >= DECISIVE_CP for r in learner_series(game))
    ]
    lost = [
        game for game in reviewed if any(r.learner_cp <= -DECISIVE_CP for r in learner_series(game))
    ]
    slipped = [game for game in winning if game.result != "win"]
    slip_moves = {game.id: fullmove_of(game, slip_ply(game)) for game in slipped}
    histogram = [
        {
            "label": bucket_label(low, high),
            "games": sum(1 for move in slip_moves.values() if move and in_bucket(move, low, high)),
        }
        for low, high in SLIP_BUCKETS
    ]
    saved = [game for game in lost if game.result != "loss"]
    return {
        "reviewed_games": len(reviewed),
        "conversion": {
            "winning_games": len(winning),
            "converted": sum(1 for game in winning if game.result == "win"),
            "drawn": sum(1 for game in winning if game.result == "draw"),
            "lost": sum(1 for game in winning if game.result == "loss"),
            "slips": recent_examples(slipped, ply_of=slip_ply),
        },
        "slip_moves": histogram,
        "escapes": {
            "lost_games": len(lost),
            "won": sum(1 for game in lost if game.result == "win"),
            "drawn": sum(1 for game in lost if game.result == "draw"),
            "still_lost": sum(1 for game in lost if game.result == "loss"),
            "saves": recent_examples(saved),
        },
    }


def lead_changes(game):
    side, changes = 0, 0
    for row in learner_series(game):
        now = 1 if row.learner_cp >= LEAD_CP else -1 if row.learner_cp <= -LEAD_CP else 0
        if now and side and now != side:
            changes += 1
        side = now or side
    return changes


def shape_of(game):
    values = [row.learner_cp for row in learner_series(game)]
    if not values:
        return None
    if max(values) >= DECISIVE_CP and game.result != "win":
        return "slipped"
    if min(values) <= -DECISIVE_CP and game.result != "loss":
        return "comeback"
    if game.result == "win" and max(values) >= LEAD_CP and min(values) > -MISTAKE_CP:
        return "wire_to_wire"
    if lead_changes(game) >= 2:
        return "back_and_forth"
    return "unsettled"


def shapes(games):
    groups = defaultdict(list)
    for game in games:
        if game.reviewed and game.result:
            shape = shape_of(game)
            if shape:
                groups[shape].append(game)
    order = ("wire_to_wire", "back_and_forth", "unsettled", "slipped", "comeback")
    return [
        {
            "shape": shape,
            "games": len(groups[shape]),
            **record(groups[shape]),
            "examples": recent_examples(groups[shape]),
        }
        for shape in order
    ]


def move_rates(games):
    reviewed = [game for game in games if game.reviewed]
    learner_rows = [
        row for game in reviewed for row in game.plies if row.learner and row.accuracy is not None
    ]
    by_move = [
        {
            "label": bucket_label(low, high),
            "moves": len(rows),
            "accuracy": mean(row.accuracy for row in rows),
        }
        for low, high in MOVE_BUCKETS
        for rows in [[row for row in learner_rows if in_bucket(row.fullmove, low, high)]]
    ]
    by_phase = []
    for phase in ("opening", "middlegame", "endgame"):
        rows = [
            row
            for game in reviewed
            for row in game.plies
            if row.learner and row.phase == phase and row.loss_cp is not None
        ]
        by_phase.append(
            {
                "phase": phase,
                "moves": len(rows),
                "accuracy": mean(row.accuracy for row in rows if row.accuracy is not None),
                "blunders_per_100": per_hundred(sum(row.blunder for row in rows), len(rows)),
            }
        )
    return {"reviewed_games": len(reviewed), "by_move": by_move, "by_phase": by_phase}


def tilt(games):
    ordered = chronological(games)
    after = {"loss": [0, 0, 0], "other": [0, 0, 0]}  # games, blunders, moves
    rematches = []
    for previous, game in zip(ordered, ordered[1:]):
        if (
            not (previous.played_at and game.played_at)
            or game.played_at - previous.played_at > SESSION_GAP
        ):
            continue
        key = "loss" if previous.result == "loss" else "other"
        if game.reviewed:
            moves = [row for row in game.plies if row.learner and row.loss_cp is not None]
            after[key][0] += 1
            after[key][1] += sum(row.blunder for row in moves)
            after[key][2] += len(moves)
        if previous.result == "loss" and previous.opponent.lower() == game.opponent.lower():
            rematches.append(game)
    return {
        "after_loss": {
            "games": after["loss"][0],
            "blunders_per_100": per_hundred(after["loss"][1], after["loss"][2]),
        },
        "after_other": {
            "games": after["other"][0],
            "blunders_per_100": per_hundred(after["other"][1], after["other"][2]),
        },
        "rematches_after_loss": {"games": len(rematches), **record(rematches)},
    }


def clock_story(games):
    clocked = [game for game in games if game.clocked]
    trouble = 0
    think = {label: [] for label in (bucket_label(low, high) for low, high in THINK_BUCKETS)}
    by_fraction = {name: [0, 0] for name, _, _ in CLOCK_BUCKETS}
    for game in clocked:
        initial = game.initial_seconds
        rows = [row for row in game.plies if row.learner]
        if any(
            row.clock_after is not None
            and (row.clock_after <= 30 or (initial and row.clock_after <= initial / 10))
            for row in rows
        ):
            trouble += 1
        for row in rows:
            if row.elapsed is not None:
                for low, high in THINK_BUCKETS:
                    if in_bucket(row.fullmove, low, high):
                        think[bucket_label(low, high)].append(row.elapsed)
            if (
                game.reviewed
                and initial
                and row.clock_before is not None
                and row.loss_cp is not None
            ):
                fraction = row.clock_before / initial
                for name, low, high in CLOCK_BUCKETS:
                    if (low is None or fraction > low) and (high is None or fraction <= high):
                        by_fraction[name][0] += row.blunder
                        by_fraction[name][1] += 1
                        break
    return {
        "clocked_games": len(clocked),
        "time_trouble_games": trouble,
        "think_seconds": [
            {"label": label, "seconds": mean(values)} for label, values in think.items()
        ],
        "blunders_by_clock": [
            {
                "band": name,
                "moves": moves,
                "blunder_rate": round(100 * count / moves, 1) if moves else None,
            }
            for name, (count, moves) in by_fraction.items()
        ],
    }


def punishment(games):
    """Did the next move keep at least half of the swing an error handed over?"""
    counts = {"opponent_errors": 0, "punished": 0, "own_errors": 0, "unpunished": 0}
    for game in games:
        if not game.reviewed:
            continue
        rows = game.plies
        for index, row in enumerate(rows[:-1]):
            if not row.mistake:
                continue
            before = rows[index - 1].learner_cp if index else 15 if game.learner_white else -15
            swing = abs(row.learner_cp - before)
            reply = rows[index + 1].learner_cp
            if swing == 0:
                continue
            if row.learner:
                counts["own_errors"] += 1
                counts["unpunished"] += (before - reply) < swing / 2
            else:
                counts["opponent_errors"] += 1
                counts["punished"] += (reply - before) >= swing / 2
    return counts


def endgames(games):
    output = []
    for kind in ("rook", "queen", "minor", "pawn"):
        reached = [game for game in games if game.reviewed and game.result and game.endgame == kind]
        held = 0
        for game in reached:
            entry = game.plies[game.endgame_entry - 1]
            verdict = entry.learner_cp if entry.learner_cp is not None else 0
            expected = (
                "win" if verdict >= DECISIVE_CP else "loss" if verdict <= -DECISIVE_CP else "draw"
            )
            rank = {"loss": 0, "draw": 1, "win": 2}
            held += rank[game.result] >= rank[expected]
        output.append({"kind": kind, "games": len(reached), "held": held})
    return output


def summarize(facts, *, speed="all", days=None, now=None, offset_minutes=0):
    now = now or datetime.now(timezone.utc)
    selected = [
        game
        for game in facts
        if (speed == "all" or game.speed == speed)
        and (
            days is None
            or (game.played_at is not None and game.played_at >= now - timedelta(days=days))
        )
    ]
    available = sorted({game.speed for game in facts if game.speed in SPEEDS}, key=SPEEDS.index)
    offset = timedelta(minutes=offset_minutes)
    return {
        "version": VERSION,
        "speed": speed,
        "days": days,
        "speeds": available,
        "games": len(selected),
        "reviewed_games": sum(1 for game in selected if game.reviewed),
        **record(selected),
        "rhythm": rhythm(selected, offset),
        "endings": endings(selected),
        "records": streaks(selected),
        "ratings": ratings(selected),
        "openings": openings(selected),
        "theory": theory(selected),
        "momentum": momentum(selected),
        "shapes": shapes(selected),
        "moves": move_rates(selected),
        "tilt": tilt(selected),
        "clock": clock_story(selected),
        "punishment": punishment(selected),
        "endgames": endgames(selected),
    }
