from lesson_fixtures import seed_lesson
from sqlalchemy import select
from trainer.classification import Classification, classify_decision, reject_run
from trainer.models import ClassificationRun, CourseUnit, Decision, SkillEvidence
from trainer.weaknesses import priorities


def test_classification_versions_reconcile_and_rejection_preserves_truth(settings, sessions):
    class Classifier:
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
            ), {}

    classifier = Classifier()
    with sessions() as db:
        seed_lesson(db, settings, count=1)
        decision_id = db.scalar(select(Decision.id))
        assert classify_decision(db, decision_id, classifier, settings)
        first = db.scalar(select(SkillEvidence).where(SkillEvidence.active.is_(True)))
        first_run = first.classification_run_id
        classifier.model, classifier.skill = "version-b", "fork"
        assert classify_decision(db, decision_id, classifier, settings)
        active = db.scalars(select(SkillEvidence).where(SkillEvidence.active.is_(True))).all()
        assert [row.skill_id for row in active] == ["fork"]
        assert db.get(ClassificationRun, first_run).response["primary_skill"] == "king_safety"
        classifier.model = "version-a"
        assert classify_decision(db, decision_id, classifier, settings)
        assert classifier.calls == 2
        assert [
            row.skill_id
            for row in db.scalars(select(SkillEvidence).where(SkillEvidence.active.is_(True)))
        ] == ["king_safety"]
        reject_run(db, first_run)
        assert not classify_decision(db, decision_id, classifier, settings)
        assert classifier.calls == 2
        assert db.scalar(select(Decision)).meaningful
        assert priorities(db, settings) == []
        # Reclassification no longer mutates historical course progression.
        assert db.scalar(select(CourseUnit)).active
        classifier.model, classifier.confidence = "version-low", 0.2
        assert classify_decision(db, decision_id, classifier, settings)
        assert db.scalars(select(SkillEvidence).where(SkillEvidence.active.is_(True))).all() == []
