from sqlalchemy import select
from trainer.api import create_app
from trainer.models import AnalysisJob


def test_a_job_gets_its_owner_and_the_hosts_services_in_one_context(settings, sessions):
    with sessions() as db:
        db.add(AnalysisJob(id="job", kind="game_review"))
        db.commit()
    app = create_app(settings, workers=False, start_engine=False)
    runner = app.state.runner
    with runner.workspaces.open("local") as workspace:
        context = runner.context("job", workspace)
        assert (context.job_id, context.user_id) == ("job", "local")
        assert context.settings is runner.settings and context.providers is runner.providers
        assert context.classifier is runner.classifier
        assert context.scheduler is runner.scheduler
        assert context.human_models is workspace.human_models
        with context.read() as db:
            assert db.scalar(select(AnalysisJob.id)) == "job"
        # Not running in this process: a job nobody executes reads as cancelled.
        assert context.cancelled() and not context.stopping()
        runner.stop_event.set()
        assert context.stopping()
