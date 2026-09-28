"""Normal contracts need no Torch; opt-in native parity uses the pinned checkpoints."""

import io
import json
import os
import sys
from pathlib import Path
from queue import Empty
from types import SimpleNamespace
from unittest.mock import Mock

import chess
import pytest

from scripts.review_benchmark.corpus import board_for, load_corpus
from scripts.review_benchmark.maia_probe import (
    PINS,
    Probe,
    checkpoint,
    position_command,
    validate_source,
)


def test_maia_manifest_is_pinned_and_missing_corrupt_files_never_trigger_download(tmp_path):
    pins = json.loads(PINS.read_text())
    assert len(pins["source_revision"]) == 40
    for name, model in pins["models"].items():
        assert len(model["revision"]) == 40 and len(model["sha256"]) == 64
        with pytest.raises(FileNotFoundError, match="explicitly"):
            checkpoint(tmp_path, name)
        (tmp_path / model["filename"]).write_bytes(b"not a checkpoint")
        with pytest.raises(ValueError, match="integrity"):
            checkpoint(tmp_path, name)


def test_uci_input_contains_root_and_complete_history():
    board = chess.Board()
    for uci in ["g1f3", "g8f6", "f3g1", "f6g8"]:
        board.push_uci(uci)
    assert (
        position_command(board)
        == "position fen " + chess.STARTING_FEN + " moves g1f3 g8f6 f3g1 f6g8"
    )


def test_unpinned_upstream_code_is_rejected_without_loading_torch(tmp_path, monkeypatch):
    for name in json.loads(PINS.read_text())["source_files"]:
        (tmp_path / name).write_text("changed source")
    monkeypatch.setitem(
        sys.modules, "maia3", SimpleNamespace(__file__=str(tmp_path / "__init__.py"))
    )
    with pytest.raises(ValueError, match="pinned"):
        validate_source()


def test_benchmark_worker_exit_and_deadline_do_not_wait_forever(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2] / "scripts"))
    from scripts.benchmark_maia import Replies

    exited = Mock(stdout=io.StringIO(""))
    replies = Replies(exited)
    with pytest.raises(RuntimeError, match="exited"):
        replies.next()
    replies.reader.join(timeout=1)
    assert not replies.reader.is_alive()
    # Inject a queue deadline without spending a minute on a deliberately hung process.
    replies.lines = Mock()
    replies.lines.get.side_effect = Empty
    with pytest.raises(TimeoutError, match="deadline"):
        replies.next()
    exited.kill.assert_called_once()
    exited.wait.assert_called_once_with(timeout=5)


@pytest.fixture(scope="module")
def native_probe():
    directory = os.environ.get("MAIA_CHECKPOINT_DIR")
    if not directory:
        pytest.skip("Set MAIA_CHECKPOINT_DIR for opt-in pinned native Maia coverage")
    pytest.importorskip("torch")
    pytest.importorskip("maia3")
    return Probe(
        Path(directory),
        os.environ.get("MAIA_TEST_MODEL", "5m"),
        device=os.environ.get("MAIA_TEST_DEVICE", "cpu"),
    )


@pytest.mark.maia
def test_native_exact_policy_matches_upstream_top20_and_handles_both_colors(native_probe):
    for item in load_corpus()["positions"]:
        board = board_for(item)
        for self_elo, opponent in [(600, 1800), (1800, 600)]:
            actual = native_probe.policy(board, self_elo, opponent)
            upstream = native_probe.direct(board, self_elo, opponent)
            assert [row["uci"] for row in actual[:20]] == [row["uci"] for row in upstream]
            assert [row["probability"] for row in actual[:20]] == pytest.approx(
                [row["probability"] for row in upstream], abs=1e-7
            )
            assert {row["uci"] for row in actual} == {move.uci() for move in board.legal_moves}
            assert sum(row["probability"] for row in actual) == pytest.approx(1, abs=1e-6)


@pytest.mark.maia
def test_native_history_ratings_and_special_move_policy(native_probe):
    original = chess.Board()
    repeated = chess.Board()
    for uci in ["g1f3", "g8f6", "f3g1", "f6g8"]:
        repeated.push_uci(uci)
    baseline = native_probe.policy(original, 1200, 1400)
    assert baseline == native_probe.policy(original, 1200, 1400)
    assert baseline != native_probe.policy(original, 2400, 1400)
    assert baseline != native_probe.policy(original, 1200, 2400)
    assert baseline != native_probe.policy(repeated, 1200, 1400)
    for fen in [
        "7k/P7/8/8/8/8/8/7K w - - 0 1",
        "7k/8/8/8/8/8/p7/7K b - - 0 1",
        "7k/8/8/3pP3/8/8/8/7K w - d6 0 1",
    ]:
        board = chess.Board(fen)
        assert board.is_valid()
        assert {row["uci"] for row in native_probe.policy(board, 1200, 1400)} == {
            move.uci() for move in board.legal_moves
        }
