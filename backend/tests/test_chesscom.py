import threading
import time
from datetime import date, datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from trainer.api import create_app
from trainer.chesscom import (
    ChessComClient,
    ChessComError,
    ChessComRequest,
    ImportCancelled,
    fetch_import,
)
from trainer.imports import import_games
from trainer.models import (
    AnalysisJob,
    ChessComArchive,
    ChessComImport,
    Game,
    ImportBatch,
    ImportGame,
)

ROOT = "https://api.chess.com/pub/player/learner/games"
NEW = ROOT + "/2026/02"
OLD = ROOT + "/2026/01"
PGN = '[White "Learner"]\n[Black "Opponent"]\n[Date "2026.02.01"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
BLACK_PGN = '[White "Opponent"]\n[Black "Learner"]\n[Date "2026.01.01"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'


def game(pgn=PGN, *, end=100, speed="rapid", rules="chess", black=False):
    return {
        "pgn": pgn,
        "rules": rules,
        "time_class": speed,
        "end_time": end,
        "white": {"username": "Opponent" if black else "Learner"},
        "black": {"username": "Learner" if black else "Opponent"},
    }


def source_job(sessions, **params):
    with sessions() as db:
        job = AnalysisJob(kind="chesscom", status="running")
        db.add(job)
        db.flush()
        request = ChessComRequest(**{"username": "learner", "months": 0, **params})
        db.add(ChessComImport(job_id=job.id, **request.model_dump()))
        db.commit()
        return job.id


def mock_client(settings, responses, seen=None):
    def handler(request):
        if seen is not None:
            seen.append(str(request.url))
        value = responses[str(request.url)]
        return httpx.Response(value) if isinstance(value, int) else httpx.Response(200, json=value)

    client = ChessComClient(settings, transport=httpx.MockTransport(handler))
    client.pause = lambda *_: None
    return client


def fetch(job_id, sessions, settings, client, cancelled=lambda: False):
    fetch_import(job_id, sessions, settings, client, cancelled, threading.Lock())


def test_request_validation_defaults_and_month_boundaries(settings):
    request = ChessComRequest(username=" LearNER ")
    assert (request.username, request.time_class, request.months, request.max_games) == (
        "learner",
        "rapid",
        3,
        100,
    )
    for value in ["../learner", "https://evil.test", "a/b", "", "hello world"]:
        with pytest.raises(ValidationError):
            ChessComRequest(username=value)
    with pytest.raises(ValidationError):
        ChessComRequest(username="learner", max_games=1001)
    client = mock_client(
        settings, {ROOT + "/archives": {"archives": [OLD, NEW, ROOT + "/2025/12"]}}
    )
    try:
        assert client.archives("learner", 2, datetime(2026, 2, 1), lambda: False) == [NEW, OLD]
        assert client.archives("learner", 0, datetime(2026, 2, 1), lambda: False)[-1].endswith(
            "2025/12"
        )
    finally:
        client.close()


def test_import_filters_matches_both_sides_and_deduplicates_pgn(settings, sessions):
    with sessions() as db:
        import_games(db, "earlier.pgn", PGN, ["learner"], None)
    job_id = source_job(sessions)
    bad_headers = PGN.replace('"Learner"', '"SomebodyElse"')
    client = mock_client(
        settings,
        {
            ROOT + "/archives": {"archives": [OLD, NEW]},
            NEW: {
                "games": [
                    game(),
                    game(speed="blitz"),
                    game(rules="chess960"),
                    game(pgn=bad_headers),
                    game(pgn=""),
                ]
            },
            OLD: {"games": [game(BLACK_PGN, black=True)]},
        },
    )
    try:
        fetch(job_id, sessions, settings, client)
        with sessions() as db:
            request = db.get(ChessComImport, job_id)
            assert request.fetch_completed and request.archives_processed == 2
            assert (
                request.games_imported,
                request.duplicates,
                request.filtered,
                request.rejected,
            ) == (1, 1, 2, 2)
            assert {g.learner_color for g in db.scalars(select(Game))} == {True, False}
            batch = db.get(ImportBatch, db.get(AnalysisJob, job_id).import_id)
            assert PGN in batch.original_pgn and BLACK_PGN in batch.original_pgn
            assert db.scalar(select(func.count()).select_from(Game)) == 2
    finally:
        client.close()


