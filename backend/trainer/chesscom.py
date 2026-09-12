"""Read-only Chess.com archive ingestion. PGN interpretation stays in imports.py."""

import json
import math
import re
import time
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Literal

import httpx
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select

from trainer.imports import import_games
from trainer.models import AnalysisJob, ChessComArchive, ChessComImport, ImportBatch, ImportGame

BASE_URL = "https://api.chess.com/pub/player/"


class ChessComRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    time_class: Literal["rapid", "blitz", "bullet", "daily", "all"] = "rapid"
    months: int = Field(default=3, ge=0, le=120)
    max_games: int = Field(default=100, ge=1, le=1000)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("From date must be on or before To date.")
        return self

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class ChessComError(RuntimeError):
    pass


class ImportCancelled(RuntimeError):
    pass


class ChessComClient:
    def __init__(self, settings, *, transport=None):
        self.settings = settings
        self.client = httpx.Client(
            timeout=settings.chesscom_timeout_seconds,
            follow_redirects=False,
            headers={"User-Agent": settings.chesscom_user_agent, "Accept": "application/json"},
            transport=transport,
        )

    def close(self):
        self.client.close()

    @staticmethod
    def check_cancel(cancelled):
        if cancelled():
            raise ImportCancelled()

    def pause(self, seconds, cancelled):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            self.check_cancel(cancelled)
            time.sleep(min(0.1, max(0, until - time.monotonic())))

    def get_json(self, url, cancelled):
        # Do not follow arbitrary archive URLs or redirects supplied by a provider payload.
        if not re.fullmatch(
            r"https://api\.chess\.com/pub/player/[a-z0-9_-]+/games/(archives|[0-9]{4}/(0[1-9]|1[0-2]))",
            url,
        ):
            raise ChessComError("Chess.com returned an unsupported archive URL.")
        for attempt in range(3):
            self.check_cancel(cancelled)
            try:
                with self.client.stream("GET", url) as response:
                    if response.status_code in {429, 500, 502, 503, 504}:
                        if attempt == 2:
                            raise ChessComError(
                                "Chess.com is busy or rate limiting requests. Retry this import later; saved games are retained."
                            )
                        delay = 2**attempt
                        retry_after = response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                delay = max(0, float(retry_after))
                            except ValueError:
                                try:
                                    delay = max(
                                        0,
                                        (
                                            parsedate_to_datetime(retry_after)
                                            - datetime.now(timezone.utc)
                                        ).total_seconds(),
                                    )
                                except (TypeError, ValueError):
                                    pass
                        if delay > 10:
                            raise ChessComError(
                                f"Chess.com asked us to wait {int(delay)} seconds. Retry later; saved games are retained."
                            )
                    elif response.status_code in {404, 410}:
                        raise ChessComError(
                            "Chess.com username or archive was not found. Check the username and retry."
                        )
                    elif response.status_code in {301, 302, 307, 308}:
                        raise ChessComError(
                            "Chess.com redirected this account/archive. Try the player's current username."
                        )
                    elif response.status_code == 403:
                        raise ChessComError(
                            "Chess.com denied this request. Retry later or import a PGN file instead."
                        )
                    elif response.status_code != 200:
                        raise ChessComError(
                            f"Chess.com returned HTTP {response.status_code}. Retry later."
                        )
                    else:
                        content = bytearray()
                        for chunk in response.iter_bytes():
                            self.check_cancel(cancelled)
                            content.extend(chunk)
                            if len(content) > self.settings.chesscom_max_response_bytes:
                                raise ChessComError(
                                    "Chess.com archive exceeds CHESSCOM_MAX_RESPONSE_BYTES. Increase that host setting or use a PGN file."
                                )
                        try:
                            data = json.loads(content)
                        except (ValueError, UnicodeDecodeError) as exc:
                            raise ChessComError(
                                "Chess.com returned an invalid JSON response. Retry later."
                            ) from exc
                        if not isinstance(data, dict):
                            raise ChessComError("Chess.com returned an unexpected response format.")
                        return data
            except httpx.RequestError as exc:
                if attempt == 2:
                    raise ChessComError(
                        "Could not reach Chess.com. Check the host internet connection and retry; saved games are retained."
                    ) from exc
                delay = 2**attempt
            self.pause(delay, cancelled)

    def archives(self, username, months, anchor, cancelled, *, start_date=None, end_date=None):
        data = self.get_json(f"{BASE_URL}{username}/games/archives", cancelled)
        archives = data.get("archives")
        if not isinstance(archives, list):
            raise ChessComError("Chess.com did not return a monthly archive list.")
        pattern = re.compile(
            re.escape(f"{BASE_URL}{username}/games/") + r"([0-9]{4})/(0[1-9]|1[0-2])"
        )
        current = anchor.year * 12 + anchor.month - 1
        # Explicit dates replace the rolling window, including open-ended ranges.
        explicit_dates = start_date is not None or end_date is not None
        lower = start_date.year * 12 + start_date.month - 1 if start_date else None
        upper = min(current, end_date.year * 12 + end_date.month - 1) if end_date else current
        selected = []
        for url in archives:
            match = pattern.fullmatch(url) if isinstance(url, str) else None
            if not match:
                raise ChessComError("Chess.com returned an unexpected player/archive URL.")
            index = int(match[1]) * 12 + int(match[2]) - 1
            in_window = (
                (lower is None or index >= lower)
                if explicit_dates
                else (months == 0 or index >= current - months + 1)
            )
            if index <= upper and in_window:
                selected.append(url)
        return sorted(set(selected), reverse=True)

    def games(self, url, cancelled):
        games = self.get_json(url, cancelled).get("games")
        if not isinstance(games, list):
            raise ChessComError("Chess.com did not return games for this archive.")
        return games


