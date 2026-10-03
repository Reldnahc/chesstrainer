"""Real subprocess transport with synthetic workers and opt-in native inference."""

import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import chess
import chess.pgn
import pytest
from trainer.human_models.context import request_for
from trainer.human_models.preset import provenance
from trainer.human_models.runtime import HumanCancelled, HumanUnavailable, MaiaProvider, Worker


def request():
    return request_for(chess.pgn.Game(), chess.Board(), 1200)


def provider(settings, tmp_path, source):
    settings.human_model_path = tmp_path / "fake.pt"
    settings.human_model_path.touch()
    identity = provenance(settings)
    identity.inference["torch"] = "fixture"
    code = tmp_path / "worker.py"
    code.write_text(source, encoding="utf-8")
    return MaiaProvider(settings, command=[sys.executable, str(code)], identity=identity)


def test_worker_deadline_includes_blocked_pipe_write_and_close_is_idempotent():
    worker = Worker([sys.executable, "-c", "import time;time.sleep(30)"])
    started = time.monotonic()
    try:
        with pytest.raises(HumanUnavailable, match="deadline"):
            worker.exchange({"large": "x" * 200000}, started + 0.15, lambda: False)
    finally:
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: worker.close(), range(2)))
    assert time.monotonic() - started < 3
    assert worker.process.poll() is not None
    assert not worker.reader.is_alive() and not worker.writer.is_alive()


def test_cancel_kills_worker_then_next_request_can_restart(settings, tmp_path):
    human = provider(
        settings,
        tmp_path,
        "import json,sys,time\njson.loads(input())\nprint('{\"ready\":true}',flush=True)\ninput()\ntime.sleep(30)\n",
    )
    stop = threading.Event()
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(human.predict, request(), stop.is_set)
        deadline = time.monotonic() + 3
        while not any(worker.initialized for worker in human._workers):
            assert time.monotonic() < deadline
            time.sleep(0.01)
        process = next(iter(human._workers)).process
        stop.set()
        with pytest.raises(HumanCancelled):
            pending.result(timeout=3)
    assert human.snapshot().status == "unchecked"
    assert not human._workers
    assert process.poll() is not None
    human.close()


def test_missing_runtime_does_not_start_a_native_child(settings, tmp_path, monkeypatch):
    settings.human_model_path = tmp_path / "present.pt"
    settings.human_model_path.touch()
    identity = provenance(settings)
    identity.inference["torch"] = "unavailable"
    human = MaiaProvider(settings, identity=identity)
    monkeypatch.setattr(
        "trainer.human_models.runtime.Worker", lambda *_: pytest.fail("Started without runtime")
    )
    try:
        assert human.snapshot().status == "unavailable"
        with pytest.raises(HumanUnavailable, match="runtime_unavailable"):
            human.predict(request())
    finally:
        human.close()


def test_crashed_worker_fails_closed_with_cooldown(settings, tmp_path):
    human = provider(settings, tmp_path, "raise SystemExit(1)")
    try:
        with pytest.raises(HumanUnavailable):
            human.predict(request())
        assert human.snapshot().status == "unavailable"
        with pytest.raises(HumanUnavailable, match="cooldown"):
            human.predict(request())
        assert not human._workers
    finally:
        human.close()


def test_one_host_slot_serializes_accounts_and_reuses_worker(settings, tmp_path):
    human = provider(
        settings,
        tmp_path,
        """import json,sys,time
config=json.loads(input())
print('{"ready":true}',flush=True)
for line in sys.stdin:
    json.loads(line)
    time.sleep(.03)
    print(json.dumps({"policy":{"provenance":config["provenance"],"complete":False,"moves":[{"uci":"e2e4","rank":1}]}}),flush=True)
""",
    )
    try:
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: human.predict(request()), range(12)))
        assert len(human._workers) == 1
        assert all(row.moves[0].probability is None for row in results)
        assert human.snapshot().status == "ready"
    finally:
        human.close()
    assert all(worker.process.poll() is not None for worker in human._workers)


@pytest.mark.maia
def test_native_policy_worker_offline_history_special_moves(settings, monkeypatch):
    torch_was_loaded = "torch" in sys.modules
    root = os.environ.get("MAIA_CHECKPOINT_DIR")
    if not root:
        pytest.skip("Set MAIA_CHECKPOINT_DIR with the pinned 79M checkpoint and Torch runtime")
    settings.human_model_path = Path(root) / "maia3-79m.pt"
    settings.human_model_device = os.environ.get("MAIA_TEST_DEVICE", "cpu")
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    human = MaiaProvider(settings)
    game = chess.pgn.Game()
    boards = [
        chess.Board(),
        chess.Board("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"),
        chess.Board("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"),
        chess.Board("4k3/8/8/8/8/8/p7/4K3 b - - 0 12"),
    ]
    repeated = chess.Board()
    for uci in ["g1f3", "g8f6", "f3g1", "f6g8"]:
        repeated.push_uci(uci)
    boards.append(repeated)
    try:
        policies = [human.predict(request_for(game, board, 1200)) for board in boards]
        for board, policy in zip(boards, policies):
            assert {m.uci for m in policy.moves} == {m.uci() for m in board.legal_moves}
            assert sum(m.probability for m in policy.moves) == pytest.approx(1)
        assert human.predict(request_for(game, boards[0], 1200)) == policies[0]
        # One batched forward pass gives the same policies as one position at a time.
        batched = human.predict_many([request_for(game, board, 1200) for board in boards])
        for one, many in zip(policies, batched, strict=True):
            assert [m.uci for m in many.moves] == [m.uci for m in one.moves]
            assert [m.probability for m in many.moves] == pytest.approx(
                [m.probability for m in one.moves], abs=1e-5
            )
        assert policies[0].moves != policies[-1].moves
        assert ("torch" in sys.modules) == torch_was_loaded  # Native memory stays in the child.
    finally:
        human.close()
