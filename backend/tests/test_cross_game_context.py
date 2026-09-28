"""Historical statements need independent owned games, not repeated local mistakes."""

import pytest
from lesson_fixtures import seed_lesson
from review_cause_fixtures import CAUSES, cause_report
from sqlalchemy import select
from test_game_context import reviewed
from trainer.accounts import Accounts
from trainer.game_review import public_report
from trainer.models import Decision, Game, SkillEvidence
from trainer.ownership import account_sessions
from trainer.review_intelligence.history import cross_game_context
from trainer.weaknesses import priorities


def current_evidence(ply=1, role="missed"):
    _, reports, context = reviewed([0] * 8)
    reports[ply]["intelligence"]["events"].append(
        {
            "kind": "tactic",
            "id": "current-fork",
            "facts": {"motif": "fork", "role": role},
        }
    )
    return reports, context


@pytest.mark.parametrize("skill", CAUSES)
@pytest.mark.parametrize("black", [False, True])
def test_causal_errors_match_only_the_learners_owned_weaknesses(settings, sessions, skill, black):
    _, reports, context = reviewed([0] * 8)
    ply = 2 if black else 1
    reports[ply] = public_report(cause_report(skill, black), 1000)
    with sessions() as db:
        seed_lesson(db, settings, count=3, skills=[skill])
        game = db.scalars(select(Game).order_by(Game.created_at)).first()
        game.learner_color = not black
        result = cross_game_context(db, settings, game, reports, context)
        match = next(w for w in result.weaknesses if w.skill_id == skill)
        assert match.status == "supported" and match.independent_games == 2
        assert match.related_plies == [ply]
        game.learner_color = black
        assert not cross_game_context(db, settings, game, reports, context).weaknesses


def test_existing_recurrence_threshold_and_current_game_exclusion(settings, sessions):
    with sessions() as db:
        seed_lesson(db, settings, count=2, skills=["fork"])
        game = db.scalars(select(Game).order_by(Game.created_at)).first()
        reports, context = current_evidence()
        before = cross_game_context(db, settings, game, reports, context)
        fact = before.weaknesses[0]
        assert fact.independent_games == 1 and fact.status == "provisional"
        assert game.id not in fact.game_ids
        assert priorities(db, settings)[0]["independent_games"] == 2
        seed_lesson(db, settings, count=1, offset=2, skills=["fork"])
        supported = cross_game_context(db, settings, game, reports, context)
        fact = supported.weaknesses[0]
        assert fact.status == "supported" and fact.independent_games == 2
        assert fact.related_plies == [1] and len(fact.evidence) == 2
        assert supported.input_digest != before.input_digest
        assert supported == cross_game_context(db, settings, game, reports, context)
        settings.min_independent_games = 3
        assert (
            cross_game_context(db, settings, game, reports, context).weaknesses[0].status
            == "provisional"
        )


def test_multiple_positions_in_one_other_game_remain_one_independent_sample(settings, sessions):
    with sessions() as db:
        seed_lesson(db, settings, count=3, skills=["fork"])
        games = db.scalars(select(Game).order_by(Game.created_at)).all()
        second = db.scalar(select(Decision).where(Decision.game_id == games[2].id))
        second.game_id, second.ply = games[1].id, 3
        db.commit()
        result = cross_game_context(db, settings, games[0], *current_evidence())
        fact = result.weaknesses[0]
        assert fact.occurrences == 2 and fact.independent_games == 1
        assert fact.status == "provisional"


@pytest.mark.parametrize("black", [False, True])
def test_inactive_evidence_and_opponent_or_positive_motifs_do_not_personalize(
    settings, sessions, black
):
    with sessions() as db:
        seed_lesson(db, settings, count=3, skills=["fork"])
        game = db.scalars(select(Game)).first()
        game.learner_color = not black
        own_ply, opponent_ply = (2, 1) if black else (1, 2)
        assert not cross_game_context(
            db, settings, game, *current_evidence(ply=opponent_ply)
        ).weaknesses
        for role in ("played", "alternative"):
            assert not cross_game_context(
                db, settings, game, *current_evidence(ply=own_ply, role=role)
            ).weaknesses
        for evidence in db.scalars(select(SkillEvidence)):
            evidence.active = False
        db.commit()
        assert not cross_game_context(db, settings, game, *current_evidence(ply=own_ply)).weaknesses


def test_another_account_cannot_supply_corroboration(settings, sessions):
    accounts = Accounts(settings.database_path)
    bob = accounts.create("history-bob", "test-history-password")
    bob_sessions = account_sessions(sessions.kw["bind"], bob["id"])
    with bob_sessions() as db:
        seed_lesson(db, settings, count=3, offset=7, skills=["fork"])
        bob_evidence = {e.id for e in db.scalars(select(SkillEvidence))}
    with sessions() as db:
        seed_lesson(db, settings, count=1, skills=["fork"])
        game = db.scalars(select(Game)).first()
        result = cross_game_context(db, settings, game, *current_evidence())
        assert result.weaknesses == []
        assert not any(identifier in result.model_dump_json() for identifier in bob_evidence)


def test_no_supported_history_never_turns_into_a_practice_transfer_claim(settings, sessions):
    with sessions() as db:
        seed_lesson(db, settings, count=1, skills=["fork"])
        game = db.scalars(select(Game)).first()
        result = cross_game_context(db, settings, game, *current_evidence())
        assert result.weaknesses == []
        assert result.scope == "other_saved_games"
        assert "recurrence_does_not_measure_training_transfer" in result.limitations
