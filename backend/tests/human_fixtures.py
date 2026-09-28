"""Deterministic legal policies for integration tests, never production inference."""

import chess
from trainer.human_models.preset import provenance
from trainer.human_models.types import HumanMove, HumanPolicy, HumanReadiness


class PolicyProvider:
    def __init__(self, settings, *, ranked=False):
        self.provenance = provenance(settings)
        self.calls = []
        self.ranked = ranked
        self.closed = False

    def snapshot(self):
        return HumanReadiness(status="ready")

    def predict(self, request, cancelled=lambda: False):
        self.calls.append(request)
        legal = sorted(m.uci() for m in chess.Board(request.history.fen).legal_moves)
        selected = legal[:3] if self.ranked else legal
        return HumanPolicy(
            provenance=self.provenance,
            complete=not self.ranked,
            moves=[
                HumanMove(uci=m, rank=i + 1, probability=None if self.ranked else 1 / len(legal))
                for i, m in enumerate(selected)
            ],
        )

    def close(self):
        self.closed = True
