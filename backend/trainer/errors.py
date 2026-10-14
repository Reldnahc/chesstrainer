"""Domain errors, each meaning one HTTP status; trainer.web maps them in one place.

Domain modules raise these instead of FastAPI's HTTPException, so they stay
independent of the web layer. ``InvalidInput`` is also a ``ValueError``, so code
that validates with ``except ValueError`` keeps working. Any other ``ValueError``
that reaches the web layer is a bug, not bad input, and answers 500.
"""


class DomainError(Exception):
    status = 400


class InvalidInput(DomainError, ValueError):
    """The request asked for something that cannot be done as asked."""

    status = 422


class NotFound(DomainError, LookupError):
    """The item does not exist, or does not exist for this account."""

    status = 404


class Conflict(DomainError):
    """The request no longer matches saved state: a stale revision or a reused request."""

    status = 409


class Gone(DomainError):
    """The item belongs to a removed feature."""

    status = 410


class EvidenceIntegrityError(ValueError):
    """Saved engine or classification evidence contradicts itself; a server-side fault."""