def fetch_import(job_id, sessions, settings, client, cancelled, import_lock):
    with sessions() as db:
        request = db.get(ChessComImport, job_id)
        job = db.get(AnalysisJob, job_id)
        if request.fetch_completed:
            return
        username, months, limit, time_class = (
            request.username,
            request.months,
            request.max_games,
            request.time_class,
        )
        anchor = job.created_at
        start_date, end_date = request.start_date, request.end_date
        if job.import_id is None:
            batch = ImportBatch(filename=f"Chess.com/{username}", original_pgn="")
            db.add(batch)
            db.flush()
            job.import_id = batch.id
            db.commit()
    archives = client.archives(
        username, months, anchor, cancelled, start_date=start_date, end_date=end_date
    )
    with sessions() as db:
        db.get(ChessComImport, job_id).archives_total = len(archives)
        db.commit()
    for url in archives:
        client.check_cancel(cancelled)
        with sessions() as db:
            request = db.get(ChessComImport, job_id)
            if request.games_imported >= limit:
                break
            if db.get(ChessComArchive, (job_id, url)):
                continue
            remaining = limit - request.games_imported
        games = client.games(url, cancelled)
        selected, filtered, rejected, errors = [], 0, 0, []

        # Monthly API order is oldest first; do not depend on it being perfectly sorted.
        def end_time(game):
            value = game.get("end_time", 0) if isinstance(game, dict) else 0
            return value if isinstance(value, (int, float)) and math.isfinite(value) else 0

        for game in sorted(games, key=end_time, reverse=True):
            if not isinstance(game, dict):
                rejected += 1
                continue
            if game.get("rules") != "chess" or (
                time_class != "all" and game.get("time_class") != time_class
            ):
                filtered += 1
                continue
            players = [
                game.get(color, {}).get("username", "") if isinstance(game.get(color), dict) else ""
                for color in ("white", "black")
            ]
            matches = [isinstance(name, str) and name.casefold() == username for name in players]
            try:
                completed_on = datetime.fromtimestamp(end_time(game), timezone.utc).date()
            except (ValueError, OverflowError, OSError):
                completed_on = None
            if (
                sum(matches) != 1
                or not isinstance(game.get("pgn"), str)
                or not game["pgn"].strip()
                or end_time(game) <= 0
                or completed_on is None
            ):
                rejected += 1
                errors.append(
                    {
                        "archive": url,
                        "error": "Skipped game with missing PGN, completion time, or ambiguous learner metadata.",
                    }
                )
                continue
            if (start_date and completed_on < start_date) or (end_date and completed_on > end_date):
                filtered += 1
                continue
            selected.append(game["pgn"])
        client.check_cancel(cancelled)
        # Import and archive checkpoint commit together; restart cannot double-count a month.
        with import_lock, sessions() as db:
            request = db.get(ChessComImport, job_id)
            job = db.get(AnalysisJob, job_id)
            processed = 0
            if selected:
                result = import_games(
                    db,
                    f"Chess.com/{username}",
                    "\n\n".join(selected),
                    [username],
                    None,
                    batch=db.get(ImportBatch, job.import_id),
                    queue_analysis=False,
                    commit=False,
                    max_new_games=remaining,
                )
                processed = result["processed"]
                request.games_imported += result["imported"]
                request.duplicates += result["duplicates"]
                rejected += len(result["errors"])
                errors.extend({"archive": url, **error} for error in result["errors"])
            request.filtered += filtered
            request.rejected += rejected
            request.errors = (request.errors + errors)[:50]
            request.games_fetched += processed
            request.archives_processed += 1
            job.games_total = len(
                db.scalars(
                    select(ImportGame.game_id).where(
                        ImportGame.import_id == job.import_id, ImportGame.is_new.is_(True)
                    )
                ).all()
            )
            db.add(ChessComArchive(job_id=job_id, url=url, games_selected=processed))
            db.commit()
    client.check_cancel(cancelled)
    with sessions() as db:
        db.get(ChessComImport, job_id).fetch_completed = True
        db.commit()
