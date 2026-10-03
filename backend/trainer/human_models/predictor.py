"""The only production module importing Torch. Used only in the isolated worker."""

from collections import deque
from types import SimpleNamespace

import torch

from trainer._vendor.maia3.dataset import (
    get_historical_tokens,
    get_legal_moves_mask,
    tokenize_board,
)
from trainer._vendor.maia3.models import MAIA3Model
from trainer._vendor.maia3.utils import get_all_possible_moves, mirror_move
from trainer.chess_core import legal_move, valid_board
from trainer.human_models.preset import verify_checkpoint, verify_source
from trainer.human_models.types import HumanMove, HumanPolicy

ARCHITECTURE = dict(
    history=8,
    include_time_info=False,
    dim_emb=128,
    dim_vit=1024,
    head_hid_dim=1024,
    num_heads=32,
    num_blocks=8,
    mlp_ratio=2.0,
    dropout=0.0,
    use_gab=True,
    use_relative_bias=False,
    use_absolute_pe=False,
    use_rms_norm=True,
    omit_qkv_biases=True,
    activation="gelu",
    gab_gen_size=128,
    gab_per_square_dim=32,
    gab_intermediate_dim=128,
)


class MaiaPredictor:
    def __init__(self, checkpoint, provenance):
        verify_source()
        verify_checkpoint(checkpoint)
        if torch.__version__.split("+")[0] != "2.8.0":
            raise ValueError("runtime_version")
        self.provenance = provenance
        self.device = provenance.inference["device"]
        if self.device == "cuda" and not torch.cuda.is_available():
            raise ValueError("device_unavailable")
        torch.set_num_threads(provenance.inference["threads"])
        torch.set_num_interop_threads(1)
        torch.manual_seed(42)
        torch.use_deterministic_algorithms(True)
        self.cfg = SimpleNamespace(**ARCHITECTURE)
        self.model = MAIA3Model(self.cfg).to(self.device)
        raw = torch.load(checkpoint, map_location=self.device, weights_only=True)
        state = raw.get("model_state_dict", raw)
        self.model.load_state_dict(
            {key.replace("smolgen", "gab"): value for key, value in state.items()}, strict=True
        )
        self.model.eval()
        self.moves = get_all_possible_moves()
        self.indices = {move: index for index, move in enumerate(self.moves)}

    def predict(self, request):
        return self.predict_many([request])[0]

    def predict_many(self, requests):
        """Score several positions in one forward pass; same policies as one at a time."""
        prepared = [self._prepare(request) for request in requests]
        tokens = torch.stack([tokens for _, tokens, _ in prepared]).to(self.device)
        ratings = [
            torch.tensor([getattr(r.conditioning, side) for r in requests], device=self.device)
            for side in ("self_rating", "opponent_rating")
        ]
        with torch.inference_mode():
            logits, _, _ = self.model(tokens, *(rating.long() for rating in ratings))
            return [
                self._policy(board, row, mask)
                for (board, _, mask), row in zip(prepared, logits, strict=True)
            ]

    def _prepare(self, request):
        board = valid_board(request.history.root)
        history = deque([tokenize_board(board)], maxlen=self.cfg.history)
        for uci in request.history.moves:
            board.push(legal_move(board, uci))
            history.append(tokenize_board(board))
        if (
            board.fen() != request.history.fen
            or ("white" if board.turn else "black") != request.mover
        ):
            raise ValueError("history_mismatch")
        mask = get_legal_moves_mask(board, self.indices).to(self.device)
        if not mask.any():
            raise ValueError("terminal_position")
        return board, get_historical_tokens(history, self.cfg, 0, 0, 0, 0), mask

    def _policy(self, board, logits, mask):
        probabilities = torch.softmax(logits.float().masked_fill(~mask, float("-inf")), -1)
        legal_indices = torch.nonzero(mask, as_tuple=False).flatten()
        values = probabilities[legal_indices].tolist()
        indices = legal_indices.tolist()
        moves = [
            (self.moves[index] if board.turn else mirror_move(self.moves[index]), probability)
            for index, probability in zip(indices, values)
        ]
        moves.sort(key=lambda row: (-row[1], row[0]))
        if {uci for uci, _ in moves} != {move.uci() for move in board.legal_moves}:
            raise ValueError("illegal_policy")
        return HumanPolicy(
            provenance=self.provenance,
            complete=True,
            moves=[
                HumanMove(uci=uci, probability=p, rank=i) for i, (uci, p) in enumerate(moves, 1)
            ],
        )
