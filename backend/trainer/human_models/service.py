"""Account-scoped evidence and durable cache around a host-shared human provider."""

import math
import threading
from time import monotonic

from sqlalchemy import select

from trainer.chess_core import digest
from trainer.human_models.context import request_for
from trainer.human_models.runtime import HumanCancelled, HumanUnavailable, MaiaProvider
from trainer.human_models.types import HumanEvidence, HumanPolicy
from trainer.models import HumanAnalysis


class HumanModels:
    def __init__(self, settings, provider=None):
        self.settings = settings
        self.provider = provider or MaiaProvider(settings)
        self.configuration_key = digest(self.provider.provenance.model_dump(mode="json"))
        self._locks = tuple(threading.Lock() for _ in range(128))

    def snapshot(self):
        return self.provider.snapshot()

    def can_attempt(self):
        return self.snapshot().status in {"ready", "unchecked"}

    def needs_refresh(self, evidence, parsed, actor, fallback):
        if not self.can_attempt():
            return False
        from trainer.game_library import pgn_rating

        return (
            not evidence
            or evidence.get("status") != "available"
            or evidence.get("configuration_key") != self.configuration_key
            or evidence.get("conditioning", {}).get("self_rating")
            != (pgn_rating(parsed, actor) or fallback)
            or evidence.get("conditioning", {}).get("opponent_rating")
            != (pgn_rating(parsed, not actor) or fallback)
        )

    def evidence(self, sessions, parsed, board, played, best, fallback, cancelled=lambda: False):
        request = request_for(parsed, board, fallback)
        base = dict(
            configuration_key=self.configuration_key,
            history_key=digest(request.history.model_dump()),
            mover=request.mover,
            conditioning=request.conditioning,
            domain=request.domain,
            legal_count=board.legal_moves.count(),
        )
        if board.is_game_over() or board.uci_variant != "chess":
            return HumanEvidence(status="not_applicable", **base).model_dump(mode="json")
        if not self.settings.human_model_enabled:
            return HumanEvidence(status="disabled", **base).model_dump(mode="json")
        key = digest(
            {"request": request.model_dump(mode="json"), "configuration": self.configuration_key}
        )
        owner = sessions.kw["info"]["user_id"]
        lock = self._locks[int(digest([owner, key])[:4], 16) % len(self._locks)]
        deadline = monotonic() + self.settings.human_model_timeout
        try:
            while not lock.acquire(timeout=0.05):
                if cancelled():
                    raise HumanCancelled("cancelled")
                if monotonic() >= deadline:
                    raise HumanUnavailable("cache_busy")
            try:
                if cancelled():
                    raise HumanCancelled("cancelled")
                with sessions() as db:
                    saved = db.scalar(select(HumanAnalysis).where(HumanAnalysis.cache_key == key))
                    if saved:
                        policy = HumanPolicy.model_validate(saved.policy)
                        evidence_id = saved.id
                # Never hold a database transaction across native inference.
                if not saved:
                    policy = self.provider.predict(request, cancelled)
                legal = {move.uci() for move in board.legal_moves}
                predicted = {row.uci for row in policy.moves}
                if not predicted <= legal or policy.complete and predicted != legal:
                    raise HumanUnavailable("invalid_policy")
                if policy.provenance != self.provider.provenance:
                    raise HumanUnavailable("provenance_mismatch")
                if cancelled():
                    raise HumanCancelled("cancelled")
                if not saved:
                    with sessions() as db:
                        saved = HumanAnalysis(
                            cache_key=key,
                            request=request.model_dump(mode="json"),
                            policy=policy.model_dump(mode="json"),
                        )
                        db.add(saved)
                        db.commit()
                        evidence_id = saved.id
            finally:
                lock.release()
            probabilities = [row.probability for row in policy.moves]
            exact = policy.complete and all(p is not None for p in probabilities)
            entropy = (
                -sum(p * math.log(p) for p in probabilities if p) / math.log(len(probabilities))
                if exact and len(probabilities) > 1
                else 0.0
                if exact
                else None
            )
            lookup = {row.uci: row for row in policy.moves}
            return HumanEvidence(
                status="available",
                evidence_id=evidence_id,
                provenance=policy.provenance,
                played=lookup.get(played),
                engine_best=lookup.get(best),
                top_moves=policy.moves[:5],
                normalized_entropy=entropy,
                top_three_mass=sum(probabilities[:3]) if exact else None,
                **base,
            ).model_dump(mode="json")
        except HumanCancelled:
            return HumanEvidence(status="cancelled", **base).model_dump(mode="json")
        except (HumanUnavailable, ValueError, OSError):
            return HumanEvidence(
                status="unavailable", unavailable_reason="human_model_unavailable", **base
            ).model_dump(mode="json")

    def close(self):
        self.provider.close()
