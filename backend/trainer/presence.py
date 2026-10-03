"""Account presence: polling pauses after a week away and resumes on return."""

import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from trainer.models import User

AWAY_AFTER = timedelta(days=7)
# Requests within this window skip the database write entirely.
TOUCH_EVERY_SECONDS = 600

_touched: dict[tuple[int, str], float] = {}
_lock = threading.Lock()


def utc(value):
    return value if value is None or value.tzinfo else value.replace(tzinfo=timezone.utc)


def active_cutoff():
    return datetime.now(timezone.utc) - AWAY_AFTER


def touch(sql_engine, user_id):
    """Record a request; a return after AWAY_AFTER leaves a welcome-back note."""
    now, key = time.monotonic(), (id(sql_engine), user_id)
    with _lock:
        if now - _touched.get(key, -TOUCH_EVERY_SECONDS) < TOUCH_EVERY_SECONDS:
            return
        _touched[key] = now
    current = datetime.now(timezone.utc)
    with Session(sql_engine) as db:
        seen = utc(db.scalar(select(User.last_seen_at).where(User.id == user_id)))
        values = {"last_seen_at": current}
        if seen is not None and current - seen >= AWAY_AFTER:
            values["away_since"] = seen
        db.execute(update(User).where(User.id == user_id).values(**values))
        db.commit()


def welcome_back(sql_engine, user_id):
    with Session(sql_engine) as db:
        away = utc(db.scalar(select(User.away_since).where(User.id == user_id)))
    return {"away_since": away}


def dismiss_welcome_back(sql_engine, user_id):
    with Session(sql_engine) as db:
        db.execute(update(User).where(User.id == user_id).values(away_since=None))
        db.commit()


def forget():
    """Drop the in-memory throttle so the next request writes (tests)."""
    with _lock:
        _touched.clear()
