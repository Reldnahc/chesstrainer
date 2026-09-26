import chess
from trainer.explanations import replay_line
from trainer.review_cues import review_cues


def line(fen, moves, findings=()):
    return {
        "frames": [f.model_dump() for f in replay_line(chess.Board(fen), moves)],
        "findings": list(findings),
    }


def test_mate_reply_is_an_arrow_on_the_unchanged_position():
    board = chess.Board()
    for san in ["f3", "e5"]:
        board.push_san(san)
    evidence = line(board.fen(), ["g2g4", "d8h4"])
    cues = review_cues(evidence, mistake=True)
    assert cues["fen"] == evidence["frames"][1]["fen"]
    assert cues["arrows"] == [
        {"startSquare": "d8", "endSquare": "h4", "kind": "reply"},
        {"startSquare": "h4", "endSquare": "e1", "kind": "threat"},
    ]
    assert cues["roles"]["reply"] == ["h4"]
    assert "Qh4#" in cues["caption"]
    assert chess.Board(cues["fen"]).piece_at(chess.D8) == chess.Piece(chess.QUEEN, chess.BLACK)


def test_fork_highlights_current_attacker_and_both_targets_without_playback():
    evidence = line(
        "q3k3/8/8/3N4/8/8/7P/4K3 w - - 0 1",
        ["d5c7", "e8d8", "c7a8"],
        [
            {
                "frame_ply": 1,
                "roles": {"attacker": ["c7"], "targets": ["a8", "e8"]},
                "explanation": "Nc7+ forks the king and queen.",
            }
        ],
    )
    cues = review_cues(evidence)
    assert {(a["startSquare"], a["endSquare"]) for a in cues["arrows"]} == {
        ("d5", "c7"),
        ("c7", "a8"),
        ("c7", "e8"),
    }
    assert "reply" not in cues["roles"]
    assert cues["caption"] == "Nc7+ forks the king and queen."


def test_late_witness_never_appears_as_an_immediate_threat():
    evidence = line(
        chess.STARTING_FEN,
        ["e2e4", "e7e5", "g1f3", "b8c6"],
        [
            {
                "frame_ply": 4,
                "roles": {"attacker": ["c6"], "targets": ["d4"]},
                "explanation": "Later evidence must not be projected onto the current board.",
            }
        ],
    )
    cues = review_cues(evidence)
    assert cues["roles"] == {"reply": ["e5"]}
    assert "Later evidence" not in cues["caption"]
    assert len(cues["arrows"]) == 1


def test_before_capture_does_not_label_the_capturer_as_the_captured_target():
    evidence = line(
        "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1",
        ["e4d5"],
        [
            {
                "frame_ply": 0,
                "roles": {"attacker": ["e4"], "target": ["d5"]},
                "explanation": "exd5 captures the queen.",
            }
        ],
    )
    cues = review_cues(evidence)
    assert cues["roles"] == {"attacker": ["d5"]}
    assert len(cues["arrows"]) == 1


def test_pin_keeps_defender_and_king_highlights_without_inventing_attacks():
    evidence = line(
        "k3r3/8/8/8/3b4/8/4NP1P/4K3 w - - 0 1",
        ["h2h3", "d4f2"],
        [
            {
                "frame_ply": 1,
                "roles": {
                    "attacker": ["d4"],
                    "target": ["f2"],
                    "pinned_defender": ["e2"],
                    "king": ["e1"],
                },
                "explanation": "The pinned knight cannot recapture on f2.",
            }
        ],
    )
    cues = review_cues(evidence, mistake=True)
    assert cues["roles"]["pinned_defender"] == ["e2"]
    assert cues["roles"]["king"] == ["e1"]
    assert not any(a["startSquare"] == "d4" and a["endSquare"] == "e1" for a in cues["arrows"])
    assert {"startSquare": "f2", "endSquare": "e1", "kind": "threat"} in cues["arrows"]


def test_immediate_future_fork_is_shown_as_reply_then_threats():
    evidence = line(
        "4k3/7p/8/8/3n4/8/7P/Q3K3 w - - 0 1",
        ["h2h3", "d4c2"],
        [
            {
                "frame_ply": 2,
                "roles": {"attacker": ["c2"], "targets": ["a1", "e1"]},
                "explanation": "The reply gives check.",
            }
        ],
    )
    cues = review_cues(evidence, mistake=True)
    assert cues["arrows"][0] == {"startSquare": "d4", "endSquare": "c2", "kind": "reply"}
    assert {"startSquare": "c2", "endSquare": "e1", "kind": "threat"} in cues["arrows"]
    assert cues["fen"] == evidence["frames"][1]["fen"]