@pytest.mark.parametrize(
    "start,end,expected",
    [
        (date(2026, 2, 10), date(2026, 2, 11), 2),
        (date(2026, 2, 10), None, 3),
        (None, date(2026, 2, 11), 3),
    ],
)
def test_date_filter_includes_whole_utc_days_and_overrides_lookback(
    settings, sessions, start, end, expected
):
    job_id = source_job(sessions, months=1, start_date=start, end_date=end)
    with sessions() as db:
        db.get(AnalysisJob, job_id).created_at = datetime(2026, 9, 11, tzinfo=timezone.utc)
        db.commit()
    timestamps = [
        "2026-02-09T23:59:59",
        "2026-02-10T00:00:00",
        "2026-02-11T23:59:59",
        "2026-02-12T00:00:00",
    ]
    games = [
        game(
            PGN.replace("2026.02.01", f"2026.02.{i + 9:02}"),
            end=datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc).timestamp(),
        )
        for i, stamp in enumerate(timestamps)
    ]
    client = mock_client(settings, {ROOT + "/archives": {"archives": [NEW]}, NEW: {"games": games}})
    try:
        fetch(job_id, sessions, settings, client)
        with sessions() as db:
            request = db.get(ChessComImport, job_id)
            assert request.games_imported == expected
            assert request.filtered == 4 - expected
            assert request.start_date == start and request.end_date == end
    finally:
        client.close()


def test_invalid_dates_and_archive_date_pruning(settings):
    with pytest.raises(ValidationError, match="From date"):
        ChessComRequest(username="learner", start_date="2026-02-12", end_date="2026-02-10")
    client = mock_client(settings, {ROOT + "/archives": {"archives": [OLD, NEW]}})
    try:
        assert client.archives(
            "learner",
            3,
            datetime(2026, 9, 11),
            lambda: False,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 1, 20),
        ) == [OLD]
        assert (
            client.archives(
                "learner", 0, datetime(2026, 9, 11), lambda: False, start_date=date(2026, 3, 1)
            )
            == []
        )
    finally:
        client.close()


def test_newest_matching_games_limit(settings, sessions):
    job_id = source_job(sessions, max_games=1)
    seen = []
    client = mock_client(
        settings,
        {
            ROOT + "/archives": {"archives": [OLD, NEW]},
            NEW: {
                "games": [
                    game(PGN, end=10),
                    game(BLACK_PGN, black=True, end=20),
                    game(speed="bullet", end=30),
                ]
            },
        },
        seen,
    )
    try:
        fetch(job_id, sessions, settings, client)
        with sessions() as db:
            assert db.scalar(select(Game)).learner_color is False
            assert db.get(ChessComImport, job_id).games_fetched == 1
        assert OLD not in seen
    finally:
        client.close()


def test_existing_games_do_not_consume_new_game_limit(settings, sessions):
    with sessions() as db:
        import_games(db, "saved.pgn", PGN, ["learner"], None)
    job_id = source_job(sessions, max_games=1)
    client = mock_client(
        settings,
        {
            ROOT + "/archives": {"archives": [NEW]},
            NEW: {
                "games": [game(PGN, end=30), game(PGN, end=20), game(BLACK_PGN, end=10, black=True)]
            },
        },
    )
    try:
        fetch(job_id, sessions, settings, client)
        with sessions() as db:
            source = db.get(ChessComImport, job_id)
            assert (source.games_imported, source.duplicates, source.games_fetched) == (1, 2, 3)
            assert db.get(AnalysisJob, job_id).games_total == 1
    finally:
        client.close()


