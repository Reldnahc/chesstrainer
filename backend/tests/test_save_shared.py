import chess
from sqlalchemy import func, select
from trainer.models import EngineAnalysis, save_shared


def test_every_saver_gets_the_first_saved_row(sessions):
    values = dict(fen=chess.STARTING_FEN, engine_version="fixture", config={}, candidates=[])
    first = save_shared(sessions, EngineAnalysis, "shared-key", **values)
    second = save_shared(sessions, EngineAnalysis, "shared-key", **values | {"config": {"x": 1}})
    assert first.id == second.id and second.config == {}
    with sessions() as db:
        count = db.scalar(select(func.count()).where(EngineAnalysis.cache_key == "shared-key"))
    assert count == 1
