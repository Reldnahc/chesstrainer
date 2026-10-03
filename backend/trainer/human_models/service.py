"""Account-scoped evidence and durable cache around a host-shared human provider."""

import threading
from time import monotonic

import chess
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from trainer.cancellation import throttled
from trainer.chess_core import digest
from trainer.human_models.context import request_for
from trainer.human_models.evidence import policy_summary
from trainer.human_models.runtime import HumanCancelled, HumanUnavailable, MaiaProvider
from trainer.human_models.types import HumanEvidence, HumanPolicy
from trainer.models import HumanAnalysis


class HumanModels:
    def __init__(self, settings, provider=None):
        self.settings = settings
        self.provider = provider or MaiaProvider(settings)
        self.configuration_key = digest(self.provider.provenance.model_dump(mode="json"))
        self._locks = tuple(threading.Lock() for _ in range(128))
        # A prediction failed in this process since the runtime last produced a policy.
        self._failed = False

    def snapshot(self):
        return self.provider.snapshot()

    def can_attempt(self):
        return self.snapshot().status in {"ready", "unchecked"}

    def retries_saved_failures(self):
        """Retry saved failures once the runtime is ready, or until it fails in this process.

        A broken checkpoint would otherwise rewrite every saved failure on each game
        open, only to fail again after its cooldown.
        """
        status = self.snapshot().status
        return status == "ready" or (status == "unchecked" and not self._failed)

    def needs_refresh(self, evidence, parsed, actor, fallback):
        if not self.can_attempt():
            return False
        from trainer.game_library import pgn_rating

        if (evidence or {}).get("status") == "unavailable" and not self.retries_saved_failures():
            return False
        return (
            not evidence
            or evidence.get("status") != "available"
            or evidence.get("configuration_key") != self.configuration_key
            or evidence.get("conditioning", {}).get("self_rating")
            != (pgn_rating(parsed, actor) or fallback)
            or evidence.get("conditioning", {}).get("opponent_rating")
            != (pgn_rating(parsed, not actor) or fallback)
        )

    def cache_key(self, request):
        return digest(
            {"request": request.model_dump(mode="json"), "configuration": self.configuration_key}
        )

    def prefetch(self, sessions, parsed, boards, fallback, cancelled=lambda: False):
        """Score a game's uncached positions in batches; evidence() then reads the cache.

        Failures are left to the per-move path, which records them as usual.
        """
        predict_many = getattr(self.provider, "predict_many", None)
        if predict_many is None or not self.settings.human_model_enabled:
            return
        if not self.can_attempt():
            return
        pending = {}
        for board in boards:
            if board.is_game_over() or board.uci_variant != "chess":
                continue
            request = request_for(parsed, board, fallback)
            pending.setdefault(self.cache_key(request), request)
        with sessions() as db:
            saved = set(
                db.scalars(
                    select(HumanAnalysis.cache_key).where(HumanAnalysis.cache_key.in_(pending))
                )
            )
        missing = [(key, request) for key, request in pending.items() if key not in saved]
        if not missing:
            return
        try:
            policies = predict_many([request for _, request in missing], cancelled)
        except (HumanUnavailable, ValueError, OSError):
            return
        self._failed = False
        with sessions() as db:
            for (key, request), policy in zip(missing, policies, strict=True):
                db.add(
                    HumanAnalysis(
                        cache_key=key,
                        request=request.model_dump(mode="json"),
                        policy=policy.model_dump(mode="json"),
                    )
                )
            try:
                db.commit()
            except IntegrityError:
                # Another job saved some of these first; per-move reads find them.
                db.rollback()

    def policy(self, sessions, request, cancelled=lambda: False):
        """The complete legal-move policy for one request, cached per account.

        Returns the policy and its saved evidence id. Raises HumanUnavailable or
        HumanCancelled; evidence() maps those onto the saved status vocabulary.
        """
        if not self.settings.human_model_enabled:
            raise HumanUnavailable("disabled")
        key = self.cache_key(request)
        owner = sessions.kw["info"]["user_id"]
        lock = self._locks[int(digest([owner, key])[:4], 16) % len(self._locks)]
        deadline = monotonic() + self.settings.human_model_timeout
        waiting = throttled(cancelled)
        try:
            while not lock.acquire(timeout=0.05):
                if waiting():
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
                    self._failed = False
                legal = {move.uci() for move in chess.Board(request.history.fen).legal_moves}
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
            return policy, evidence_id
        except HumanCancelled:
            raise
        except (HumanUnavailable, ValueError, OSError) as exc:
            self._failed = True
            raise HumanUnavailable("human_model_unavailable") from exc

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
        try:
            policy, evidence_id = self.policy(sessions, request, cancelled)
            return HumanEvidence(
                status="available",
                evidence_id=evidence_id,
                **policy_summary(policy, played, best),
                **base,
            ).model_dump(mode="json")
        except HumanCancelled:
            return HumanEvidence(status="cancelled", **base).model_dump(mode="json")
        except HumanUnavailable:
            return HumanEvidence(
                status="unavailable", unavailable_reason="human_model_unavailable", **base
            ).model_dump(mode="json")

    def close(self):
        self.provider.close()