def test_repeat_import_100_saved_plus_20_new_only_schedules_20(settings, sessions):
    pgns = [PGN.replace("[Date", f'[Round "{i}"]\n[Date') for i in range(120)]
    with sessions() as db:
        original = import_games(db, "first100.pgn", "\n\n".join(pgns[:100]), ["learner"], None)
        assert original["imported"] == 100
    job_id = source_job(sessions, max_games=100)
    client = mock_client(
        settings,
        {
            ROOT + "/archives": {"archives": [NEW]},
            NEW: {"games": [game(pgn, end=i + 1) for i, pgn in enumerate(pgns)]},
        },
    )
    try:
        fetch(job_id, sessions, settings, client)
        with sessions() as db:
            source = db.get(ChessComImport, job_id)
            job = db.get(AnalysisJob, job_id)
            assert (source.games_imported, source.duplicates, job.games_total) == (20, 100, 20)
            assert db.scalar(select(func.count()).select_from(Game)) == 120
            links = db.scalars(
                select(ImportGame).where(ImportGame.import_id == job.import_id)
            ).all()
            assert len(links) == 120  # Full provenance remains separate from job scope.
            assert sum(link.is_new for link in links) == 20
            repeated = import_games(db, "again.pgn", "\n\n".join(pgns), ["learner"], None)
            assert repeated["duplicates"] == 120 and repeated["job_id"] is None
        repeated_job = source_job(sessions)
        fetch(repeated_job, sessions, settings, client)
        with sessions() as db:
            assert db.get(AnalysisJob, repeated_job).games_total == 0
            assert db.get(ChessComImport, repeated_job).duplicates == 120
    finally:
        client.close()


def test_partial_failure_and_restart_keep_archive_checkpoint(settings, sessions):
    job_id = source_job(sessions)
    seen = []
    responses = {ROOT + "/archives": {"archives": [OLD, NEW]}, NEW: {"games": [game()]}, OLD: 503}
    client = mock_client(settings, responses, seen)
    try:
        with pytest.raises(ChessComError, match="busy"):
            fetch(job_id, sessions, settings, client)
        with sessions() as db:
            assert db.get(ChessComArchive, (job_id, NEW))
            assert db.get(ChessComImport, job_id).games_imported == 1
        responses[OLD] = {"games": [game(BLACK_PGN, black=True)]}
        fetch(job_id, sessions, settings, client)
        assert seen.count(NEW) == 1
        calls = len(seen)
        fetch(job_id, sessions, settings, client)
        assert len(seen) == calls
        with sessions() as db:
            assert db.get(ChessComImport, job_id).games_imported == 2
    finally:
        client.close()


def test_cancel_retains_downloads_and_can_resume(settings, sessions):
    job_id = source_job(sessions)

    def cancelled():
        with sessions() as db:
            return db.get(ChessComImport, job_id).archives_processed >= 1

    client = mock_client(
        settings,
        {
            ROOT + "/archives": {"archives": [OLD, NEW]},
            NEW: {"games": [game()]},
            OLD: {"games": [game(BLACK_PGN, black=True)]},
        },
    )
    try:
        with pytest.raises(ImportCancelled):
            fetch(job_id, sessions, settings, client, cancelled)
        fetch(job_id, sessions, settings, client)
        with sessions() as db:
            request = db.get(ChessComImport, job_id)
            assert request.archives_processed == 2 and request.games_imported == 2
    finally:
        client.close()


@pytest.mark.parametrize(
    "status,match", [(404, "not found"), (403, "denied"), (301, "redirected"), (410, "not found")]
)
def test_provider_errors_are_actionable(settings, status, match):
    client = mock_client(settings, {ROOT + "/archives": status})
    try:
        with pytest.raises(ChessComError, match=match):
            client.archives("learner", 0, datetime.now(timezone.utc), lambda: False)
    finally:
        client.close()


