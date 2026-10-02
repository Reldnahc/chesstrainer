"""Saved human-model failures are retried only by a runtime that can still succeed."""

import io

import chess.pgn
from human_fixtures import PolicyProvider
from trainer.human_models.runtime import HumanUnavailable
from trainer.human_models.service import HumanModels
from trainer.human_models.types import HumanReadiness


class FailingProvider(PolicyProvider):
    status = "unchecked"

    def snapshot(self):
        return HumanReadiness(status=self.status)

    def predict(self, request, cancelled=lambda: False):
        raise HumanUnavailable("prediction_unavailable")


def test_saved_failures_are_not_retried_by_a_runtime_that_keeps_failing(settings, sessions):
    provider = FailingProvider(settings)
    models = HumanModels(settings, provider)
    parsed = chess.pgn.read_game(io.StringIO("1. e4 e5 *"))
    board = parsed.board()
    unavailable = {"status": "unavailable", "configuration_key": models.configuration_key}
    # Untried in this process: a freshly installed checkpoint gets its chance.
    assert models.needs_refresh(unavailable, parsed, True, 1500)
    evidence = models.evidence(sessions, parsed, board, "e2e4", "e2e4", 1500)
    assert evidence["status"] == "unavailable"
    # It failed here, so opening a game must not requeue a pass that fails again.
    assert not models.needs_refresh(unavailable, parsed, True, 1500)
    assert models.needs_refresh({"status": "cancelled"}, parsed, True, 1500)
    provider.status = "ready"
    assert models.needs_refresh(unavailable, parsed, True, 1500)
