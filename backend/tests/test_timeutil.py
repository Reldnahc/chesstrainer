from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from trainer import timeutil
from trainer.models import EngineAnalysis


def test_stored_text_is_what_a_timestamp_column_holds(sessions, sql_engine):
    offset = timezone(timedelta(hours=-5))
    for moment in (
        datetime(2026, 3, 1, 9, 30, 0, tzinfo=offset),
        datetime(2026, 3, 1, 14, 30, 0, 123456, tzinfo=timezone.utc),
        datetime(2026, 3, 1, 14, 30),  # naive values are UTC wall time
    ):
        with sessions() as db:
            row = EngineAnalysis(
                cache_key=f"clock-{moment.isoformat()}",
                fen="8/8/8/8/8/8/8/K6k w - - 0 1",
                engine_version="fixture",
                config={},
                candidates=[],
                created_at=moment,
            )
            db.add(row)
            db.commit()
        with sql_engine.connect() as raw_db:
            raw = raw_db.execute(
                text("SELECT created_at FROM engine_analyses WHERE id = :id"), {"id": row.id}
            ).scalar()
        with sessions() as db:
            assert raw == timeutil.stored_text(moment)
            assert db.get(EngineAnalysis, row.id).created_at == timeutil.as_utc(moment)


def test_as_utc_reads_naive_values_as_utc():
    naive = datetime(2026, 1, 2, 3, 4, 5)
    assert timeutil.as_utc(naive) == naive.replace(tzinfo=timezone.utc)
    later = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone(timedelta(hours=2)))
    assert timeutil.as_utc(later).utcoffset() == timedelta(0)
    assert timeutil.as_utc(later) == later
    assert timeutil.EARLIEST < timeutil.now()
