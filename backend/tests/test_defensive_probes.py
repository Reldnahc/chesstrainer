import copy

import chess
import pytest
from trainer.chess_core import Candidate, Score
from trainer.continuations import extended_line, replay
from trainer.defensive_probes import hypotheses, verify_defense
from trainer.engine import Stockfish
from trainer.local_classifier import LocalClassifier

PARAMETERS = LocalClassifier().parameters
CASES = [
    (
        "fork_capture",
        "5rk1/3r2pp/8/3N4/8/8/4K3/3R3R w - - 0 1",
        1,
        ["d5f6", "g7f6", "h1g1", "g8h8", "d1d7", "f8a8", "d7c7", "a8f8"],
        ["g7f6", "h1g1", "g8h8", "d1d7", "f8a8", "d7c7", "a8f8"],
        200,
        -200,
    ),
    (
        "relative_pin_escape",
        "3q2k1/4n3/8/3P2B1/8/8/8/6K1 w - - 0 1",
        1,
        ["d5d6", "g8f7", "d6e7", "d8e7", "g1f2", "f7g6"],
        ["e7f5", "g5d8", "g8f7", "d8c7", "f7e6"],
        200,
        -600,
    ),
    (
        "relative_pin",
        "4q1k1/4n3/2p5/1B6/8/8/8/4R1K1 w - - 0 1",
        1,
        ["b5c6", "g8f8", "c6g2", "f8g7"],
        ["e7c6", "e1e8", "g8f7", "e8e1", "f7g6"],
        200,
        -700,
    ),
    (
        "fork_capture",
        "r1r1k3/8/8/1N6/8/8/8/2Q3K1 w - - 0 1",
        1,
        ["b5c7", "c8c7", "c1c7", "e8f8", "c7c1", "f8g7"],
        ["c8c7", "c1c7", "e8f8", "c7c1", "f8g7"],
        200,
        -200,
    ),
    (
        "trapped_piece",
        "5k2/7B/6p1/7p/8/8/8/K7 w - - 0 1",
        2,
        ["a1a2", "f8g7", "h7g6", "g7g6", "a2a3", "g6f5"],
        ["h7g6", "g7g6", "a2a3", "g6f5"],
        -500,
        -500,
    ),
]


def candidate(board, pv, score):
    result = Candidate(
        uci=pv[0],
        san=board.san(chess.Move.from_uci(pv[0])),
        pv=pv,
        score=Score(kind="cp", value=score),
    )
    replay(board, result)
    return result


def prepared(case, black=False):
    kind, fen, first, line, branch, root_score, branch_score = case
    board = chess.Board(fen)
    if black:
        board = board.mirror()

        def mirror(uci):
            move = chess.Move.from_uci(uci)
            return chess.Move(
                chess.square_mirror(move.from_square),
                chess.square_mirror(move.to_square),
                promotion=move.promotion,
            ).uci()

        line, branch = list(map(mirror, line)), list(map(mirror, branch))
    root = candidate(board, line, root_score)
    boards = replay(board, root)
    requests = hypotheses(
        boards,
        first,
        len(line),
        "root",
        "missed_opportunity" if first == 1 else "allowed_opponent_tactic",
    )
    request = next(r for r in requests if r.kind == kind)
    test = candidate(boards[request.at_ply], branch, branch_score)
    probe = {
        "query_key": request.key,
        "kind": kind,
        "root_analysis_id": "root",
        "at_ply": request.at_ply,
        "analysis_id": "test",
        "fen": boards[request.at_ply].fen(),
        "config": {"root_moves": request.root_moves},
        "candidate": test.model_dump(),
    }
    return boards, root, request, probe


@pytest.mark.parametrize("case", CASES)
@pytest.mark.parametrize("black", [False, True])
def test_defensive_hypotheses_require_matched_evidence(case, black):
    boards, root, request, probe = prepared(case, black)
    finding, status = verify_defense(request, boards, root, probe, PARAMETERS)
    assert status == "confirmed" and finding.verification == "engine_defense"
    assert finding.verification_analysis_ids == ["test"]
    assert finding.analysis_id == "root" and finding.roles
    changed = copy.deepcopy(probe)
    changed["candidate"]["score"]["value"] = 900
    assert verify_defense(request, boards, root, changed, PARAMETERS)[0] is None
    for key, wrong in (
        ("fen", chess.STARTING_FEN),
        ("query_key", "unrelated"),
        ("config", {"root_moves": []}),
    ):
        changed = copy.deepcopy(probe)
        changed[key] = wrong
        with pytest.raises(ValueError, match="does not match"):
            verify_defense(request, boards, root, changed, PARAMETERS)


def test_relative_pin_needs_collection_and_unfinished_branch_abstains():
    boards, root, request, probe = prepared(
        next(case for case in CASES if case[0] == "relative_pin")
    )
    probe["candidate"]["pv"] = probe["candidate"]["pv"][:2]
    assert verify_defense(request, boards, root, probe, PARAMETERS) == (None, "unsettled")


def test_a_safe_piece_escape_prevents_trapped_hypothesis():
    case = list(next(case for case in CASES if case[0] == "trapped_piece"))
    case[1] = "5k2/7B/8/7p/8/8/8/K7 w - - 0 1"
    board = chess.Board(case[1])
    root = candidate(board, case[3], case[5])
    assert not any(
        r.kind == "trapped_piece"
        for r in hypotheses(replay(board, root), 2, len(root.pv), "root", "allowed_opponent_tactic")
    )


def test_tail_requires_exact_parent_and_retains_root_score():
    boards, root, request, probe = prepared(
        next(case for case in CASES if case[0] == "relative_pin")
    )
    short = root.model_copy(update={"pv": root.pv[:1]})
    tail = {**probe, "kind": "tail", "at_ply": 1}
    joined, frames = extended_line(boards[0], short, "root", [tail])
    assert joined.score == root.score and joined.pv == short.pv + probe["candidate"]["pv"]
    assert len(frames) == len(joined.pv) + 1
    tail["at_ply"] = 2
    with pytest.raises(ValueError, match="parent endpoint"):
        extended_line(boards[0], short, "root", [tail])


@pytest.mark.stockfish
@pytest.mark.parametrize("case", CASES)
def test_native_defensive_searches_cache_and_preserve_perspective(
    case, sessions, settings, stockfish_path
):
    settings.stockfish_path = stockfish_path
    settings.classification_probe_time = 0.4
    settings.classification_probe_depth = 18
    boards, root, request, probe = prepared(case)
    engine = Stockfish(settings, sessions)
    try:
        reference = engine.analyze(
            boards[0], root_moves=[root.uci], multipv=1, classification_probe=True
        )
        # Keep the geometrical fixture line; scores and the tested branch are native.
        root = root.model_copy(
            update={"score": Candidate.model_validate(reference.candidates[0]).score}
        )
        result = engine.analyze(
            boards[request.at_ply],
            root_moves=request.root_moves,
            multipv=1,
            classification_probe=True,
        )
        probe.update(
            analysis_id=result.id,
            fen=result.fen,
            config=result.config,
            candidate=result.candidates[0],
        )
        finding, status = verify_defense(request, boards, root, probe, PARAMETERS)
        assert status == "confirmed", (status, result.candidates)
        assert finding.verification_analysis_ids == [result.id]
        misses = engine.misses
        assert (
            engine.analyze(
                boards[request.at_ply],
                root_moves=request.root_moves,
                multipv=1,
                classification_probe=True,
            ).id
            == result.id
        )
        assert engine.misses == misses and engine.hits >= 1
    finally:
        engine.close()
    assert engine.process is None
