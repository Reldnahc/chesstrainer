"""Pinned Lichess motif recognition on legal lines, separate from mistake attribution."""

from dataclasses import dataclass, field
from typing import Callable

import chess
import chess.pgn

from trainer._vendor.lichess_puzzler import cook
from trainer.chess_core import legal_move, position_key, valid_board
from trainer.lichess_witnesses import MotifWitness, witness

THEME_RULES = {
    "fork": ("fork",),
    "pin": ("pin_prevents_attack", "pin_prevents_escape"),
    "skewer": ("skewer",),
    "capturingDefender": ("capturing_defender",),
    "backRankMate": ("back_rank_mate",),
    "promotion": ("promotion",),
    "underPromotion": ("under_promotion",),
    "discoveredAttack": ("discovered_attack",),
    "discoveredCheck": ("discovered_check",),
    "doubleCheck": ("double_check",),
    "hangingPiece": ("hanging_piece",),
    "deflection": ("deflection",),
}
THEME_SKILLS = {
    "fork": "fork",
    "pin": "pin",
    "skewer": "skewer",
    "capturingDefender": "removing_defender",
    "backRankMate": "back_rank",
    "promotion": "promotion_awareness",
    "underPromotion": "promotion_awareness",
    "discoveredAttack": "discovered_attack",
    "discoveredCheck": "discovered_attack",
    "doubleCheck": "double_attack",
    "hangingPiece": "missed_tactical_capture",
    "deflection": "deflection",
}


@dataclass
class LineInput:
    # Structural input for the selected upstream motif predicates. Deliberately
    # no cp attribute: the upstream overall cook()/evaluation tags are not called.
    id: str
    game: chess.pgn.Game
    pov: chess.Color
    mainline: list
    record_hit: Callable | None = None


@dataclass
class Recognition:
    themes: list[str] = field(default_factory=list)
    witnesses: list[MotifWitness] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def line_input(boards, first, end, analysis_id, previous_move=None):
    if first < 1 or end >= len(boards) or end < first:
        raise ValueError("Invalid upstream line bounds")
    root = boards[first - 1].copy(stack=True)
    if not root.is_valid():
        raise ValueError("Invalid solver position")
    setup = None
    initial = root
    if root.move_stack:
        initial = root.copy(stack=True)
        setup = initial.pop()
    elif first > 1:
        if not boards[first - 1].move_stack:
            raise ValueError("Setup position is missing its move history")
        initial = boards[first - 2]
        setup = boards[first - 1].peek()
    elif previous_move:
        initial = valid_board(previous_move["fen"])
        setup = legal_move(initial, previous_move["uci"])
    if setup is not None:
        check = initial.copy(stack=True)
        check.push(legal_move(check, setup.uci()))
        if position_key(check) != position_key(root):
            raise ValueError("Previous move does not reach the supplied solver position")
    game = chess.pgn.Game()
    game.setup(initial)
    node = game
    positions = {}
    if setup is not None:
        node = node.add_main_variation(setup)
        positions[id(node)] = first - 1
        mainline = [node]
    else:
        # Real FEN root, not a fabricated null move. Only hanging_piece requires
        # the missing setup capture context; other selected predicates can use it.
        positions[id(node)] = first - 1
        mainline = [game]
    current = root.copy(stack=True)
    for ply in range(first, end + 1):
        if not boards[ply].move_stack:
            raise ValueError("Saved continuation is missing its move history")
        move = legal_move(current, boards[ply].peek().uci())
        current.push(move)
        if position_key(current) != position_key(boards[ply]):
            raise ValueError("Upstream line contains mismatched board state")
        node = node.add_main_variation(move)
        positions[id(node)] = ply
        mainline.append(node)
    return LineInput(analysis_id, game, root.turn, mainline), positions, setup is not None


def recognize(boards, first, end, analysis_id, *, previous_move=None, themes=None) -> Recognition:
    """Run original predicates; supplied material gain is not needed to see a motif."""
    selected = tuple(THEME_RULES if themes is None else themes)
    if any(theme not in THEME_RULES for theme in selected):
        raise ValueError("Unknown upstream theme")
    puzzle, positions, setup_known = line_input(boards, first, end, analysis_id, previous_move)
    result = Recognition()
    for theme in selected:
        if theme == "hangingPiece" and not setup_known:
            result.skipped.append("hangingPiece:setup_context_unavailable")
            continue
        hits = []

        def observe(rule, context):
            item = witness(theme, rule, context, puzzle, positions)
            if item is not None:
                hits.append(item)

        puzzle.record_hit = observe
        if any(getattr(cook, name)(puzzle) for name in THEME_RULES[theme]):
            if not hits:
                raise ValueError(f"Upstream {theme} returned True without a concrete witness")
            result.themes.append(theme)
            result.witnesses.extend(hits)
    return result
