"""Upstream parity, legal adapters and concrete witnesses; no network or native engine."""

import ast
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import chess
import pytest
from trainer._vendor.lichess_puzzler import cook
from trainer.lichess_patterns import THEME_RULES, line_input, recognize
from trainer.lichess_witnesses import record

from scripts.lichess_benchmark.dataset import PuzzleRow
from scripts.lichess_benchmark.positions import reconstruct

VENDOR = Path(cook.__file__).parent


class RemoveObserver(ast.NodeTransformer):
    def visit_Return(self, node):
        if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name):
            if node.value.func.id == "_record":
                node.value = node.value.args[2]
        return self.generic_visit(node)


def upstream_namespace():
    tree = RemoveObserver().visit(ast.parse((VENDOR / "cook.py").read_text()))
    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    namespace = dict(vars(cook))
    exec(
        compile(ast.Module(body=functions, type_ignores=[]), "<unwrapped-upstream>", "exec"),
        namespace,
    )
    return namespace


def line(fen, moves, mirror=False):
    if mirror:
        fen = chess.Board(fen).mirror().fen()
        moves = " ".join(
            chess.Move(
                chess.square_mirror(m.from_square),
                chess.square_mirror(m.to_square),
                promotion=m.promotion,
            ).uci()
            for m in map(chess.Move.from_uci, moves.split())
        )
    return reconstruct(PuzzleRow(2, {"FEN": fen, "Moves": moves, "Themes": "fixture"}))


FIXTURES = [
    ("fork", "r7/3k4/8/1N6/8/8/8/6K1 b - - 0 1", "d7e8 b5c7 e8d7 c7a8"),
    ("skewer", "8/7q/5k2/1B6/8/8/8/6K1 b - - 0 1", "f6g6 b5d3 g6g5 d3h7"),
    ("promotion", "8/P3k3/8/8/8/8/8/4K3 b - - 0 1", "e7e8 a7a8n"),
    ("doubleCheck", "5k2/8/8/8/8/8/4B3/4R1K1 b - - 0 1", "f8e8 e2h5"),
    ("discoveredCheck", "5k2/8/8/8/8/8/4B3/4R1K1 b - - 0 1", "f8e8 e2f3"),
    ("hangingPiece", "5k2/8/8/8/8/8/q7/R5K1 b - - 0 1", "f8g8 a1a2"),
]


def test_all_original_function_conditions_survive_instrumentation():
    manifest = json.loads((VENDOR / "UPSTREAM.json").read_text())
    tree = RemoveObserver().visit(ast.parse((VENDOR / "cook.py").read_text()))
    observed = {
        fn.name: hashlib.sha256(ast.dump(fn, include_attributes=False).encode()).hexdigest()
        for fn in tree.body
        if isinstance(fn, ast.FunctionDef)
    }
    assert observed == manifest["function_ast_sha256"]
    for name in ("util.py", "model.py"):
        assert (
            hashlib.sha256((VENDOR / name).read_bytes()).hexdigest()
            == manifest["files"][f"tagger/{name}"]
        )
    assert (
        hashlib.sha256((VENDOR / "LICENSE").read_bytes()).hexdigest()
        == manifest["files"]["LICENSE"]
    )
    assert "GNU AFFERO GENERAL PUBLIC LICENSE" in (VENDOR / "LICENSE").read_text()


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize("theme,fen,moves", FIXTURES)
def test_predicate_parity_and_witness_coordinates(theme, fen, moves, black):
    puzzle_line = line(fen, moves, black)
    boards = puzzle_line.boards
    snapshots = [(b.fen(), list(b.move_stack)) for b in boards]
    puzzle, _, _ = line_input(boards, 1, len(boards) - 1, "fixture")
    assert not hasattr(puzzle, "cp")  # No fabricated score, even for the comparison.
    original = upstream_namespace()
    expected = {
        key
        for key, functions in THEME_RULES.items()
        if any(original[name](puzzle) for name in functions)
    }
    observed = recognize(boards, 1, len(boards) - 1, "fixture")
    assert set(observed.themes) == expected
    assert theme in observed.themes
    assert snapshots == [(b.fen(), list(b.move_stack)) for b in boards]
    assert not observed.skipped
    for finding in observed.witnesses:
        assert finding.plies and finding.roles
        assert 0 <= finding.frame_ply < len(boards)
        assert all(1 <= ply < len(boards) for ply in finding.plies)
        # The first witness action always belongs to the intended solver.
        assert boards[finding.plies[0] - 1].turn == puzzle.pov
        assert all(
            chess.parse_square(s) in chess.SQUARES for ss in finding.roles.values() for s in ss
        )


