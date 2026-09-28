"""Native whole-game verification at production review limits, with explicit outputs.

Requires pre-cached Maia and Stockfish. Never downloads models. The new output
directory contains only this synthetic corpus's disposable database and reports.
It can be served locally for manual inspection or imported into the offline lab.
"""

import argparse
import json
from collections import Counter
from pathlib import Path
from time import perf_counter

from fastapi.testclient import TestClient
from review_benchmark.games import game_corpus
from review_benchmark.metrics import machine, peak_rss_bytes
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.config import Settings
from trainer.human_models.preset import verify_checkpoint, verify_source
from trainer.models import (
    Decision,
    EngineAnalysis,
    Exercise,
    HumanAnalysis,
    Review,
    ReviewRefinement,
)


def counts(app):
    with app.state.sessions() as db:
        return {
            model.__tablename__: db.scalar(select(func.count()).select_from(model))
            for model in (
                Decision,
                Exercise,
                Review,
                EngineAnalysis,
                HumanAnalysis,
                ReviewRefinement,
            )
        }


def inspect_case(detail, plies):
    assert detail["job"]["status"] == "completed", detail["job"]
    assert detail["context"]["complete"]
    assert "narrative" not in detail
    assert len(detail["context"]["nodes"]) == plies
    assert detail["job"]["refinement_total"] <= 8
    events, grades, difficulties, domains = Counter(), Counter(), Counter(), Counter()
    event_ids = set()
    for frame in detail["frames"][1:]:
        report = frame["report"]
        assert report["before_analysis_id"] and report["played_analysis_id"]
        human, practical = report["human"], report["practical"]
        assert human["status"] == "available", human
        assert human["played"]["probability"] is not None
        assert human["domain"]["calibration"] == "unvalidated"
        assert practical["human_evidence_id"] == human["evidence_id"]
        grades[report["label"]] += 1
        difficulties[practical["best_find_difficulty"]] += 1
        domains[human["domain"]["alignment"]] += 1
        for event in report["intelligence"]["events"]:
            assert event["evidence"]
            event_ids.add(event["id"])
            events[event["kind"]] += 1
    relations = detail["context"]["relationships"]
    for relation in relations:
        assert set(relation["event_ids"]) <= event_ids
        assert all(1 <= ply <= plies for ply in relation["plies"])
    return {
        "grades": grades,
        "difficulty": difficulties,
        "domain": domains,
        "events": events,
        "relationships": Counter(r["kind"] for r in relations),
        "refined_positions": detail["job"]["refinement_completed"],
    }


def run(output):
    settings = Settings(
        _env_file=None,
        database_path=output / "verification.sqlite3",
        public_origin="",
        accounts_enabled=False,
    )
    verify_source()
    verify_checkpoint(settings.human_model_path)
    assert (settings.deep_depth, settings.deep_time) == (16, 0.8)
    assert settings.review_refinement_positions == 8
    app = create_app(settings, workers=False)
    summaries, saved = [], {}
    with TestClient(app) as client:
        for item in game_corpus():
            started = perf_counter()
            client.post(
                "/api/imports",
                files={"file": (item["id"] + ".pgn", item["pgn"])},
                data={"side": "white", "analyze": "false"},
            ).raise_for_status()
            games = client.get("/api/games").json()["items"]
            game = next(row["id"] for row in games if row["white"] == f"Probe {item['id']}")
            job = client.post(f"/api/games/{game}/review", json={}).json()["job_id"]
            app.state.runner.run_job(job)
            response = client.get(f"/api/games/{game}")
            response.raise_for_status()
            detail = response.json()
            result = inspect_case(detail, item["plies"])
            result.update(
                id=item["id"],
                game_id=game,
                plies=item["plies"],
                seconds=perf_counter() - started,
                intended_inspection=item["coverage"],
            )
            summaries.append(result)
            saved[game] = detail
            (output / f"{item['id']}.json").write_text(
                json.dumps(detail, indent=2), encoding="utf-8"
            )
            print(json.dumps(result), flush=True)
        original_counts = counts(app)
        assert all(original_counts[key] == 0 for key in ("decisions", "exercises", "reviews"))
        # Every current identity sees the same exact saved truth.
        coaches = client.get("/openapi.json").json()["components"]["schemas"]["CoachPreferences"][
            "properties"
        ]["coach_id"]["enum"]
        for coach in coaches:
            client.put(
                "/api/preferences/coach", json={"coach_id": coach, "motion": "still"}
            ).raise_for_status()
            for game, detail in saved.items():
                assert client.get(f"/api/games/{game}").json() == detail
        assert counts(app) == original_counts
        # Analyze a legal branch through the actual API, without borrowing PGN clocks/context.
        game = summaries[0]["game_id"]
        response = client.post(f"/api/games/{game}/analyze", json={"ply": 1, "moves": ["d7d5"]})
        response.raise_for_status()
        branch = response.json()["report"]
        assert branch["human"]["status"] == "available"
        assert branch["intelligence"]["ply"] is None and branch["intelligence"]["clock"] is None
        assert client.get(f"/api/games/{game}").json() == saved[game]
        original_counts = counts(app)
    # Open with an unusable native path: successful reads/reopens must use durable facts.
    settings.stockfish_path = "must-not-start-on-cached-reopen"
    restarted = create_app(settings, workers=False, start_engine=False)
    with TestClient(restarted) as client:
        started = perf_counter()
        for game, detail in saved.items():
            assert client.post(f"/api/games/{game}/review", json={}).json()["status"] == "completed"
            assert client.get(f"/api/games/{game}").json() == detail
        assert counts(restarted) == original_counts
        assert not restarted.state.human_models.provider._workers
        cached_seconds = perf_counter() - started
    return {
        "version": "whole-game-verification-1",
        "machine": machine(),
        "games": summaries,
        "settings": {
            key: getattr(settings, key)
            for key in (
                "deep_depth",
                "deep_time",
                "review_refinement_positions",
                "review_refinement_queries",
                "human_model_threads",
                "human_model_workers",
            )
        },
        "counts": original_counts,
        "coaches": len(coaches),
        "restart_cached_seconds": cached_seconds,
        "python_peak_rss_bytes": peak_rss_bytes(),
        "memory_scope": "API process only; model and Stockfish are separate children",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    result = run(args.output.resolve())
    (args.output / "summary.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(
        f"Verified {len(result['games'])} games; restart/cache and all-coach evidence equality passed."
    )


if __name__ == "__main__":
    main()
