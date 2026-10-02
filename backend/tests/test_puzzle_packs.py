"""Hash-pinned local packs, the bundled starter pack and preference-aware selection."""

import hashlib
import json
import random
from importlib.resources import files

import chess
import pytest
from fastapi.testclient import TestClient
from trainer.api import create_app
from trainer.contracts.puzzles import PuzzleQuery
from trainer.puzzles import packs
from trainer.puzzles.providers import PuzzleProviders
from trainer.puzzles.sessions import library, next_puzzle

HEADER = "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags\n"
# Lichess layout: the FEN precedes the opponent's setup move; the solver then moves.
ROWS = {
    "fork1": ("8/4k3/1r6/8/8/8/2N5/4K3 b - - 0 1", "e7d7 c2b4 d7e7 b4c6", 900, "fork short"),
    "fork2": ("8/4k3/1r6/8/8/8/2N5/4K3 b - - 0 1", "e7e8 c2d4 e8e7 d4c6", 1300, "fork long"),
    "mate1": ("6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1", "g8h8 a1a8", 650, "mateIn1 mate short"),
    "black1": ("4k3/8/8/8/8/8/r7/4K2R b K - 0 1", "e8e7 h1h8 a2a3 h8h7", 1800, "backRankMate"),
}


def rows_csv(keys=ROWS, *, broken=None):
    lines = [HEADER]
    for key in keys:
        fen, moves, rating, themes = ROWS[key]
        if broken == key:
            moves = moves.replace("c2", "c3")
        lines.append(f"{key},{fen},{moves},{rating},70,95,1200,{themes},https://lichess.org/x,\n")
    return "".join(lines).encode()


