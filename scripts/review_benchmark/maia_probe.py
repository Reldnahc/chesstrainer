"""Feasibility-only policy adapter against the pinned upstream source.

No imports or model acquisition occur on Fieldwork's serving path. This probe
compares the exact legal policy to the upstream Python and standard UCI surfaces.
"""

import hashlib
import json
import math
from pathlib import Path
from time import perf_counter

from trainer.human_models.preset import MANIFEST as PINS


def validate_source():
    import maia3

    folder = Path(maia3.__file__).parent
    pins = json.loads(PINS.read_text(encoding="utf-8"))
    for name, expected in pins["source_files"].items():
        if (
            hashlib.sha256((folder / name).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
            != expected
        ):
            raise ValueError("Installed Maia source does not match the pinned feasibility revision")


def checkpoint(folder, size):
    pin = json.loads(PINS.read_text(encoding="utf-8"))["models"][size]
    path = Path(folder) / pin["filename"]
    if not path.is_file():
        raise FileNotFoundError("Checkpoint absent: acquire it explicitly before benchmarking")
    with path.open("rb") as source:
        checksum = hashlib.file_digest(source, "sha256").hexdigest()
    if path.stat().st_size != pin["bytes"] or checksum != pin["sha256"]:
        raise ValueError("Checkpoint integrity check failed")
    return path


def position_command(board):
    return (
        "position fen "
        + board.root().fen()
        + " moves "
        + " ".join(move.uci() for move in board.move_stack)
    )


class Probe:
    def __init__(self, folder, size, threads=2, device="cpu"):
        start = perf_counter()
        path = checkpoint(folder, size)
        validate_source()
        import torch
        from maia3.models import MAIA3Model
        from maia3.uci import Maia3UCIEngine, parse_args

        torch.set_num_threads(threads)
        if torch.get_num_interop_threads() != 1:
            torch.set_num_interop_threads(1)
        torch.manual_seed(42)
        torch.use_deterministic_algorithms(True)
        cfg = parse_args(
            [
                "--model",
                size,
                "--checkpoint-path",
                str(path),
                "--device",
                device,
                "--no-use-amp",
                "--temperature",
                "0",
                "--use-uci-history",
                "--local-files-only",
            ]
        )
        self.engine = Maia3UCIEngine(cfg)
        self.engine.model = MAIA3Model(cfg).to(device)
        raw = torch.load(path, map_location=device, weights_only=True)
        state = raw.get("model_state_dict", raw)
        self.engine.model.load_state_dict(
            {k.replace("smolgen", "gab"): v for k, v in state.items()}, strict=True
        )
        self.engine.model.eval()
        self.loaded_seconds = perf_counter() - start

    def prepare(self, board, self_elo, opponent_elo):
        self.engine.cmd_position(position_command(board))
        self.engine.self_elo, self.engine.oppo_elo = self_elo, opponent_elo

    def direct(self, board, self_elo, opponent_elo):
        self.prepare(board, self_elo, opponent_elo)
        self.engine.multipv = 20
        _, candidates = self.engine.score_moves()
        # These are actual policy probabilities; WDL and compatibility cp are discarded.
        return [{"uci": item["move"].uci(), "probability": item["policy"]} for item in candidates]

    def policy(self, board, self_elo, opponent_elo):
        import torch
        from maia3.dataset import get_historical_tokens, get_legal_moves_mask

        self.prepare(board, self_elo, opponent_elo)
        engine, cfg = self.engine, self.engine.cfg
        tokens = get_historical_tokens(engine.history, cfg, 0.0, 0.0, 0.0, 0.0)
        mask = get_legal_moves_mask(board, engine.all_moves_dict).to(cfg.device)
        with torch.inference_mode():
            logits, _, _ = engine.model(
                tokens.unsqueeze(0).to(cfg.device),
                torch.tensor([self_elo], dtype=torch.long, device=cfg.device),
                torch.tensor([opponent_elo], dtype=torch.long, device=cfg.device),
            )
            probabilities = torch.softmax(logits[0].float().masked_fill(~mask, float("-inf")), -1)
            legal_indices = torch.nonzero(mask, as_tuple=False).flatten()
            order = torch.argsort(probabilities[legal_indices], descending=True)
            indices = legal_indices[order]
            values = probabilities[indices]
        rows = []
        for probability, index in zip(values.tolist(), indices.tolist()):
            move = engine._move_from_index(index)
            if move is not None:
                rows.append({"uci": move.uci(), "probability": probability})
        if len(rows) != board.legal_moves.count() or not math.isclose(
            sum(row["probability"] for row in rows), 1.0, abs_tol=1e-5
        ):
            raise ValueError("Incomplete or invalid legal move distribution")
        return rows
