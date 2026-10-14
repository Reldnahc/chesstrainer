"""The exactly-once command protocol puzzle and lesson sessions share.

A session is started and changed by requests that carry the client's own
request id and the revision it last saw. A repeated request id returns the
first answer (or a 409 when it now asks for something else); a stale revision is
a 409; and the revision moves by a conditional UPDATE, so two writers that both
saw the same revision cannot both win. New session types with saved progress
should use these. Play games instead compare their move lists under the account
lock, and Review sessions rely on the lock alone.
"""

from sqlalchemy import select, update
from sqlalchemy.orm.attributes import set_committed_value

from trainer.errors import Conflict

# Unfinished sessions offered to resume, newest first.
RESUME_LIMIT = 20


def started_before(db, session_model, request_id, identity, identity_of, message):
    """The session a repeated start request already made, or None for a new request."""
    previous = db.scalar(select(session_model).where(session_model.request_id == request_id))
    if previous is not None and identity_of(previous) != identity:
        raise Conflict(message)
    return previous


def answered_before(db, command_model, session, request_id, payload, message):
    """The saved response to a repeated command, or None for a new command."""
    previous = db.scalar(
        select(command_model).where(
            command_model.session_id == session.id, command_model.request_id == request_id
        )
    )
    if previous is None:
        return None
    if previous.request != payload:
        raise Conflict(message)
    return previous.response


def require_revision(session, expected, message):
    if session.revision != expected:
        raise Conflict(message)


def claim_revision(db, session, expected, message):
    """Advance the session from ``expected`` to the next revision, or raise Conflict."""
    require_revision(session, expected, message)
    model = type(session)
    changed = db.execute(
        update(model)
        .where(model.id == session.id, model.revision == expected)
        .values(revision=expected + 1)
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        raise Conflict(message)
    set_committed_value(session, "revision", expected + 1)
