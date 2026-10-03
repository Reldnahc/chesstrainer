"""Parallel backend groups must run every test file exactly once."""

from scripts import pytest_parallel


def test_groups_cover_every_file_once_and_balance_recorded_durations(tmp_path, monkeypatch):
    durations = tmp_path / "durations.json"
    durations.write_text('{"test_a.py": 9, "test_b.py": 5, "test_c.py": 4}', encoding="utf-8")
    monkeypatch.setattr(pytest_parallel, "DURATIONS", durations)
    paths = []
    for name, tests in [("test_a.py", 1), ("test_b.py", 1), ("test_c.py", 1), ("test_new.py", 3)]:
        path = tmp_path / name
        path.write_text("def test_x(): pass\n" * tests, encoding="utf-8")
        paths.append(path)

    plan = pytest_parallel.groups(paths, 2)

    assert sorted(path.name for group in plan for path in group) == sorted(p.name for p in paths)
    assert [sorted(path.name for path in group) for group in plan] == [
        ["test_a.py", "test_new.py"],
        ["test_b.py", "test_c.py"],
    ]


def test_shards_partition_the_files_by_recorded_balance(tmp_path, monkeypatch):
    durations = tmp_path / "durations.json"
    durations.write_text('{"test_a.py": 9, "test_b.py": 5, "test_c.py": 4}', encoding="utf-8")
    monkeypatch.setattr(pytest_parallel, "DURATIONS", durations)
    paths = []
    for name in ["test_a.py", "test_b.py", "test_c.py"]:
        path = tmp_path / name
        path.write_text("def test_x(): pass\n", encoding="utf-8")
        paths.append(path)

    halves = [pytest_parallel.shard(paths, value) for value in ("1/2", "2/2")]

    assert [[path.name for path in half] for half in halves] == [
        ["test_a.py"],
        ["test_b.py", "test_c.py"],
    ]
    assert sorted(path.name for half in halves for path in half) == [p.name for p in paths]
    assert pytest_parallel.shard(paths, "4/4") == []


def test_more_processes_than_files_leave_no_empty_groups(tmp_path, monkeypatch):
    monkeypatch.setattr(pytest_parallel, "DURATIONS", tmp_path / "missing.json")
    path = tmp_path / "test_only.py"
    path.write_text("def test_x(): pass\n", encoding="utf-8")

    assert pytest_parallel.groups([path], 4) == [[path]]
