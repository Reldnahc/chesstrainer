"""Synthetic CSV fixtures test the harness, not externally measured detector quality."""

import csv
import gzip
import hashlib
from pathlib import Path

import chess
import pytest

from scripts.lichess_benchmark.dataset import DatasetError, PuzzleRow, sample_dataset
from scripts.lichess_benchmark.positions import ReconstructionError, reconstruct
from scripts.lichess_benchmark.themes import BY_THEME, select_mappings

FIXTURE = Path(__file__).parent / "fixtures" / "lichess_synthetic.csv"


def sample(path=FIXTURE, count=100, seed=17, themes=("fork",)):
    return sample_dataset(path, select_mappings(themes), count, seed)


def test_mapping_semantics_and_rejected_names():
    assert BY_THEME["doubleCheck"].relationship == "exact"
    assert BY_THEME["doubleCheck"].witness_kind == "double_check"
    assert BY_THEME["fork"].relationship == "approximate"
    assert BY_THEME["hangingPiece"].skill == "missed_tactical_capture"
    assert not BY_THEME["trappedPiece"].eligible
    assert all(mapping.semantics for mapping in BY_THEME.values())
    with pytest.raises(ValueError, match="Unsupported.*trappedPiece"):
        select_mappings(["trappedPiece"])
    with pytest.raises(ValueError, match="Unknown theme"):
        select_mappings(["double_attack"])
    with pytest.raises(ValueError, match="at least one"):
        select_mappings([])


def test_setup_is_not_a_solver_move_and_full_line_replays():
    row = next(r for r in sample().rows["fork"] if r.puzzle_id == "SYN-FORK")
    line = reconstruct(row)
    assert line.setup_uci == "d7e8" and line.setup_san == "Ke8"
    assert line.solver == chess.WHITE
    assert line.solution_uci == ["b5c7", "e8d7", "c7a8"]
    assert line.solution_san == ["Nc7+", "Kd7", "Nxa8"]
    assert len(line.boards) == 4
    assert line.boards[0].piece_at(chess.E8) == chess.Piece(chess.KING, chess.BLACK)
    assert line.boards[-1].piece_at(chess.A8) == chess.Piece(chess.KNIGHT, chess.WHITE)
    assert [m.uci() for m in line.boards[-1].move_stack] == [
        line.setup_uci,
        *line.solution_uci,
    ]


@pytest.mark.parametrize("black", [False, True])
@pytest.mark.parametrize(
    "fen,moves,target,piece",
    [
        ("8/P3k3/8/8/8/8/8/4K3 b - - 0 1", "e7e8 a7a8n", "a8", chess.KNIGHT),
        ("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1", "d7d5 e5d6", "d6", chess.PAWN),
        ("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1", "a8a7 e1g1", "f1", chess.ROOK),
    ],
)
def test_rule_state_survives_reconstruction(fen, moves, target, piece, black):
    if black:
        fen = chess.Board(fen).mirror().fen()
        moves = " ".join(
            chess.Move(
                chess.square_mirror(m.from_square),
                chess.square_mirror(m.to_square),
                promotion=m.promotion,
            ).uci()
            for m in map(chess.Move.from_uci, moves.split())
        )
        target = chess.square_name(chess.square_mirror(chess.parse_square(target)))
    line = reconstruct(PuzzleRow(2, {"FEN": fen, "Moves": moves, "Themes": "promotion"}))
    assert line.solver == (chess.BLACK if black else chess.WHITE)
    assert line.boards[-1].piece_at(chess.parse_square(target)) == chess.Piece(piece, line.solver)
    if piece == chess.PAWN:
        removed = chess.D4 if black else chess.D5
        assert line.boards[-1].piece_at(removed) is None


def test_sample_reproducible_independent_by_theme_and_bounded(tmp_path):
    path = tmp_path / "many.csv"
    with path.open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(["PuzzleId", "FEN", "Moves", "Themes", "Rating"])
        for index in range(2000):
            writer.writerow([f"S{index}", "invalid", "0000", "fork pin fork", index])
    first = sample(path, 17, 9, ("pin", "fork"))
    second = sample(path, 17, 9, ("fork",))
    changed = sample(path, 17, 10, ("fork",))
    assert first.rows["fork"] == second.rows["fork"]
    assert first.rows["fork"] != changed.rows["fork"]
    assert sum(map(len, first.rows.values())) == 34
    assert first.theme_counts["fork"] == first.theme_counts["pin"] == 2000
    assert first.rows_seen == 2000
    assert first.input_sha256 == hashlib.sha256(path.read_bytes()).hexdigest()
    # Reservoir sampling is not the first N or a low-rating slice. Invalid boards
    # are sampled before validation and must not be replaced with easier records.
    assert max(r.record_number for r in first.rows["fork"]) > 1000
    assert all(r.fields["FEN"] == "invalid" for r in first.rows["fork"])


def test_gzip_and_plain_have_same_sample_but_different_file_identity(tmp_path):
    compressed = tmp_path / "puzzles.csv.gz"
    compressed.write_bytes(gzip.compress(FIXTURE.read_bytes(), mtime=0))
    plain, zipped = sample(), sample(compressed)
    assert plain.rows == zipped.rows
    assert plain.input_sha256 != zipped.input_sha256


