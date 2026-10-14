import chess
from trainer.contracts.games import BoardCues
from trainer.explanation_types import replay_line
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
    assert cues["caption_kind"] == "legal_reply"
    assert cues["caption_reply_uci"] == "d8h4"
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
    assert cues["caption_kind"] is None
    assert cues["caption_reply_uci"] is None


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
    assert cues["caption_kind"] == "legal_reply"
    assert cues["caption_reply_uci"] == "e7e5"
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
    assert cues["caption_kind"] is None
    assert cues["caption_reply_uci"] is None
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


def test_recorded_reply_projection_survives_contract_and_old_cues_remain_untyped():
    cues = review_cues(line(chess.STARTING_FEN, ["e2e4", "e7e5"]))
    public = BoardCues.model_validate(cues).model_dump()
    assert public["caption_kind"] == "legal_reply"
    assert public["caption_reply_uci"] == "e7e5"
    legacy = {key: value for key, value in cues.items() if not key.startswith("caption_")}
    old = BoardCues.model_validate(legacy)
    assert old.caption == cues["caption"]
    assert old.caption_kind is None
    assert old.caption_reply_uci is None


def test_absent_or_illegal_reply_never_authorizes_generic_reply_recording():
    no_reply = review_cues(line(chess.STARTING_FEN, ["e2e4"]))
    assert no_reply["caption_kind"] is None
    assert no_reply["caption_reply_uci"] is None
    evidence = line(chess.STARTING_FEN, ["e2e4", "e7e5"])
    evidence["frames"][2]["uci"] = "e7e4"
    illegal = review_cues(evidence, mistake=True)
    assert illegal["caption_kind"] is None
    assert illegal["caption_reply_uci"] is None


def test_pin_arrow_appears_on_the_move_that_makes_the_pin():
    # Bg5 pins the f6 knight to the queen on d8.
    board = chess.Board()
    for san in ["d4", "d5", "c4", "e6", "Nc3", "Nf6"]:
        board.push_san(san)
    cues = review_cues(line(board.fen(), ["c1g5", "f8e7"]))
    assert cues["pins"] == [{"startSquare": "g5", "endSquare": "d8", "kind": "pin", "pinned": "f6"}]
    assert BoardCues.model_validate(cues).pins[0].pinned == "f6"


def test_pin_kept_from_an_earlier_move_is_not_drawn_again():
    board = chess.Board()
    for san in ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5"]:
        board.push_san(san)
    assert review_cues(line(board.fen(), ["h7h6", "g5h4"]))["pins"] == []


def test_walking_into_an_absolute_pin_counts_as_making_it():
    # Nd2 blocks the b4 bishop's check and is pinned to the king by that move.
    evidence = line("4k3/8/8/8/1b6/8/8/1N2K3 w - - 0 1", ["b1d2"])
    assert review_cues(evidence)["pins"] == [
        {"startSquare": "b4", "endSquare": "e1", "kind": "pin", "pinned": "d2"}
    ]


def test_sliding_along_a_held_pin_does_not_redraw_it():
    # The pinned rook steps along the file, then the pinning rook does.
    pinned = line("4k3/4r3/8/8/8/8/8/4RK2 b - - 0 1", ["e7e6"])
    pinner = line("4k3/4r3/8/8/8/8/8/4RK2 w - - 0 1", ["e1e2"])
    assert review_cues(pinned)["pins"] == review_cues(pinner)["pins"] == []
    # The king stepping onto a new line behind its own piece is a new pin.
    king = line("3k4/4r3/8/8/8/8/8/4RK2 b - - 0 1", ["d8e8"])
    assert review_cues(king)["pins"] == [
        {"startSquare": "e1", "endSquare": "e8", "kind": "pin", "pinned": "e7"}
    ]


def test_only_piece_pins_to_the_king_or_something_worth_more_get_an_arrow():
    # Bb5 pins the d7 pawn to the king: a pawn, so no arrow.
    assert review_cues(line("4k3/3p4/8/8/8/8/4B3/4K3 w - - 0 1", ["e2b5"]))["pins"] == []
    # Qa1 lines the c3 knight up with the e5 rook, which is worth less than the queen.
    assert review_cues(line("7K/8/8/4r3/8/2n5/8/1Q5k w - - 0 1", ["b1a1"]))["pins"] == []
    # Re2 pins the e5 knight to the queen, which is worth more than the rook.
    assert review_cues(line("4q2k/8/8/4n3/8/8/R7/K7 w - - 0 1", ["a2e2"]))["pins"] == [
        {"startSquare": "e2", "endSquare": "e8", "kind": "pin", "pinned": "e5"}
    ]
