"""Read-only Chess.com archive ingestion. PGN interpretation stays in imports.py."""

import json
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Literal

import httpx

from trainer.game_providers.base import (
    ImportCancelled,
    ProviderBatch,
    ProviderError,
    ProviderImportRequest,
    ProviderRateLimited,
)

BASE_URL = "https://api.chess.com/pub/player/"


class ChessComRequest(ProviderImportRequest):
    time_class: Literal["rapid", "blitz", "bullet", "daily", "all"] = "rapid"


ChessComError = ProviderError


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

    def changed(self, usernames, states):
        """Poll each player's current-month archive with its saved ETag.

        Chess.com has no multi-player endpoint, but serial requests are never
        rate limited and an unchanged archive answers 304 with no body.
        Returns {username: (changed, new_state)}.
        """
        month = datetime.now(timezone.utc).strftime("%Y/%m")
        results = {}
        for name in usernames:
            state = states.get(name) or {}
            url = f"https://api.chess.com/pub/player/{name}/games/{month}"
            headers = {}
            if state.get("url") == url and state.get("etag"):
                headers["If-None-Match"] = state["etag"]
            response = self.client.get(url, headers=headers)
            if response.status_code == 429:
                raise ProviderRateLimited("Chess.com is rate limiting requests.")
            if response.status_code == 304:
                results[name] = (False, state)
            elif response.status_code == 200:
                etag = response.headers.get("ETag")
                results[name] = (state.get("etag") != etag or not etag, {"url": url, "etag": etag})
            elif response.status_code in {404, 410}:
                # No games yet this month: nothing new to fetch.
                results[name] = (False, {"url": url, "etag": None})
            else:
                raise ChessComError(f"Chess.com returned HTTP {response.status_code}. Retry later.")
        return results

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

    def batches(self, request, anchor, cancelled, completed=frozenset()):
        archives = self.archives(
            request.username,
            request.months,
            anchor,
            cancelled,
            start_date=request.start_date,
            end_date=request.end_date,
        )
        for url in archives:
            if url in completed:
                continue
            games = self.games(url, cancelled)
            normalized = []
            for game in games:
                if not isinstance(game, dict):
                    normalized.append({})
                    continue
                normalized.append(
                    {
                        "pgn": game.get("pgn"),
                        "variant": game.get("rules"),
                        "speed": game.get("time_class"),
                        "completed_at": game.get("end_time"),
                        **{
                            color: game.get(color, {}).get("username", "")
                            if isinstance(game.get(color), dict)
                            else ""
                            for color in ("white", "black")
                        },
                    }
                )
            yield ProviderBatch(url, normalized, len(archives))


def fetch_import(*args, **kwargs):
    # Compatibility for existing tools; all providers use the same pipeline.
    from trainer.game_providers.ingest import fetch_import as run

    return run(*args, **kwargs)
