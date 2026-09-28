"""Shared import/checkpoint pipeline. Providers supply normalized records only."""

import math
from contextlib import closing
from datetime import datetime, timezone

from sqlalchemy import select

from trainer.game_providers import get_provider
from trainer.game_providers.base import GameProviderClient, check_cancel
from trainer.imports import fingerprint, identify_learner, import_games, parse_games
from trainer.models import AnalysisJob, ImportBatch, ImportGame, ProviderCheckpoint, ProviderImport


def fetch_import(job_id, sessions, settings, client: GameProviderClient, cancelled, import_lock):
    with sessions() as db:
        request = db.get(ProviderImport, job_id)
        job = db.get(AnalysisJob, job_id)
        if request.fetch_completed:
            return
        provider = get_provider(request.provider)
        username, limit, time_class = (
            request.username,
            request.max_games,
            request.time_class,
        )
        sync = job.kind == "sync"
        anchor = job.created_at
        start_date, end_date = request.start_date, request.end_date
        if job.import_id is None:
            batch = ImportBatch(filename=f"{provider.name}/{username}", original_pgn="")
            db.add(batch)
            db.flush()
            job.import_id = batch.id
            db.commit()
    with sessions() as db:
        completed = set(
            db.scalars(select(ProviderCheckpoint.url).where(ProviderCheckpoint.job_id == job_id))
        )
    with closing(client.batches(request, anchor, cancelled, completed)) as batches:
        for batch in batches:
            url = batch.key
            check_cancel(cancelled)
            with sessions() as db:
                request = db.get(ProviderImport, job_id)
                used = request.games_fetched if sync else request.games_imported
                if used >= limit:
                    break
                if db.get(ProviderCheckpoint, (job_id, url)):
                    continue
                remaining = limit - used
            games = batch.games
            selected, filtered, rejected, errors = [], 0, 0, []
            completed_times = {}

            # Monthly API order is oldest first; do not depend on it being perfectly sorted.
            def end_time(game):
                value = game.get("completed_at", 0) if isinstance(game, dict) else 0
                return value if isinstance(value, (int, float)) and math.isfinite(value) else 0

            for game in sorted(games, key=end_time, reverse=True):
                if not isinstance(game, dict):
                    rejected += 1
                    continue
                if game.get("variant") != "chess" or (
                    time_class != "all" and game.get("speed") != time_class
                ):
                    filtered += 1
                    continue
                players = [game.get(color, "") for color in ("white", "black")]
                matches = [
                    isinstance(name, str) and name.casefold() == username for name in players
                ]
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
                if (start_date and completed_on < start_date) or (
                    end_date and completed_on > end_date
                ):
                    filtered += 1
                    continue
                selected.append(game["pgn"])
                for _, parsed, error in parse_games(game["pgn"]):
                    if parsed is not None and not error:
                        try:
                            color = identify_learner(parsed, [username], None)
                        except ValueError:
                            continue
                        completed_times[fingerprint(parsed, color)] = datetime.fromtimestamp(
                            end_time(game), timezone.utc
                        )
            check_cancel(cancelled)
            # Import and archive checkpoint commit together; restart cannot double-count a month.
            with import_lock, sessions() as db:
                request = db.get(ProviderImport, job_id)
                job = db.get(AnalysisJob, job_id)
                processed = 0
                if selected:
                    result = import_games(
                        db,
                        f"{provider.name}/{username}",
                        "\n\n".join(selected[:remaining] if sync else selected),
                        [username],
                        None,
                        batch=db.get(ImportBatch, job.import_id),
                        queue_analysis=False,
                        commit=False,
                        max_new_games=remaining,
                        retain_original=not sync,
                        completed_times=completed_times,
                    )
                    processed = result["processed"]
                    request.games_imported += result["imported"]
                    request.duplicates += result["duplicates"]
                    rejected += len(result["errors"])
                    errors.extend({"archive": url, **error} for error in result["errors"])
                request.archives_total = batch.total if batch.total is not None else 0
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
                db.add(ProviderCheckpoint(job_id=job_id, url=url, games_selected=processed))
                db.commit()
                if (request.games_fetched if sync else request.games_imported) >= limit:
                    break
    check_cancel(cancelled)
    with sessions() as db:
        db.get(ProviderImport, job_id).fetch_completed = True
        db.commit()
