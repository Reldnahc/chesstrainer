"""Server settings administrators change in the app, stored in ``site_settings``.

Settings the server needs before it can open the database, or that guard who can
reach it, stay environment variables (``ENV_ONLY``). Every other setting lives in
the database: on each start, a value set in the environment fills in a setting the
table does not have yet, after which the table wins. Changes apply on restart.
"""

import functools
import json
import logging
import types
import typing

import annotated_types
from pydantic import ValidationError, create_model
from sqlalchemy import text

from trainer.config import Settings
from trainer.db import database, migrate

log = logging.getLogger(__name__)

ENV_ONLY = frozenset(
    {
        "server_host",
        "server_port",
        "database_path",
        "courses_path",
        "accounts_enabled",
        "session_secure",
        "public_origin",
        "lan_access_token",
        "allowed_hosts",
        "stockfish_path",
        "human_model_path",
        # The container entrypoint reads it to fetch CUDA PyTorch before Python starts.
        "human_model_device",
        "puzzle_pack_path",
        "chesscom_user_agent",
    }
)

# Group, then (setting, label, help) in the order Settings → Advanced shows them.
GROUPS = (
    (
        "Engine",
        (
            (
                "engine_slots",
                "Shared engine slots",
                "Accounts: engines and analysis jobs running at once across every account.",
            ),
            ("stockfish_threads", "Threads per engine", "Search threads each engine uses."),
            (
                "stockfish_hash_mb",
                "Hash per engine (MB)",
                "Memory each engine uses for its search.",
            ),
            ("stockfish_workers", "Local engine workers", "Local mode: separate analysis engines."),
        ),
    ),
    (
        "Game review",
        (
            ("triage_depth", "First pass depth", "Search depth for every move of a game."),
            ("triage_time", "First pass time (s)", "Time limit per move in the first pass."),
            ("triage_nodes", "First pass nodes", "Optional node limit; blank uses depth and time."),
            ("deep_depth", "Deep pass depth", "Search depth for moves that need a closer look."),
            ("deep_time", "Deep pass time (s)", "Time limit per move in the deep pass."),
            ("deep_nodes", "Deep pass nodes", "Optional node limit; blank uses depth and time."),
            ("multipv", "Candidate moves", "Engine lines compared at each position."),
            (
                "review_refinement_positions",
                "Refined positions per game",
                "Critical positions checked again more deeply; 0 turns refinement off.",
            ),
            ("review_refinement_queries", "Refinement checks", "Searches per refined position."),
            ("review_refinement_depth", "Refinement depth", "Search depth for refinement."),
            ("review_refinement_time", "Refinement time (s)", "Time limit per refinement search."),
            ("review_refinement_multipv", "Refinement candidates", "Engine lines per refinement."),
        ),
    ),
    (
        "Maia",
        (
            ("human_model_enabled", "Use Maia", "Predict which moves people at each rating play."),
            ("human_model_threads", "Maia threads", "CPU threads for Maia predictions."),
            ("human_model_workers", "Maia workers", "Predictions running at once."),
            ("human_model_timeout", "Maia timeout (s)", "Longest wait for one prediction."),
        ),
    ),
    (
        "Training patterns",
        (
            ("classification_workers", "Workers", "Positions classified at once."),
            ("classification_max_plies", "Line length", "Moves examined after a mistake."),
            (
                "classification_extension_plies",
                "Extension length",
                "Extra moves examined when a line is still unclear.",
            ),
            (
                "classification_tactic_plies",
                "Tactic length",
                "Longest tactic recognized, in moves.",
            ),
            (
                "classification_min_loss_cp",
                "Smallest mistake (cp)",
                "Evaluation loss before a move gets a training label.",
            ),
            (
                "classification_min_material",
                "Smallest material swing",
                "Pawns of material a tactic must win.",
            ),
            (
                "classification_probe_positions",
                "Investigated positions",
                "Unclear positions investigated per run.",
            ),
            (
                "classification_probe_depth",
                "Investigation depth",
                "Search depth per investigation.",
            ),
            (
                "classification_probe_time",
                "Investigation time (s)",
                "Time per investigation search.",
            ),
            ("classification_probe_queries", "Investigation checks", "Searches per position."),
        ),
    ),
    (
        "Training",
        (
            ("target_rating", "Target rating", "Rating the training aims at."),
            ("acceptance_mode", "Accepted answers", "Which moves count as correct in practice."),
            ("tolerance_cp", "Engine tolerance (cp)", "Loss accepted in engine-tolerance mode."),
            (
                "practical_tolerance_cp",
                "Practical tolerance (cp)",
                "Loss accepted in practical mode.",
            ),
            ("mistake_threshold_cp", "Mistake threshold (cp)", "Loss that counts as a mistake."),
            ("slow_answer_seconds", "Slow answer (s)", "Answers slower than this count as unsure."),
            ("retire_after_days", "Retire after (days)", "Well-known positions leave practice."),
            ("desired_retention", "Desired retention", "Share of practice you should remember."),
            (
                "min_independent_games",
                "Games for a weakness",
                "Separate games needed before a pattern counts as a weakness.",
            ),
        ),
    ),
    (
        "Game sync",
        (
            (
                "sync_interval_seconds",
                "Check every (s)",
                "Time between checks for new games; 0 turns automatic sync off.",
            ),
            ("sync_games", "Games per sync", "Newest games read when a provider reports a change."),
            ("sync_lichess_batch", "Lichess batch", "Lichess players per change check."),
            (
                "sync_away_days",
                "Pause after (days)",
                "Days without a visit before an account stops being polled.",
            ),
        ),
    ),
    (
        "Puzzles",
        (
            ("puzzle_starter_pack", "Starter pack", "Offer the bundled puzzle pack."),
            ("puzzle_generation", "Puzzles from games", "Find puzzles in your own games."),
            ("puzzle_generation_depth", "Puzzle depth", "Search depth used to verify puzzles."),
            ("puzzle_generation_time", "Puzzle time (s)", "Time per puzzle verification search."),
            ("puzzle_generation_max_plies", "Longest puzzle", "Moves in the longest puzzle."),
            ("puzzle_generation_games", "Games searched", "Recent games searched for puzzles."),
        ),
    ),
    (
        "Imports and providers",
        (
            ("max_import_bytes", "Largest PGN upload (bytes)", "Size limit for one PGN import."),
            ("chesscom_timeout_seconds", "Chess.com timeout (s)", "Longest wait for Chess.com."),
            (
                "chesscom_max_response_bytes",
                "Chess.com response limit (bytes)",
                "Largest Chess.com response read.",
            ),
            ("provider_timeout_seconds", "Provider timeout (s)", "Longest wait for Lichess."),
            (
                "provider_max_response_bytes",
                "Provider response limit (bytes)",
                "Largest Lichess response read.",
            ),
            ("provider_max_scan_games", "Games scanned", "Most games read during a manual import."),
        ),
    ),
)