def test_motif_recognition_does_not_require_material_gain():
    _, fen, moves = FIXTURES[3]
    puzzle_line = line(fen, moves)
    result = recognize(puzzle_line.boards, 1, 1, "no-gain")
    assert "doubleCheck" in result.themes
    finding = next(w for w in result.witnesses if w.theme == "doubleCheck")
    assert finding.roles["attackers"] == ["e1", "h5"]


def test_position_root_without_setup_is_not_given_a_fake_move():
    _, fen, moves = FIXTURES[0]
    original = line(fen, moves)
    boards = [b.copy(stack=False) for b in original.boards]
    # Following boards retain their actual moves, as normal PV replay does.
    for i in range(1, len(boards)):
        boards[i] = boards[i - 1].copy(stack=True)
        boards[i].push(chess.Move.from_uci(original.solution_uci[i - 1]))
    puzzle, _, known = line_input(boards, 1, len(boards) - 1, "no-context")
    assert not known
    assert isinstance(puzzle.mainline[0], chess.pgn.Game)
    assert list(puzzle.game.mainline_moves()) == list(
        map(chess.Move.from_uci, original.solution_uci)
    )
    result = recognize(boards, 1, len(boards) - 1, "no-context")
    assert "fork" in result.themes
    assert result.skipped == ["hangingPiece:setup_context_unavailable"]


def test_explicit_previous_move_is_validated():
    _, fen, moves = FIXTURES[0]
    original = line(fen, moves)
    root = original.boards[0].copy(stack=False)
    boards = [root]
    for uci in original.solution_uci:
        board = boards[-1].copy(stack=True)
        board.push_uci(uci)
        boards.append(board)
    result = recognize(
        boards,
        1,
        len(boards) - 1,
        "context",
        previous_move={"fen": fen, "uci": moves.split()[0]},
    )
    assert "fork" in result.themes and not result.skipped
    with pytest.raises(ValueError, match="Previous move"):
        recognize(boards, 1, len(boards) - 1, "context", previous_move={"fen": fen, "uci": "d7c6"})


def test_bounds_and_inconsistent_board_states_are_rejected():
    _, fen, moves = FIXTURES[0]
    boards = line(fen, moves).boards
    with pytest.raises(ValueError, match="bounds"):
        recognize(boards, 0, 1, "bad")
    with pytest.raises(ValueError, match="Unknown"):
        recognize(boards, 1, len(boards) - 1, "bad", themes=["madeUp"])
    changed = [b.copy(stack=True) for b in boards]
    history = list(changed[1].move_stack)
    changed[1].remove_piece_at(chess.A8)
    with pytest.raises(ValueError, match="missing its move history"):
        recognize(changed, 1, len(boards) - 1, "bad")
    changed[1].move_stack = history
    with pytest.raises(ValueError, match="mismatched"):
        recognize(changed, 1, len(boards) - 1, "bad")


def test_observers_are_per_call_and_do_not_leak_across_workers():
    work = [FIXTURES[i % len(FIXTURES)] for i in range(48)]

    def detect(item):
        theme, fen, moves = item
        boards = line(fen, moves).boards
        result = recognize(boards, 1, len(boards) - 1, theme, themes=[theme])
        assert result.themes == [theme]
        assert all(w.theme == theme for w in result.witnesses)

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(detect, work))


def test_return_hook_preserves_false_values_and_no_observer_is_required():
    sentinel = object()
    assert record(sentinel, "test", False, {}) is False
    assert record(sentinel, "test", True, {}) is True
