"""Opt-in, bounded extra Stockfish work for insufficient classification evidence."""

from sqlalchemy import select

from trainer.chess_core import digest
from trainer.classification import verified_payload
from trainer.diagnosis_types import OUTCOME_SKILLS
from trainer.engine import EngineUnavailable
from trainer.imports import decision_board
from trainer.local_classifier import LocalClassifier
from trainer.models import ClassificationAnalysis, ClassificationTask, Decision, Game


def probe_key(decision, settings, engine):
    return digest(
        {
            "probe_version": "1",
            "decision": decision.id,
            "original": [decision.before_analysis_id, decision.played_analysis_id],
            "engine": engine.version,
            "binary": engine.binary_hash,
            "depth": settings.classification_probe_depth,
            "time": settings.classification_probe_time,
            "threads": settings.stockfish_threads,
            "hash": settings.stockfish_hash_mb,
        }
    )


def plan_probes(db, job_id, settings, engine):
    saved = db.scalars(select(ClassificationTask).where(ClassificationTask.job_id == job_id)).all()
    if saved:
        return saved
    engine.start()
    classifier = LocalClassifier(settings)
    decisions = db.scalars(
        select(Decision)
        .where(Decision.meaningful.is_(True))
        .order_by(
            Decision.allows_mate.desc(),
            Decision.loss_cp.desc(),
            Decision.created_at.desc(),
            Decision.id,
        )
    )
    candidates = []
    for decision in decisions:
        key = probe_key(decision, settings, engine)
        if db.scalar(
            select(ClassificationAnalysis.id).where(ClassificationAnalysis.cache_key == key)
        ):
            continue
        result, _ = classifier.classify(verified_payload(db, decision))
        specific = any(f.skill_id not in OUTCOME_SKILLS for f in result.findings)
        if specific and "continuation_unsettled" not in result.abstention_reasons:
            continue
        candidates.append((bool(result.outcomes), specific, decision.id, key))
    # Unknown outcomes get the first budget. Already-known mate transitions should
    # not consume every probe merely because a mating PV has no quiet endpoint.
    candidates.sort(key=lambda item: (item[0], item[1]))  # Stable severity/recency order.
    tasks = []
    for _, _, decision_id, key in candidates[: settings.classification_probe_positions]:
        task = ClassificationTask(job_id=job_id, decision_id=decision_id, cache_key=key)
        db.add(task)
        tasks.append(task)
    db.commit()
    return tasks


def enrich_decision(sessions, task, engine, write_lock, cancelled):
    with sessions() as db:
        cached = db.scalar(
            select(ClassificationAnalysis).where(ClassificationAnalysis.cache_key == task.cache_key)
        )
        if cached:
            return True
        decision = db.get(Decision, task.decision_id)
        board = decision_board(db.get(Game, decision.game_id), decision.ply)
        actual_uci = decision.move_uci
    engine.start()
    if probe_key(decision, engine.settings, engine) != task.cache_key:
        raise EngineUnavailable(
            "Stockfish or probe settings changed since this job was planned. "
            "Start a new Deepen unclear positions job; completed evidence is retained."
        )
    before = engine.analyze(board, deep=True, multipv=1, classification_probe=True)
    if cancelled():
        return False
    actual = engine.analyze(
        board, deep=True, root_moves=[actual_uci], multipv=1, classification_probe=True
    )
    # Both immutable engine records commit before the optional classification link.
    with write_lock, sessions() as db:
        if not db.scalar(
            select(ClassificationAnalysis.id).where(
                ClassificationAnalysis.cache_key == task.cache_key
            )
        ):
            db.add(
                ClassificationAnalysis(
                    decision_id=task.decision_id,
                    job_id=task.job_id,
                    cache_key=task.cache_key,
                    before_analysis_id=before.id,
                    played_analysis_id=actual.id,
                )
            )
            db.commit()
    return True