def test_retries_rate_limit_without_following_untrusted_urls(settings):
    calls, delays = [], []

    def handler(request):
        calls.append(request)
        return (
            httpx.Response(429, headers={"Retry-After": "0"})
            if len(calls) == 1
            else httpx.Response(200, json={"archives": []})
        )

    client = ChessComClient(settings, transport=httpx.MockTransport(handler))
    client.pause = lambda seconds, _: delays.append(seconds)
    try:
        assert client.archives("learner", 0, datetime.now(timezone.utc), lambda: False) == []
        assert len(calls) == 2 and delays == [0]
        assert calls[0].headers["User-Agent"].startswith("FieldworkChessTrainer/")
        with pytest.raises(ChessComError, match="unsupported"):
            client.get_json("http://127.0.0.1/private", lambda: False)
        assert len(calls) == 2
    finally:
        client.close()


def test_bad_response_limit_and_archive_host(settings):
    settings.chesscom_max_response_bytes = 1000
    for payload, match in [
        ({"archives": ["https://evil.test/2026/01"]}, "unexpected"),
        ({"archives": "bad"}, "archive list"),
        ({"archives": [], "padding": "x" * 2000}, "exceeds"),
    ]:
        client = mock_client(settings, {ROOT + "/archives": payload})
        try:
            with pytest.raises(ChessComError, match=match):
                client.archives("learner", 0, datetime.now(timezone.utc), lambda: False)
        finally:
            client.close()


def test_enqueue_is_immediate_validated_and_deduplicates_active_jobs(settings):
    settings.stockfish_path = "missing-test-engine"
    with TestClient(create_app(settings, workers=False)) as client:
        response = client.post("/api/imports/chesscom", json={"username": " Learner "})
        assert response.status_code == 202
        job_id = response.json()["job_id"]
        assert (
            client.post("/api/imports/chesscom", json={"username": "learner"}).json()["job_id"]
            == job_id
        )
        assert client.post("/api/imports/chesscom", json={"username": "../evil"}).status_code == 422
        job = client.get("/api/jobs").json()[0]
        assert job["status"] == "queued" and job["chesscom"]["username"] == "learner"
        assert client.post(f"/api/jobs/{job_id}/cancel").json()["status"] == "cancelled"
        bounded = {"username": "learner", "start_date": "2026-02-10", "end_date": "2026-02-11"}
        dated_id = client.post("/api/imports/chesscom", json=bounded).json()["job_id"]
        assert client.post("/api/imports/chesscom", json=bounded).json()["job_id"] == dated_id
        changed_id = client.post(
            "/api/imports/chesscom", json={**bounded, "end_date": "2026-02-12"}
        ).json()["job_id"]
        assert changed_id != dated_id
        assert (
            client.post(
                "/api/imports/chesscom", json={**bounded, "end_date": "2026-02-01"}
            ).status_code
            == 422
        )


@pytest.mark.stockfish
def test_chesscom_through_native_worker_to_review_without_openai(settings, stockfish_path):
    settings.stockfish_path = stockfish_path
    seen = []

    def factory(config):
        return mock_client(
            config, {ROOT + "/archives": {"archives": [NEW]}, NEW: {"games": [game()]}}, seen
        )

    with TestClient(create_app(settings, chesscom_factory=factory)) as client:
        assert not client.get("/api/health").json()["classification_available"]
        job_id = client.post(
            "/api/imports/chesscom", json={"username": "learner", "months": 0}
        ).json()["job_id"]
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            job = next(j for j in client.get("/api/jobs").json() if j["id"] == job_id)
            if job["status"] in {"completed", "failed"}:
                break
            time.sleep(0.1)
        assert job["status"] == "completed", job
        assert job["positions_triaged"] == 2 and job["mistakes_identified"] >= 1
        assert job["chesscom"]["games_imported"] == 1
        exercise = client.get("/api/review/queue").json()[0]["exercise_id"]
        assert client.post(f"/api/review/{exercise}/start").json()["fen"]
        assert len(seen) == 2