def test_zstandard_stream_and_concatenated_frames(tmp_path):
    zstd = pytest.importorskip("zstandard", reason="Optional developer Zstandard support absent")
    data = FIXTURE.read_bytes()
    compressed = tmp_path / "puzzles.csv.zst"
    compressor = zstd.ZstdCompressor()
    split = len(data) // 2
    compressed.write_bytes(compressor.compress(data[:split]) + compressor.compress(data[split:]))
    assert sample(compressed).rows == sample().rows


@pytest.mark.parametrize("columns", ["FEN,Moves\n", "FEN,Moves,Themes,Themes\n", ""])
def test_bad_header_is_actionable(tmp_path, columns):
    path = tmp_path / "invalid.csv"
    path.write_text(columns, encoding="utf-8")
    with pytest.raises(DatasetError, match="header"):
        sample(path)


def test_bad_csv_syntax_aborts_instead_of_reporting_partial_metrics(tmp_path):
    path = tmp_path / "invalid.csv"
    path.write_text('FEN,Moves,Themes\n"unclosed', encoding="utf-8")
    with pytest.raises(DatasetError, match="No complete benchmark"):
        sample(path)


def test_column_errors_keep_known_theme_and_do_not_replenish(tmp_path):
    path = tmp_path / "invalid.csv"
    path.write_text("FEN,Moves,Themes\ninvalid,0000,fork,extra\ninvalid,0000\n", encoding="utf-8")
    result = sample(path)
    assert result.malformed_rows == 2 and result.malformed_without_themes == 1
    assert result.theme_counts["fork"] == 1
    with pytest.raises(ReconstructionError, match="field count"):
        reconstruct(result.rows["fork"][0])


@pytest.mark.parametrize(
    "field,value,reason",
    [
        ("FEN", "not a fen", "invalid_fen"),
        ("Moves", "e2e4", "missing_solution"),
        ("Moves", "0000 e7e5", "illegal_setup"),
        ("Moves", "e2e4 e2e3", "illegal_solution"),
        ("Variant", "antichess", "unsupported_variant"),
        ("Moves", " ".join(["e2e4"] * 258), "solution_too_long"),
    ],
)
def test_incompatible_rows_have_stable_reasons(field, value, reason):
    fields = {"FEN": chess.STARTING_FEN, "Moves": "e2e4 e7e5", "Themes": "fork"}
    fields[field] = value
    with pytest.raises(ReconstructionError) as error:
        reconstruct(PuzzleRow(2, fields))
    assert error.value.reason == reason


def test_missing_ids_and_new_optional_columns_are_supported(tmp_path):
    path = tmp_path / "minimal.csv"
    path.write_text(
        f'FEN,Moves,Themes,FutureColumn\n"{chess.STARTING_FEN}",e2e4 e7e5,fork,new\n',
        encoding="utf-8",
    )
    row = sample(path).rows["fork"][0]
    assert row.puzzle_id is None
    assert row.fields["FutureColumn"] == "new"
    assert reconstruct(row).solver == chess.BLACK


def test_input_validation(tmp_path):
    with pytest.raises(DatasetError, match="not found"):
        sample(tmp_path / "absent.csv")
    with pytest.raises(ValueError, match="positive"):
        sample(count=0)
    other = tmp_path / "puzzles.pgn"
    other.write_text("", encoding="utf-8")
    with pytest.raises(DatasetError, match=".csv"):
        sample(other)


@pytest.mark.parametrize("cut", [1, 4, 15])
def test_truncated_zstandard_frame_is_rejected(tmp_path, cut):
    zstd = pytest.importorskip("zstandard", reason="Optional developer Zstandard support absent")
    compressed = tmp_path / "truncated.csv.zst"
    data = zstd.ZstdCompressor(write_checksum=True).compress(FIXTURE.read_bytes())
    compressed.write_bytes(data[:-cut])
    with pytest.raises(DatasetError, match="Truncated"):
        sample(compressed)


def test_optional_zstandard_dependency_error_is_actionable(tmp_path, monkeypatch):
    import sys

    path = tmp_path / "input.csv.zst"
    path.write_bytes(b"not consumed without the decoder")
    monkeypatch.setitem(sys.modules, "zstandard", None)
    with pytest.raises(DatasetError, match="optional developer dependency"):
        sample(path)


@pytest.mark.parametrize("kind", ["utf8", "truncated_gzip", "invalid_gzip"])
def test_unreadable_streams_do_not_produce_partial_samples(tmp_path, kind):
    if kind == "utf8":
        path = tmp_path / "input.csv"
        path.write_bytes(FIXTURE.read_bytes() + b"\xff")
    else:
        path = tmp_path / "input.csv.gz"
        path.write_bytes(
            gzip.compress(FIXTURE.read_bytes())[:-5] if kind == "truncated_gzip" else b"not gzip"
        )
    with pytest.raises((DatasetError, OSError)):
        sample(path)
