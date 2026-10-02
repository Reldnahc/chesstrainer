"""The pack verifier's verdicts: solution strength, uniqueness, mates and payoff."""

import csv
import hashlib
import io
import json

import chess
import chess.engine
import pytest

from scripts.verify_puzzle_pack import MATE_SCORE, Verifier, describe, read_pack, record

HEADER = ["PuzzleId", "FEN", "Moves", "Rating", "Themes"]
# Black's king steps to e7 (setup); Nd5+ forks king and rook, then Nxb6 wins it.
FEN = "4k3/8/1r6/8/8/2N5/7P/4K3 b - - 0 1"
ROW = {
    "PuzzleId": "fork",
    "FEN": FEN,
    "Moves": "e8e7 c3d5 e7d7 d5b6",
    "Rating": "900",
    "Themes": "fork",
}


def mate_in(n):
    return MATE_SCORE - n


def after(fen, *moves):
    board = chess.Board(fen)
    for uci in moves:
        board.push_uci(uci)
    return board.fen()


class ScriptedVerifier(Verifier):
    """Answers each (fen, root_moves) question from a table instead of an engine."""

    def __init__(self, answers, **changes):
        thresholds = {"tolerance": 50, "margin": 100, "payoff": 150} | changes
        super().__init__("unused", depth=1, threads=1, hash_mb=16, **thresholds)
        self.answers = answers

    def analyse(self, board, *, multipv=1, root_moves=None):
        key = (board.fen(), tuple(move.uci() for move in root_moves or ()))
        infos = []
        for uci, cp in self.answers[key]:
            if abs(cp) >= MATE_SCORE - 1000:
                score = chess.engine.Mate(MATE_SCORE - cp if cp > 0 else -(MATE_SCORE + cp))
            else:
                score = chess.engine.Cp(cp)
            infos.append(
                {
                    "pv": [chess.Move.from_uci(uci)],
                    "score": chess.engine.PovScore(score, board.turn),
                }
            )
        return infos


def fork_answers():
    setup, ke7, final = (
        after(FEN, "e8e7"),
        after(FEN, "e8e7", "c3d5", "e7d7"),
        after(FEN, *ROW["Moves"].split()),
    )
    return {
        (setup, ()): [("c3d5", 520), ("c3e4", 40)],
        (setup, ("c3d5",)): [("c3d5", 520)],
        (ke7, ()): [("d5b6", 610), ("d5c3", 90)],
        (ke7, ("d5b6",)): [("d5b6", 610)],
        (final, ()): [("d7c7", -605)],  # opponent to move: -605 for them
    }


def test_pass_requires_best_unique_and_winning():
    result = ScriptedVerifier(fork_answers()).verify(ROW)
    assert result["passed"] and result["failures"] == [] and result["warnings"] == []
    assert [d["san"] for d in result["decisions"]] == ["Nd5+", "Nxb6+"]
    assert result["decisions"][0]["alternative"] == {"move": "c3e4", "san": "Ne4", "score": "+40"}
    assert result["decisions"][1]["ply"] == 2 and result["decisions"][1]["legal_moves"] > 1
    assert result["payoff"] == {"score": 605, "display": "+605", "checkmate": False}


@pytest.mark.parametrize(
    ("question", "answer", "message"),
    [
        ((after(FEN, "e8e7"), ()), [("c3e4", 600), ("c3d5", 520)], "Ne4 scores +600, within 100"),
        (
            (after(FEN, "e8e7"), ()),
            [("c3e4", 600), ("c3b5", 300)],
            "Nd5+ scores +200 but the best move scores +600",
        ),
        ((after(FEN, *ROW["Moves"].split()), ()), [("d7c7", -80)], "final position only +80"),
        ((after(FEN, "e8e7"), ()), [("c3d5", 520), ("c3e4", 450)], "Ne4 scores +450, within 100"),
    ],
)
def test_weak_ambiguous_or_unwinning_lines_fail(question, answer, message):
    answers = fork_answers() | {question: answer, (after(FEN, "e8e7"), ("c3d5",)): [("c3d5", 200)]}
    result = ScriptedVerifier(answers).verify(ROW)
    assert not result["passed"]
    assert any(message in failure for failure in result["failures"]), result["failures"]


def test_mates_distinguish_equal_slower_and_solution_mates():
    row = {
        "PuzzleId": "mate",
        "FEN": "6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1",
        "Moves": "g8h8 a1a8",
        "Rating": "650",
        "Themes": "mateIn1",
    }
    fen = after(row["FEN"], "g8h8")

    def verify(best_list):
        return ScriptedVerifier(
            {(fen, ()): best_list, (fen, ("a1a8",)): [("a1a8", mate_in(1))]}
        ).verify(row)

    equal = verify([("a1a8", mate_in(1)), ("a1a7", mate_in(1))])
    assert not equal["passed"] and equal["failures"] == ["ply 0: Ra7 also mates in 1"]
    slower = verify([("a1a8", mate_in(1)), ("a1a7", mate_in(3))])
    assert slower["passed"] and slower["warnings"] == ["ply 0: Ra7 mates more slowly (#3)"]
    assert slower["payoff"] == {"score": MATE_SCORE, "display": "#0", "checkmate": True}
    assert slower["decisions"][0]["solution"] == "#1" and slower["decisions"][0]["best"] == "#1"
    # A mating solution is not "weaker" than a faster mate, but that faster mate is an ambiguity.
    faster = ScriptedVerifier(
        {
            (fen, ()): [("a1a7", mate_in(1)), ("a1a8", mate_in(2))],
            (fen, ("a1a8",)): [("a1a8", mate_in(2))],
        }
    ).verify(row)
    assert faster["failures"] == ["ply 0: Ra7 also mates in 1"]
    assert (
        describe(mate_in(2)) == "#2" and describe(-mate_in(2)) == "#-2" and describe(-15) == "-15"
    )


