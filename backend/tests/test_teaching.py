from account_units import units_for
from classifier_fixtures import FixtureClassifierBase, findings_for
from lesson_fixtures import seed_lesson
from sqlalchemy import select
from trainer.classification import Classification, classify_decision, reject_run
from trainer.models import ClassificationRun, Decision, SkillEvidence
from trainer.weaknesses import priorities


def test_classification_versions_reconcile_and_rejection_preserves_truth(settings, sessions):
    class Classifier(FixtureClassifierBase):
        model = "version-a"
        skill = "king_safety"
        confidence = 0.9
        calls = 0

        def classify(self, evidence):
            self.calls += 1
            return Classification(
                decision_id=evidence["decision_id"],
                primary_skill=self.skill,
                secondary_skills=[],
                confidence=self.confidence,
                explanation="Compare supplied evidence.",
                findings=findings_for(evidence, self.skill),
            )

    classifier = Classifier()
    with sessions() as db:
        seed_lesson(db, settings, count=1)
        decision_id = db.scalar(select(Decision.id))
        db.commit()
        units = units_for(db)
        assert classify_decision(units, decision_id, classifier)
        first = db.scalar(select(SkillEvidence).where(SkillEvidence.active.is_(True)))
        first_run = first.classification_run_id
        classifier.model, classifier.skill = "version-b", "fork"
        assert classify_decision(units, decision_id, classifier)
        active = db.scalars(select(SkillEvidence).where(SkillEvidence.active.is_(True))).all()
        assert [row.skill_id for row in active] == ["fork"]
        assert db.get(ClassificationRun, first_run).response["primary_skill"] == "king_safety"
        classifier.model = "version-a"
        assert classify_decision(units, decision_id, classifier)
        assert classifier.calls == 2
        assert [
            row.skill_id
            for row in db.scalars(select(SkillEvidence).where(SkillEvidence.active.is_(True)))
        ] == ["king_safety"]
        reject_run(db, first_run)
        db.commit()
        assert not classify_decision(units, decision_id, classifier)
        assert classifier.calls == 2
        assert db.scalar(select(Decision)).meaningful
        assert priorities(db, settings) == []
        # Reclassification no longer mutates historical course progression.
        classifier.model, classifier.confidence = "version-low", 0.2
        assert classify_decision(units, decision_id, classifier)
        assert db.scalars(select(SkillEvidence).where(SkillEvidence.active.is_(True))).all() == []
