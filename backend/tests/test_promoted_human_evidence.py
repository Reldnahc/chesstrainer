"""A played move its own stronger search promotes to best keeps its human evidence."""

from types import SimpleNamespace

import chess
import chess.pgn
from review_intelligence_fixtures import move_report
from trainer.chess_core import digest
from trainer.game_review import public_report, shown_best_uci
from trainer.human_models.context import request_for
from trainer.human_models.types import HumanEvidence, HumanMove, HumanPolicy, ModelProvenance
from trainer.review_reports import effective_report

PROVENANCE = ModelProvenance(
    provider="maia3",
    model="synthetic-test-policy",
    model_revision="test",
    checkpoint_sha256="test",
    code_revision="test",
    adapter_version="test",
    inference={},
)
POLICY = HumanPolicy(
    provenance=PROVENANCE,
    complete=False,
    moves=[
        HumanMove(uci="d2d4", rank=1, probability=0.4),
        HumanMove(uci="e2e4", rank=2, probability=0.25),
    ],
)


def promoted_row():
    """e2e4's own search (+0.40) beats the root's best d2d4 (+0.10). The saved
    evidence scored d2d4 as the engine's best, as rows did before promotion was
    scored at the source."""
    board = chess.Board()
    parsed = chess.pgn.Game()
    parsed.headers.update(WhiteElo="1200", BlackElo="1400")
    request = request_for(parsed, board, 1000)
    report = move_report(board, "e2e4", best="d2d4", before=10, after=40)
    report["human"] = HumanEvidence(
        status="available",
        evidence_id="human-promoted",
        configuration_key="synthetic-policy",
        history_key=digest(request.history.model_dump()),
        mover=request.mover,
        conditioning=request.conditioning,
        domain=request.domain,
        provenance=PROVENANCE,
        played=HumanMove(uci="e2e4", rank=2, probability=0.25),
        engine_best=HumanMove(uci="d2d4", rank=1, probability=0.4),
        legal_count=board.legal_moves.count(),
    ).model_dump(mode="json")
    return SimpleNamespace(report=report, human_analysis_id="human-promoted")


def test_human_evidence_is_scored_for_the_move_shown_as_best():
    row = promoted_row()
    assert shown_best_uci(row.report) == "e2e4"
    db = SimpleNamespace(get=lambda model, key: SimpleNamespace(policy=POLICY.model_dump()))
    shown = public_report(effective_report(db, row, None, False, False), 1200)
    assert shown["best"]["uci"] == "e2e4"
    assert shown["human"]["engine_best"]["uci"] == "e2e4"
    # The practical view reads the evidence, so the human-insight lines stay.
    assert shown["practical"]["human_evidence_id"] == "human-promoted"
    assert "human_move_context_mismatch" not in shown["practical"]["limitations"]
    assert shown["practical"]["played_naturalness"] != "unknown"


def test_a_move_that_is_not_promoted_keeps_the_roots_best():
    report = move_report(chess.Board(), "e2e4", best="d2d4", before=40, after=10)
    assert shown_best_uci(report) == "d2d4"


def test_evidence_already_scoring_the_shown_best_reads_no_policy():
    from trainer.review_reports import aligned_human

    report = promoted_row().report
    report["human"]["engine_best"] = report["human"]["played"]

    def unexpected():
        raise AssertionError("an aligned report must not read the saved policy")

    assert aligned_human(report, unexpected) is report


def test_saved_play_reports_score_the_promoted_move(monkeypatch):
    from trainer.play import sessions

    report = promoted_row().report
    db = SimpleNamespace(get=lambda model, key: SimpleNamespace(policy=POLICY.model_dump()))
    monkeypatch.setattr(sessions, "object_session", lambda play: db)
    parsed = chess.pgn.Game()
    parsed.add_main_variation(chess.Move.from_uci("e2e4"))
    play = SimpleNamespace(
        id="play-promoted", moves=["e2e4"], reports={"1": report}, learner_rating=1200
    )
    shown = sessions.rendered_reports(play, parsed)[1]
    assert shown["human"]["engine_best"]["uci"] == "e2e4"
    assert shown["practical"]["human_evidence_id"] == "human-promoted"


def test_refinement_nominates_on_the_evidence_for_the_shown_best():
    from trainer.review_intelligence.refinement_plan import nominate

    report = promoted_row().report
    # The promoted move, scored as the engine's best, is one humans rarely play.
    rare = HumanMove(uci="e2e4", rank=9, probability=0.01)
    report["human"] = report["human"] | {
        "played": rare.model_dump(),
        "engine_best": rare.model_dump(),
    }
    assert "human_disagreement" in [trigger for _, trigger in nominate(report)]
