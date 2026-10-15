"""The host-name and origin rules that local mode and account mode share."""

from urllib.parse import urlsplit

# Suffixes reserved for, or conventionally used by, home and private networks.
PRIVATE_SUFFIXES = (".local", ".localhost", ".lan", ".home", ".home.arpa", ".internal")


def lan_hostname(hostname: str) -> bool:
    """A name that only means something inside a home network.

    localhost, a single label such as a router-assigned device name, or a
    private-use suffix. IP literals are checked separately by each caller.
    """
    hostname = hostname.rstrip(".").lower()
    return hostname == "localhost" or "." not in hostname or hostname.endswith(PRIVATE_SUFFIXES)


def origin_parts(origin: str | None):
    """The browser's Origin split into parts, or None when it is missing or malformed."""
    try:
        parts = urlsplit(origin or "")
    except ValueError:
        return None
    return parts if parts.netloc else None


def same_origin(origin: str | None, host: str | None) -> bool:
    """Whether Origin names the Host the request was sent to, ignoring case.

    The scheme is not compared: TLS usually ends at a reverse proxy.
    """
    parts = origin_parts(origin)
    return parts is not None and parts.netloc.lower() == (host or "").lower()
