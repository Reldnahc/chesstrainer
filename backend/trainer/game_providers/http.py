"""The HTTP side every provider client shares: one client setup and one rate-limit rule."""

from email.utils import parsedate_to_datetime

import httpx

from trainer import timeutil
from trainer.game_providers.base import ProviderRateLimited


def provider_client(settings, *, timeout, accept, transport=None):
    """An httpx client that never follows redirects and names this server to the provider."""
    return httpx.Client(
        timeout=timeout,
        follow_redirects=False,
        transport=transport,
        headers={"User-Agent": settings.provider_user_agent, "Accept": accept},
    )


def retry_after(response, default=None):
    """Seconds a response asks us to wait (Retry-After as seconds or a date), else ``default``."""
    value = response.headers.get("Retry-After")
    if not value:
        return default
    try:
        return max(0.0, float(value))
    except ValueError:
        pass
    try:
        return max(0.0, (parsedate_to_datetime(value) - timeutil.now()).total_seconds())
    except (TypeError, ValueError):
        return default


def rate_limited(response, message):
    """The error for a 429: the host pauses this provider for every account."""
    error = ProviderRateLimited(message)
    error.retry_after = max(ProviderRateLimited.retry_after, retry_after(response, 0))
    return error
