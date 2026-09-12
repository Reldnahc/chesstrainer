"""Opt-in, bounded extra Stockfish work for insufficient classification evidence."""

import logging

from sqlalchemy import select

from trainer.chess_core import Candidate, digest
from trainer.classification import verified_payload
from trainer.continuations import continuation_end, extended_line
from trainer.defensive_probes import hypotheses
from trainer.diagnosis_types import OUTCOME_SKILLS
from trainer.engine import EngineUnavailable
from trainer.imports import decision_board
from trainer.local_classifier import LocalClassifier
from trainer.models import (
    ClassificationAnalysis,
    ClassificationProbe,
    ClassificationTask,
    Decision,
    Game,
)

log = logging.getLogger(__name__)


def probe_key(decision, settings, engine):
    return digest(
        {
            "probe_version": "2",
            "decision": decision.id,
            "original": [decision.before_analysis_id, decision.played_analysis_id],
            "engine": engine.version,
            "binary": engine.binary_hash,
            "depth": settings.classification_probe_depth,
            "time": settings.classification_probe_time,
            "threads": settings.stockfish_threads,
            "hash": settings.stockfish_hash_mb,
            "queries": settings.classification_probe_queries,
            "rules": LocalClassifier.version,
            "parameters": LocalClassifier(settings).parameters,
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
        pending_defense = "defense_probe_pending" in result.abstention_reasons
        if (
            specific
            and "continuation_unsettled" not in result.abstention_reasons
            and not pending_defense
        ):
            continue
        candidates.append((not pending_defense, bool(result.outcomes), specific, decision.id, key))
    # Unknown outcomes get the first budget. Already-known mate transitions should
    # not consume every probe merely because a mating PV has no quiet endpoint.
    candidates.sort(
        key=lambda item: item[:3]
    )  # Concrete defensive questions first, then missing outcomes.
    tasks = []
    for _, _, _, decision_id, key in candidates[: settings.classification_probe_positions]:
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
    if cancelled():
        return False
    probes = []
    queries = 2
    settings = engine.settings
    hard_end = settings.classification_max_plies + settings.classification_extension_plies
    roots = [before, actual]
    # Resolve a short unfinished tail directly. The original root score stays
    # attached to its root; the new analysis has its own side-to-move perspective.
    for root in roots:
        if queries >= settings.classification_probe_queries:
            break
        candidate, boards = extended_line(
            board, Candidate.model_validate(root.candidates[0]), root.id, probes
        )
        endpoint = continuation_end(
            boards,
            board.turn,
            settings.classification_max_plies,
            settings.classification_extension_plies,
        )
        if (
            endpoint.material_delta is not None
            or candidate.score.kind == "mate"
            or len(candidate.pv) >= hard_end
            or boards[-1].is_game_over(claim_draw=True)
        ):
            continue
        tail = engine.analyze(boards[-1], multipv=1, classification_probe=True)
        queries += 1
        probes.append(
            {
                "kind": "tail",
                "root_analysis_id": root.id,
                "at_ply": len(candidate.pv),
                "query_key": digest({"kind": "tail", "root": root.id, "at_ply": len(candidate.pv)}),
                "analysis_id": tail.id,
                "fen": tail.fen,
                "config": tail.config,
                "candidate": tail.candidates[0],
            }
        )
        if cancelled():
            return False
    for root, first, direction in (
        (actual, 2, "allowed_opponent_tactic"),
        (before, 1, "missed_opportunity"),
    ):
        candidate, boards = extended_line(
            board, Candidate.model_validate(root.candidates[0]), root.id, probes
        )
        endpoint = continuation_end(
            boards,
            board.turn,
            settings.classification_max_plies,
            settings.classification_extension_plies,
        )
        for request in hypotheses(
            boards,
            first,
            endpoint.end_ply,
            root.id,
            direction,
            settings.classification_tactic_plies,
        ):
            if queries >= settings.classification_probe_queries:
                break
            test = engine.analyze(
                boards[request.at_ply],
                multipv=1,
                root_moves=request.root_moves,
                classification_probe=True,
            )
            queries += 1
            probes.append(
                {
                    "kind": request.kind,
                    "root_analysis_id": root.id,
                    "at_ply": request.at_ply,
                    "query_key": request.key,
                    "analysis_id": test.id,
                    "fen": test.fen,
                    "config": test.config,
                    "candidate": test.candidates[0],
                }
            )
            if cancelled():
                return False
    # Both immutable engine records commit before the optional classification link.
    with write_lock, sessions() as db:
        if not db.scalar(
            select(ClassificationAnalysis.id).where(
                ClassificationAnalysis.cache_key == task.cache_key
            )
        ):
            supplement = ClassificationAnalysis(
                decision_id=task.decision_id,
                job_id=task.job_id,
                cache_key=task.cache_key,
                before_analysis_id=before.id,
                played_analysis_id=actual.id,
            )
            db.add(supplement)
            db.flush()
            for probe in probes:
                db.add(
                    ClassificationProbe(
                        classification_analysis_id=supplement.id,
                        **{
                            key: probe[key]
                            for key in (
                                "root_analysis_id",
                                "analysis_id",
                                "kind",
                                "at_ply",
                                "query_key",
                            )
                        },
                    )
                )
            db.commit()
    log.info(
        "classification_probe_completed",
        extra={"decision_id": task.decision_id, "queries": queries, "linked_probes": len(probes)},
    )
    return True
