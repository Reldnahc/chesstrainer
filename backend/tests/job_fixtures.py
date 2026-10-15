"""Jobs that tests queue directly."""

from trainer.job_lifecycle import JobKind
from trainer.models import AnalysisJob


def queue_import_analysis(db, imported):
    """A whole-import analysis job, as older versions saved for each import.

    Nothing creates these now, but saved ones still run; pipeline tests use them to
    drive several games through one job.
    """
    job = AnalysisJob(
        kind=JobKind.ANALYSIS, import_id=imported["import_id"], games_total=imported["imported"]
    )
    db.add(job)
    db.commit()
    return job.id