def write_pack(directory, data, *, count=None, sha256=None, **changes):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "puzzles.csv").write_bytes(data)
    manifest = {
        "format": "lichess-csv-v1",
        "id": "local-test",
        "name": "Local test pack",
        "version": "t1",
        "license": "CC0-1.0",
        "attribution": "Test pack",
        "url": "https://example.test/pack",
        "puzzle_url": "https://example.test/p/{id}",
        "file": "puzzles.csv",
        "sha256": sha256 or hashlib.sha256(data).hexdigest(),
        "count": len(ROWS) if count is None else count,
    } | changes
    (directory / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return directory


def test_rows_become_learner_to_move_definitions_with_pinned_attribution():
    fen, moves, _, _ = ROWS["black1"]
    definition = packs.definition_from_row(
        {"PuzzleId": "black1", "FEN": fen, "Moves": moves, "Rating": "1800", "Themes": "a b a"},
        version="v9",
        attribution="Pack",
        puzzle_url="https://example.test/p/{id}",
    )
    board = chess.Board(fen)
    board.push_uci("e8e7")
    assert definition.initial_fen == board.fen() and definition.orientation == "white"
    assert definition.solution == ("h1h8", "a2a3", "h8h7") and definition.themes == ("a", "b")
    assert definition.rating == 1800 and definition.version == "v9"
    assert definition.provenance.attribution == "Pack · puzzle black1"
    assert definition.provenance.url == "https://example.test/p/black1"
    white = packs.definition_from_row(
        {"PuzzleId": "w", "FEN": ROWS["fork1"][0], "Moves": ROWS["fork1"][1]},
        version="v1",
        attribution="Pack",
    )
    assert white.orientation == "white" and white.rating is None and white.provenance.url is None


@pytest.mark.parametrize(
    "fields",
    [
        {"PuzzleId": "", "FEN": ROWS["fork1"][0], "Moves": ROWS["fork1"][1]},
        {"PuzzleId": "x", "FEN": ROWS["fork1"][0], "Moves": "e7d7"},
        {"PuzzleId": "x", "FEN": "not a fen", "Moves": ROWS["fork1"][1]},
        {"PuzzleId": "x", "FEN": ROWS["fork1"][0], "Moves": "e7e3 c2b4"},
        {"PuzzleId": "x", "FEN": ROWS["fork1"][0], "Moves": "e7d7 c2b4 d7e7"},
    ],
)
def test_malformed_rows_are_rejected_with_the_puzzle_named(fields):
    with pytest.raises(packs.PackError):
        packs.definition_from_row(fields, version="v1", attribution="Pack")


def test_pack_serves_whole_or_not_at_all(tmp_path, sessions):
    good = write_pack(tmp_path / "good", rows_csv())
    manifest, definitions = packs.load_pack(good)
    assert manifest.id == "local-test" and [d.key for d in definitions] == list(ROWS)
    provider = packs.PackProvider(good)
    with sessions() as db:
        assert len(list(PuzzleProviders((provider,)).catalog(db))) == 4
        assert PuzzleProviders((provider,)).find(db, "local-test", "mate1", "t1").key == "mate1"
        assert PuzzleProviders((provider,)).find(db, "local-test", "mate1", "t2") is None
        assert PuzzleProviders((provider,)).find(db, "other", "mate1", "t1") is None
    for name, directory in {
        "hash": write_pack(tmp_path / "hash", rows_csv(), sha256="0" * 64),
        "count": write_pack(tmp_path / "count", rows_csv(), count=3),
        "row": write_pack(tmp_path / "row", rows_csv(broken="fork2")),
        "duplicate": write_pack(tmp_path / "dup", rows_csv(["fork1", "fork1"]), count=2),
        "columns": write_pack(tmp_path / "cols", b"PuzzleId,FEN\nx,y\n", count=1),
    }.items():
        with pytest.raises(packs.PackError, match="local-test"):
            packs.PackProvider(directory).load()
    with pytest.raises(packs.PackError, match="manifest"):
        packs.PackProvider(tmp_path / "missing")
    with pytest.raises(packs.PackError, match="manifest"):
        packs.read_manifest(write_pack(tmp_path / "format", rows_csv(), format="other"))


def test_bundled_starter_pack_is_pinned_valid_and_served_by_default(settings):
    directory = files(packs.STARTER_PACKAGE)
    manifest = packs.read_manifest(directory)
    assert manifest.license == "CC0-1.0" and manifest.id == "lichess-starter"
    assert "CC0" in directory.joinpath("COPYING.txt").read_text(encoding="utf-8")
    recorded = json.loads(directory.joinpath("manifest.json").read_text(encoding="utf-8"))
    assert recorded["build"]["input_sha256"] and recorded["build"]["bands"]
    verification = manifest.verification
    assert verification and verification["engine"].startswith("Stockfish")
    assert verification["verified"] == verification["passed"] + len(verification["removed"])
    definitions = packs.starter_pack().load()
    assert len(definitions) == manifest.count == verification["passed"] >= 500
    assert not {d.key for d in definitions} & set(verification["removed"])
    assert all(d.rating is not None and d.provenance.url for d in definitions)
    assert len({d.key for d in definitions}) == len(definitions)
    bands = [
        sum(1 for d in definitions if low <= d.rating < high)
        for low, high in ((400, 1000), (1000, 1400), (1400, 1800), (1800, 2400))
    ]
    assert bands[0] > bands[1] > bands[2] > bands[3] > 0
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        catalogue = client.get("/api/puzzles").json()
        assert catalogue["available"] == manifest.count
        [source] = catalogue["sources"]
        assert source["attribution"] == manifest.attribution and source["url"] == manifest.url
        assert source["rating_min"] < 1000 < 1800 < source["rating_max"]
        assert {theme["id"] for theme in catalogue["themes"]} >= {"fork", "mateIn1"}
        assert not {theme["id"] for theme in catalogue["themes"]} & {"short", "long", "oneMove"}
        key = client.get("/api/puzzles/next", params={"max_rating": 800, "theme": "mateIn1"}).json()
        started = client.post("/api/puzzle-sessions", json=key | {"request_id": "s"}).json()
        definition = next(d for d in definitions if d.key == key["key"])
        assert definition.rating <= 800 and "mateIn1" in definition.themes
        assert started["fen"] == definition.initial_fen and started["completion"] is None
        assert "mateIn1" not in str(started)


def test_installed_pack_setting_is_verified_at_startup(settings, tmp_path):
    settings.puzzle_pack_path = write_pack(tmp_path / "installed", rows_csv())
    with TestClient(create_app(settings, workers=False, start_engine=False)) as client:
        sources = client.get("/api/puzzles").json()["sources"]
        assert [source["id"] for source in sources] == ["lichess-starter", "local-test"]
    settings.puzzle_pack_path = write_pack(tmp_path / "bad", rows_csv(), sha256="1" * 64)
    with pytest.raises(packs.PackError, match="pinned hash"):
        create_app(settings, workers=False, start_engine=False)


def seeded_app(settings, tmp_path):
    settings.puzzle_starter_pack = False
    settings.puzzle_pack_path = write_pack(tmp_path / "pack", rows_csv())
    return create_app(settings, workers=False, start_engine=False)


def start(client, key, request_id):
    response = client.post("/api/puzzle-sessions", json=key | {"request_id": request_id})
    assert response.status_code == 200, response.text
    return response.json()


def finish(client, state, *, reveal=False, wrong_first=False):
    definition_moves = state["history"]
    assert definition_moves == []
    if reveal:
        return client.post(
            f"/api/puzzle-sessions/{state['id']}/reveal",
            json={"request_id": "reveal", "revision": state["revision"]},
        ).json()
    moves = next(
        ROWS[key][1].split()[1:] for key in ROWS if state["fen"].startswith(fen_after(key))
    )
    if wrong_first:
        legal = next(
            m for m in state["legal_moves"] if m["from_square"] + m["to_square"] != moves[0][:4]
        )
        state = client.post(
            f"/api/puzzle-sessions/{state['id']}/move",
            json={
                "request_id": "wrong",
                "revision": state["revision"],
                "uci": legal["from_square"] + legal["to_square"] + (legal["promotion"] or ""),
            },
        ).json()
        assert state["failed"]
    for index, uci in enumerate(moves[::2]):
        state = client.post(
            f"/api/puzzle-sessions/{state['id']}/move",
            json={"request_id": f"m{index}", "revision": state["revision"], "uci": uci},
        ).json()
    assert state["status"] == "solved"
    return state


def fen_after(key):
    board = chess.Board(ROWS[key][0])
    board.push_uci(ROWS[key][1].split()[0])
    return board.fen()


def test_selection_prefers_unseen_then_filters_then_avoids_recent_repeats(settings, tmp_path):
    app = seeded_app(settings, tmp_path)
    with TestClient(app) as client:
        assert client.get("/api/puzzles/next", params={"theme": "none"}).json() is None
        assert client.get("/api/puzzles/next", params={"min_rating": 3000}).json() is None
        assert client.get("/api/puzzles/next", params={"source": "games"}).json() is None
        assert client.get("/api/puzzles/next", params={"mode": "retry"}).json() is None
        assert client.get("/api/puzzles/next", params={"theme": "bad theme"}).status_code == 422
        easy = client.get("/api/puzzles/next", params={"max_rating": 700}).json()
        assert easy["key"] == "mate1"
        forks = {
            client.get("/api/puzzles/next", params={"theme": "fork", "min_rating": 1000}).json()[
                "key"
            ]
            for _ in range(10)
        }
        assert forks == {"fork2"}
        started = start(client, easy, "one")
        # An unfinished puzzle counts as seen, so new mode moves on to the others.
        seen = {client.get("/api/puzzles/next").json()["key"] for _ in range(30)}
        assert seen == {"fork1", "fork2", "black1"}
        for key in ("fork1", "fork2", "black1"):
            definition = {"provider_id": "local-test", "key": key, "version": "t1"}
            finish(client, start(client, definition, key))
        finish(client, started)
        # Everything is seen: the recent window excludes all four, so any may return,
        # but with a smaller window the most recent solves are skipped first.
        with app.state.sessions() as db:
            providers = app.state.puzzle_providers
            choices = {next_puzzle(db, providers, rng=random.Random(1)).key for _ in range(5)}
            assert choices <= set(ROWS)
            from trainer.puzzles import sessions as module

            original = module.RECENT_REPEAT_WINDOW
            module.RECENT_REPEAT_WINDOW = 3
            try:
                repeated = {next_puzzle(db, providers, rng=random.Random(i)).key for i in range(20)}
            finally:
                module.RECENT_REPEAT_WINDOW = original
            assert repeated == {"mate1"}  # the least recently started puzzle
            assert client.get("/api/puzzles").json()["retry_available"] == 0


def test_retry_mode_offers_revealed_and_failed_puzzles_until_solved_cleanly(settings, tmp_path):
    app = seeded_app(settings, tmp_path)
    with TestClient(app) as client:
        keys = {key: {"provider_id": "local-test", "key": key, "version": "t1"} for key in ROWS}
        finish(client, start(client, keys["mate1"], "a"), reveal=True)
        finish(client, start(client, keys["fork1"], "b"), wrong_first=True)
        finish(client, start(client, keys["fork2"], "c"))
        catalogue = client.get("/api/puzzles").json()
        assert catalogue["retry_available"] == 2
        assert catalogue["stats"] == {
            "solved": 2,
            "clean": 1,
            "failed_then_solved": 1,
            "revealed": 1,
        }
        retries = {
            client.get("/api/puzzles/next", params={"mode": "retry"}).json()["key"]
            for _ in range(30)
        }
        assert retries == {"mate1", "fork1"}
        assert (
            client.get("/api/puzzles/next", params={"mode": "retry", "theme": "fork"}).json()["key"]
            == "fork1"
        )
        # A clean solve removes the puzzle from retry; an in-progress retry does not re-offer it.
        finish(client, start(client, keys["fork1"], "d"))
        start(client, keys["mate1"], "e")
        assert client.get("/api/puzzles/next", params={"mode": "retry"}).json() is None
        assert client.get("/api/puzzles").json()["retry_available"] == 0
        with app.state.sessions() as db:
            assert library(db, app.state.puzzle_providers)["retry_available"] == 0
            assert next_puzzle(db, app.state.puzzle_providers, PuzzleQuery(mode="retry")) is None