def test_forced_single_move_is_a_warning_and_a_losing_end_fails():
    # After ...Re1+, White's only legal move is Ng1; the line then ends badly for White.
    row = {
        "PuzzleId": "forced",
        "FEN": "k7/8/8/4r3/8/7N/6PP/7K b - - 0 1",
        "Moves": "e5e1 h3g1",
        "Rating": "500",
        "Themes": "x",
    }
    setup, final = after(row["FEN"], "e5e1"), after(row["FEN"], "e5e1", "h3g1")
    assert len(list(chess.Board(setup).legal_moves)) == 1
    answers = {
        (setup, ()): [("h3g1", -mate_in(5))],
        (setup, ("h3g1",)): [("h3g1", -mate_in(5))],
        (final, ()): [("e1g1", mate_in(4))],
    }
    result = ScriptedVerifier(answers).verify(row)
    assert result["warnings"] == ["ply 0: only one legal move"]
    assert not result["passed"] and result["failures"] == ["final position only #-4 for the solver"]
    assert result["decisions"][0]["alternative"] is None


def test_read_pack_refuses_a_changed_csv(tmp_path):
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=HEADER, lineterminator="\n")
    writer.writeheader()
    writer.writerow(ROW)
    data = buffer.getvalue().encode()
    (tmp_path / "puzzles.csv").write_bytes(data)
    manifest = {
        "id": "t",
        "version": "1",
        "file": "puzzles.csv",
        "sha256": hashlib.sha256(data).hexdigest(),
        "count": 1,
    }
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    loaded, rows = read_pack(tmp_path)
    assert loaded["id"] == "t" and [row["PuzzleId"] for row in rows] == ["fork"]
    (tmp_path / "puzzles.csv").write_bytes(data + b"x,8/8/8/8/8/8/8/K6k w - - 0 1,a1a2 h1h2,1,\n")
    with pytest.raises(SystemExit, match="hash"):
        read_pack(tmp_path)


@pytest.mark.stockfish
def test_native_stockfish_passes_the_fork_and_rejects_a_quiet_move(stockfish_path):
    checker = Verifier(
        stockfish_path, depth=12, threads=1, hash_mb=16, tolerance=50, margin=100, payoff=150
    )
    try:
        good = checker.verify(ROW)
        assert good["passed"], good
        assert good["decisions"][0]["best"] == good["decisions"][0]["solution"]
        quiet = checker.verify(ROW | {"PuzzleId": "quiet", "Moves": "e8e7 e1d2"})
        assert not quiet["passed"] and "Kd2 scores" in quiet["failures"][0]
    finally:
        checker.close()


def test_record_writes_evidence_and_prune_repins_the_csv(tmp_path):
    rows = [ROW, ROW | {"PuzzleId": "weak"}]
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=HEADER, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    data = buffer.getvalue().encode()
    (tmp_path / "puzzles.csv").write_bytes(data)
    original = hashlib.sha256(data).hexdigest()
    manifest = {"id": "t", "version": "1", "file": "puzzles.csv", "sha256": original, "count": 2}
    (tmp_path / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    results = [
        {"puzzle_id": "fork", "passed": True, "warnings": [], "failures": []},
        {"puzzle_id": "weak", "passed": False, "warnings": [], "failures": ["x"]},
    ]
    summary = {
        "verifier": "solution-uniqueness-v1",
        "engine": {"id": "Stockfish 18", "depth": 18},
        "thresholds": {"tolerance_cp": 50, "margin_cp": 100, "payoff_cp": 150},
        "verified": 2,
        "passed": 1,
        "passed_with_warnings": 0,
    }
    with pytest.raises(SystemExit, match="complete"):
        record(tmp_path, dict(manifest), summary | {"verified": 1}, results, prune=False)
    entry = record(tmp_path, dict(manifest), summary, results, prune=False)
    saved = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert saved["count"] == 2 and saved["sha256"] == original
    assert saved["verification"]["failed"] == ["weak"] and entry["removed"] == []
    assert (
        saved["verification"]["engine"] == "Stockfish 18" and saved["verification"]["passed"] == 1
    )
    entry = record(tmp_path, dict(manifest), summary, results, prune=True)
    saved = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    _, kept = read_pack(tmp_path)
    assert [row["PuzzleId"] for row in kept] == ["fork"] and saved["count"] == 1
    assert saved["sha256"] != original and saved["verification"]["removed"] == ["weak"]
    assert saved["verification"]["verified_sha256"] == original