MANAGED = tuple(entry[0] for _, entries in GROUPS for entry in entries)


@functools.cache
def _model(name):
    # Reuses the field's own type and limits, exactly as Settings validates them.
    return create_model(
        f"Setting_{name}",
        value=(Settings.model_fields[name].annotation, Settings.model_fields[name]),
    )


def _validate(name, value):
    return _model(name).model_validate({"value": value}).value


def stored(sql_engine):
    """Saved values that are still valid; an invalid one falls back with a warning."""
    with sql_engine.connect() as connection:
        rows = connection.execute(text("SELECT key, value FROM site_settings")).all()
    values = {}
    for key, raw in rows:
        if key not in MANAGED:
            continue
        try:
            values[key] = _validate(key, json.loads(raw))
        except (ValueError, ValidationError):
            log.warning("Ignoring invalid saved server setting %s", key)
    return values


def save(sql_engine, values):
    """Validate every value first, then store them all; raises ValueError naming the setting."""
    clean = {}
    for key, value in values.items():
        if key not in MANAGED:
            raise ValueError(f"{key} is not a server setting")
        try:
            clean[key] = _validate(key, value)
        except ValidationError as exc:
            message = exc.errors()[0]["msg"]
            raise ValueError(f"{label(key)}: {message}") from exc
    with sql_engine.begin() as connection:
        for key, value in clean.items():
            connection.execute(
                text(
                    "INSERT INTO site_settings(key, value) VALUES(:key, :value) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
                ),
                {"key": key, "value": json.dumps(value)},
            )


def load(settings):
    """Apply saved server settings to ``settings``, first saving any set in the environment."""
    sql_engine, _ = database(settings.database_path)
    try:
        migrate(sql_engine)
        saved = stored(sql_engine)
        seeds = {
            name: getattr(settings, name)
            for name in settings.model_fields_set & set(MANAGED)
            if name not in saved
        }
        if seeds:
            save(sql_engine, seeds)
            saved |= seeds
    finally:
        sql_engine.dispose()
    return settings.model_copy(update=saved)


def label(name):
    for _, entries in GROUPS:
        for key, title, _ in entries:
            if key == name:
                return title
    return name


def describe(name, value, running):
    """One setting for the administrator's form: type, limits, default and values."""
    field = Settings.model_fields[name]
    annotation = field.annotation
    nullable = isinstance(annotation, types.UnionType) and type(None) in annotation.__args__
    if nullable:
        annotation = next(arg for arg in annotation.__args__ if arg is not type(None))
    choices = (
        list(typing.get_args(annotation))
        if typing.get_origin(annotation) is typing.Literal
        else None
    )
    kind = "choice" if choices else {bool: "boolean", int: "integer", float: "number"}[annotation]
    limits = {}
    for constraint in field.metadata:
        if isinstance(constraint, annotated_types.Ge):
            limits["minimum"] = constraint.ge
        elif isinstance(constraint, annotated_types.Gt):
            limits["minimum"] = constraint.gt
        elif isinstance(constraint, annotated_types.Le):
            limits["maximum"] = constraint.le
    return {
        "key": name,
        "label": label(name),
        "kind": kind,
        "nullable": nullable,
        "choices": choices,
        "default": field.default,
        "value": value,
        "running": running,
        **limits,
    }


def listing(sql_engine, running_settings):
    saved = stored(sql_engine)
    groups = []
    for title, entries in GROUPS:
        items = []
        for key, _, help_text in entries:
            running = getattr(running_settings, key)
            items.append(describe(key, saved.get(key, running), running) | {"help": help_text})
        groups.append({"title": title, "settings": items})
    return groups
