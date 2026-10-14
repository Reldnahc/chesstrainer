"""The host's single door to game providers: one request at a time, shared cooldowns."""

import threading
import time
from contextlib import contextmanager

from trainer.game_providers.base import ProviderError, ProviderRateLimited


class ProviderCoolingDown(ProviderError):
    """The provider rate limited this host recently; nothing is sent until it cools down."""


class ProviderGateway:
    """Owns provider clients, the host-wide request lock and each provider's cooldown.

    Manual imports, syncs and the poller all reach providers through ``client``,
    so a 429 seen by any of them pauses that provider for every account.
    """

    def __init__(self, settings, factories):
        self.settings, self.factories = settings, dict(factories)
        self.lock = threading.Lock()  # One active provider request per host.
        self.retry_at = {}

    def cooling_down(self, provider):
        return time.monotonic() < self.retry_at.get(provider, 0)

    @contextmanager
    def client(self, provider):
        """A fresh client for ``provider``, used under the host lock and closed after.

        Raises ProviderCoolingDown while the provider's cooldown runs. A
        ProviderRateLimited raised inside starts (or extends) that cooldown.
        """
        with self.lock:
            if self.cooling_down(provider):
                raise ProviderCoolingDown(
                    "This provider is rate limiting requests. Wait at least a minute before "
                    "retrying; saved games are retained."
                )
            client = self.factories[provider](self.settings)
            try:
                yield client
            except ProviderRateLimited as exc:
                self.retry_at[provider] = time.monotonic() + exc.retry_after
                raise
            finally:
                client.close()
