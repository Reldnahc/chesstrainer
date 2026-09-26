import io
import logging
from datetime import datetime, timezone

import chess
import chess.pgn
from sqlalchemy import select

from trainer.chess_core import digest, valid_board
from trainer.models import AnalysisJob, Game, ImportBatch, ImportGame

log = logging.getLogger(__name__)


class PrivatePGNBuilder(chess.pgn.GameBuilder):
    def handle_error(self, error):
        # The default visitor logs private PGN fragments. Keep errors in the import report.
        self.game.errors.append(error)


def parse_games(pgn: str):
    stream = io.StringIO(pgn.lstrip("\ufeff"))
    index = 0
    while True:
        offset = stream.tell()
        try:
            game = chess.pgn.read_game(stream, Visitor=PrivatePGNBuilder)
        except (ValueError, IndexError) as exc:
            index += 1
            yield index, None, f"Invalid PGN: {type(exc).__name__}"
            if stream.tell() == offset:
                break
            continue
        if game is None:
            break
        index += 1
        if game.errors:
            yield index, None, "Illegal or malformed move sequence"
            continue
        try:
            if type(game.board()) is not chess.Board or game.board().chess960:
                raise ValueError("Only standard chess PGNs are supported")
            valid_board(game.board().fen())
            if not any(game.mainline_moves()):
                raise ValueError("Game has no moves")
        except ValueError as exc:
            yield index, None, str(exc)
            continue
        yield index, game, None


def identify_learner(game, usernames: list[str], side: str | None):
    if side in {"white", "black"}:
        return side == "white"
    names = {name.strip().casefold() for name in usernames if name.strip()}
    white = game.headers.get("White", "").strip().casefold() in names
    black = game.headers.get("Black", "").strip().casefold() in names
    if white == black:
        raise ValueError(
            "Learner is ambiguous: supply matching username(s) or explicitly choose a side"
        )
    return white


def fingerprint(game, color):
    # Headers distinguish separately played identical short games. Annotation differences do not.
    headers = {
        key: game.headers.get(key, "")
        for key in ["White", "Black", "Date", "UTCDate", "UTCTime", "Round", "Site", "Result"]
    }
    return digest(
        {
            "headers": headers,
            "root": game.board().fen(),
            "moves": [m.uci() for m in game.mainline_moves()],
            "learner": color,
        }
    )


def played_at(game):
    headers = game.headers
    value = (
        headers.get("UTCDate", headers.get("Date", "")) + " " + headers.get("UTCTime", "00:00:00")
    )
    try:
        return datetime.strptime(value, "%Y.%m.%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def import_games(
    db,
    filename: str,
    pgn: str,
    usernames: list[str],
    side: str | None,
    *,
    batch: ImportBatch | None = None,
    queue_analysis: bool = True,
    commit: bool = True,
    max_new_games: int | None = None,
    retain_original: bool = True,
    completed_times: dict[str, datetime] | None = None,
):
    if batch is None:
        batch = ImportBatch(filename=filename, original_pgn=pgn)
        db.add(batch)
        db.flush()
    elif retain_original:
        batch.original_pgn += ("\n\n" if batch.original_pgn else "") + pgn
    errors, imported, duplicates, processed = [], 0, 0, 0
    linked = set(db.scalars(select(ImportGame.game_id).where(ImportGame.import_id == batch.id)))
    for index, parsed, error in parse_games(pgn):
        if max_new_games is not None and imported >= max_new_games:
            break
        processed += 1
        if error:
            errors.append({"game": index, "error": error})
            log.warning("pgn_game_rejected", extra={"game_index": index})
            continue
        try:
            color = identify_learner(parsed, usernames, side)
        except ValueError as exc:
            errors.append(
                {
                    "game": index,
                    "error": str(exc),
                    "white": parsed.headers.get("White"),
                    "black": parsed.headers.get("Black"),
                }
            )
            continue
        key = fingerprint(parsed, color)
        existing = db.scalar(select(Game).where(Game.fingerprint == key))
        if existing:
            duplicates += 1
            game = existing
        else:
            game = Game(
                fingerprint=key,
                white=parsed.headers.get("White", "?"),
                black=parsed.headers.get("Black", "?"),
                learner_color=color,
                pgn=parsed.accept(
                    chess.pgn.StringExporter(headers=True, variations=False, comments=False)
                ),
                played_on=parsed.headers.get("Date"),
                played_at=played_at(parsed),
            )
            db.add(game)
            db.flush()
            imported += 1
        if game.id not in linked:
            db.add(ImportGame(import_id=batch.id, game_id=game.id, is_new=existing is None))
            linked.add(game.id)
        if completed_times and key in completed_times:
            game.played_at = completed_times[key]
    if not linked and not errors:
        errors.append({"game": 0, "error": "No games found in this PGN"})
    job = None
    if imported and queue_analysis:
        job = AnalysisJob(import_id=batch.id, games_total=imported)
        db.add(job)
    if commit:
        db.commit()
    else:
        db.flush()
    return {
        "import_id": batch.id,
        "imported": imported,
        "duplicates": duplicates,
        "processed": processed,
        "errors": errors,
        "job_id": job.id if job else None,
    }


def decision_board(game: Game, ply: int):
    parsed = chess.pgn.read_game(io.StringIO(game.pgn))
    board = parsed.board()
    for index, move in enumerate(parsed.mainline_moves(), start=1):
        if index == ply:
            return board
        board.push(move)
    raise ValueError("Source decision does not exist")


def learner_decisions(game: Game):
    parsed = chess.pgn.read_game(io.StringIO(game.pgn))
    board = parsed.board()
    for ply, move in enumerate(parsed.mainline_moves(), start=1):
        if board.turn == game.learner_color:
            yield ply, board.copy(), move
        board.push(move)
