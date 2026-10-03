"""Bounded public Lichess NDJSON export; no credentials or remote evaluations."""

import json
import re
import time
from datetime import datetime, timedelta, timezone

import httpx

from trainer.game_providers.base import (
    ProviderBatch,
    ProviderError,
    ProviderRateLimited,
    check_cancel,
)

GROUP_SIZE = 50


class LichessClient:
    check_cancel = staticmethod(check_cancel)

    def __init__(self, settings, *, transport=None):
        self.settings = settings
        self.client = httpx.Client(
            timeout=settings.provider_timeout_seconds,
            follow_redirects=False,
            transport=transport,
            headers={"Accept": "application/x-ndjson", "User-Agent": "FieldworkChessTrainer/0.1"},
        )

    def close(self):
        self.client.close()

    def changed(self, usernames, states):
        """One request per SYNC_LICHESS_BATCH players (300 by default): compare game counts and total play time.

        Lichess asks for one request at a time; its users endpoint takes many
        ids, so a whole polling round costs a single call for most hosts.
        Returns {username: (changed, new_state)}.
        """
        results = {}
        names = list(usernames)
        batch = self.settings.sync_lichess_batch
        for start in range(0, len(names), batch):
            chunk = names[start : start + batch]
            response = self.client.post(
                "https://lichess.org/api/users",
                content=",".join(chunk),
                headers={"Content-Type": "text/plain", "Accept": "application/json"},
            )
            if response.status_code == 429:
                raise ProviderRateLimited(
                    "Lichess is rate limiting requests. Wait at least a minute."
                )
            if response.status_code != 200:
                raise ProviderError(f"Lichess returned HTTP {response.status_code}. Retry later.")
            found = {
                user.get("id", "").casefold(): signature(user)
                for user in response.json()
                if isinstance(user, dict)
            }
            for name in chunk:
                current = found.get(name.casefold())
                previous = (states.get(name) or {}).get("signature")
                results[name] = (
                    current is not None and current != previous,
                    {"signature": current},
                )
        return results

    def batches(self, request, anchor, cancelled, completed=frozenset()):
        if not re.fullmatch(r"[a-z0-9_-]{1,50}", request.username):
            raise ProviderError("Invalid Lichess username.")
        anchor = anchor.replace(tzinfo=timezone.utc)
        since = request.start_date
        if since is None and request.end_date is None and request.months:
            month = anchor.year * 12 + anchor.month - request.months
            since = datetime(month // 12, month % 12 + 1, 1, tzinfo=timezone.utc).date()
        until = (
            min(
                anchor,
                datetime.combine(
                    request.end_date + timedelta(days=1), datetime.min.time(), timezone.utc
                )
                - timedelta(milliseconds=1),
            )
            if request.end_date
            else anchor
        )
        params = {
            "until": int(until.timestamp() * 1000),
            "pgnInJson": "true",
            "clocks": "true",
            "evals": "false",
            "accuracy": "false",
            "literate": "false",
            "ongoing": "false",
            "finished": "true",
            "sort": "dateDesc",
            "perfType": request.time_class
            if request.time_class != "all"
            else "ultraBullet,bullet,blitz,rapid,classical,correspondence",
        }
        if since:
            params["since"] = int(
                datetime.combine(since, datetime.min.time(), timezone.utc).timestamp() * 1000
            )
        scanned = 0
        deadline = time.monotonic() + 600
        # One NDJSON line is one game. Group records so the importer checkpoints a
        # bounded transaction per group rather than one per game.
        group = []

        def grouped():
            batch = ProviderBatch(
                group[0].key,
                [record for item in group for record in item.games],
                keys=tuple(item.key for item in group),
            )
            group.clear()
            return batch

        try:
            check_cancel(cancelled)
            with self.client.stream(
                "GET", f"https://lichess.org/api/games/user/{request.username}", params=params
            ) as response:
                if response.status_code == 429:
                    raise ProviderRateLimited(
                        "Lichess is rate limiting requests. Wait at least a minute before retrying; saved games are retained."
                    )
                if response.status_code == 404:
                    raise ProviderError(
                        "Lichess username was not found. Check the username and retry."
                    )
                if response.status_code != 200:
                    raise ProviderError(
                        f"Lichess returned HTTP {response.status_code}. Retry later; saved games are retained."
                    )
                pending = bytearray()
                received = 0
                for chunk in response.iter_bytes():
                    check_cancel(cancelled)
                    if time.monotonic() > deadline:
                        raise ProviderError(
                            "Lichess export exceeded ten minutes. Narrow the date range; saved games are retained."
                        )
                    received += len(chunk)
                    if received > self.settings.provider_max_response_bytes:
                        raise ProviderError(
                            "Lichess export reached the host response limit. Narrow the date range; saved games are retained."
                        )
                    pending.extend(chunk)
                    while b"\n" in pending:
                        line, _, rest = pending.partition(b"\n")
                        pending = bytearray(rest)
                        if not line.strip():
                            continue
                        scanned += 1
                        if scanned > self.settings.provider_max_scan_games:
                            raise ProviderError(
                                "Lichess export reached the host scan limit. Narrow the date range; saved games are retained."
                            )
                        record = self.record(line)
                        if record.key not in completed:
                            group.append(record)
                        if len(group) >= GROUP_SIZE:
                            yield grouped()
                    if len(pending) > 1_000_000:
                        raise ProviderError("Lichess returned an oversized game record.")
                if pending.strip():
                    if scanned >= self.settings.provider_max_scan_games:
                        raise ProviderError(
                            "Lichess export reached the host scan limit. Narrow the date range."
                        )
                    record = self.record(pending)
                    if record.key not in completed:
                        group.append(record)
                if group:
                    yield grouped()
        except ProviderError:
            # Save the valid records read so far before reporting the problem.
            if group:
                yield grouped()
            raise
        except httpx.RequestError as exc:
            if group:
                yield grouped()
            raise ProviderError(
                "Could not finish the Lichess export. Check the host connection and retry; saved games are retained."
            ) from exc

    @staticmethod
    def record(line):
        if len(line) > 1_000_000:
            raise ProviderError("Lichess returned an oversized game record.")
        try:
            game = json.loads(line)
            if not isinstance(game, dict) or not re.fullmatch(
                r"[a-zA-Z0-9]{8}", str(game.get("id", ""))
            ):
                raise ValueError()
            players = game.get("players", {})
            names = {
                color: players.get(color, {}).get("user", {}).get("name", "")
                for color in ("white", "black")
            }
            completed = game.get("lastMoveAt", 0)
            if not isinstance(completed, (int, float)) or isinstance(completed, bool):
                completed = 0
            terminal = game.get("status") in {
                "mate",
                "resign",
                "stalemate",
                "timeout",
                "draw",
                "outoftime",
                "cheat",
                "noStart",
                "variantEnd",
            }
            record = {
                "pgn": game.get("pgn"),
                "variant": "chess"
                if terminal and game.get("variant") == "standard"
                else "unsupported",
                "speed": game.get("speed"),
                "completed_at": completed / 1000,
                **names,
            }
            return ProviderBatch(f"https://lichess.org/{game['id']}", [record])
        except (ValueError, TypeError, AttributeError) as exc:
            raise ProviderError(
                "Lichess returned an invalid game record. Retry later; saved games are retained."
            ) from exc


def signature(user):
    """Changes whenever a game finishes: per-speed counts plus total play time."""
    perfs = user.get("perfs") or {}
    counts = {
        name: perf.get("games")
        for name, perf in sorted(perfs.items())
        if isinstance(perf, dict) and "games" in perf
    }
    return {"games": counts, "play_time": (user.get("playTime") or {}).get("total")}
