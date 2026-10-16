"""Deterministic cancellation/link contracts; native searches have separate fixtures."""

import threading

from account_units import job_context
from explanation_fixtures import seed_review
from sqlalchemy import select
from trainer.chess_core import Candidate, Score, position_key
from trainer.classification import verified_payload
from trainer.continuations import replay
from trainer.db import Units
from trainer.enrichment import enrich_decision, plan_probes
from trainer.local_classifier import LocalClassifier
from trainer.models import (
    AnalysisJob,
    ClassificationAnalysis,
    ClassificationProbe,
    Decision,
    EngineAnalysis,
    ExerciseAnswer,
    SRSState,
)


class SavedFixtureEngine:
    version = "fixture"
    binary_hash = "fixture"

    def __init__(self, sessions, settings, decision, before, actual):
        self.sessions, self.settings = sessions, settings
        self.decision, self.before, self.actual = decision, before, actual
        self.calls, self.cached = 0, {}

    def start(self):
        pass

    def analyze(self, board, _profile=None, **kwargs):
        self.calls += 1
        if position_key(board) == self.decision.position_key:
            return self.actual if kwargs.get("root_moves") else self.before
        key = board.fen()
        if key in self.cached:
            return self.cached[key]
        # The played tail wins the loose bishop too, then settles with no capture pending.
        pv = ["a5a1", "f7e6"] if board.turn else ["a1b2", "e2d3", "b2b4", "d3e3", "g8f7"]
        candidate = Candidate(
            uci=pv[0],
            san=board.san(board.parse_uci(pv[0])),
            pv=pv,
            score=Score(kind="cp", value=500),
        )
        replay(board, candidate)
        assert len(board.move_stack) in {2, 3}
        with self.sessions() as db:
            analysis = EngineAnalysis(
                cache_key=key,
                fen=board.fen(),
                engine_version="fixture",
                config={},
                candidates=[candidate.model_dump()],
            )
            db.add(analysis)
            db.commit()
            self.cached[key] = analysis
            return analysis


def test_tail_job_cancellation_resume_links_and_preserves_learning(sessions, settings):
    with sessions() as db:
        seed_review(db, settings)
        decision = db.scalar(select(Decision))
        before, actual = (
            db.get(EngineAnalysis, decision.before_analysis_id),
            db.get(EngineAnalysis, decision.played_analysis_id),
        )
        job = AnalysisJob(kind="enrichment", status="running")
        db.add(job)
        db.commit()
        originals = (decision.before_analysis_id, decision.played_analysis_id)
        answers = [
            (a.exercise_id, a.uci, a.grade, a.analysis_id)
            for a in db.scalars(select(ExerciseAnswer))
        ]
        state = db.scalar(select(SRSState))
        scheduling = state.card, state.due, state.reviews, state.retired_at
    engine = SavedFixtureEngine(sessions, settings, decision, before, actual)
    units = Units(sessions, threading.Lock())
    tasks = plan_probes(job_context(sessions, job.id, settings), engine)
    assert len(tasks) == 1
    assert not enrich_decision(units, tasks[0], engine, lambda: engine.calls >= 3)
    with sessions() as db:
        assert db.scalar(select(ClassificationAnalysis)) is None
    assert len(engine.cached) == 1
    assert enrich_decision(units, tasks[0], engine, lambda: False)
    with sessions() as db:
        probes = db.scalars(select(ClassificationProbe)).all()
        assert len(probes) == 2 and {p.kind for p in probes} == {"tail"}
        payload = verified_payload(db, db.get(Decision, decision.id))
        result, _ = LocalClassifier(settings).classify(payload)
        assert result.outcomes and all(
            result.continuations[p.root_analysis_id].material_delta is not None for p in probes
        )
        assert any(o.supporting_analysis_ids for o in result.outcomes)
        saved = db.get(Decision, decision.id)
        assert (saved.before_analysis_id, saved.played_analysis_id) == originals
        assert [
            (a.exercise_id, a.uci, a.grade, a.analysis_id)
            for a in db.scalars(select(ExerciseAnswer))
        ] == answers
        state = db.scalar(select(SRSState))
        assert (state.card, state.due, state.reviews, state.retired_at) == scheduling
    calls = engine.calls
    assert enrich_decision(units, tasks[0], engine, lambda: False)
    assert engine.calls == calls
