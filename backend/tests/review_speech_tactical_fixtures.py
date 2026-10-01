"""Remaining tactical voice pairs from legal lines and coherent policy summaries.

Scores are synthetic authority inputs, not a Stockfish accuracy benchmark. Every
finding and practical assessment is produced normally; competing findings stay
in place. Mating lines use mate scores and are reviewed before their terminal ply.
"""

import json

import chess
from review_speech_combination_fixtures import projected_game, witnessed
from review_speech_policy_fixtures import PROFILES
from trainer.chess_core import Candidate
from trainer.game_review import line_evidence, public_report

STRONG = (
    ("hard-find", True, "plausible"),
    ("unusual-strong", False, "unusual"),
    ("natural-best", True, "preferred"),
    ("natural-strong", False, "preferred"),
)
POOR = (
    ("natural-error", False, "preferred-plausible"),
    ("hard-defense-missed", False, "preferred-unusual"),
)

# motif, initial board, demonstrated line, quiet alternative, admitted roles.
PATTERNS = (
    (
        "pin",
        "4k3/4n3/2p5/1B6/8/8/P7/4R1K1 w - - 0 1",
        "b5c6 e8f8 c6g2 f8g7",
        "b5f1",
        ("missed",),
    ),
    (
        "skewer",
        "8/8/7q/8/1B3k2/8/P7/6K1 w - - 0 1",
        "b4d2 f4f5 d2h6 f5e4 h6g7 e4f3",
        "b4a5",
        ("played", "missed"),
    ),
    (
        "removing-defender",
        "6k1/6p1/5n2/3q2B1/8/8/8/3R2K1 w - - 0 1",
        "g5f6 g7f6 d1d5 g8f7 d5d1 f7g6",
        "g5f4 g8f7 d1c1 f7g6",
        ("played", "missed"),
    ),
    (
        "discovered-attack",
        "q5k1/8/8/8/B7/8/8/R5K1 w - - 0 1",
        "a4b5 g8f7 a1a8 f7e6 a8a1 e6f5",
        "a1b1 g8f7 a4b3 f7g6",
        ("played", "missed"),
    ),
    (
        "double-attack",
        "q5k1/8/2n5/8/B7/8/8/R5K1 w - - 0 1",
        "a4b5 c6d4 a1a8 g8f7 b5c4 f7g6",
        "a1b1 g8f7 a4b3 f7g6",
        ("played", "missed"),
    ),
    (
        "deflection",
        "4k3/8/5n2/3q1B2/8/8/8/3R2K1 w - - 0 1",
        "f5d7 f6d7 d1d5 e8f7 d5d1 f7e6",
        "f5h3 e8f7 d1c1 f7g6",
        ("played", "missed"),
    ),
    (
        "promotion-awareness",
        "7k/p3P3/8/8/8/8/8/K5R1 w - - 0 1",
        "e7e8q h8h7",
        "g1g2",
        ("played", "missed"),
    ),
    (
        "undefended-capture",
        "7k/p7/8/6q1/8/8/8/K5R1 w - - 0 1",
        "g1g5 h8h7 a1a2",
        "a1a2",
        ("played", "missed"),
    ),
)

ALLOWED = (
    ("pin", "4k3/p3n3/2p5/1B6/8/8/P7/4R1K1 b - - 0 1", "a7a6 b5c6 e8f8 c6g2 f8g7", "e8f8"),
    (
        "removing-defender",
        "6k1/6pp/5n2/3q2B1/8/8/8/3R2K1 b - - 0 1",
        "h7h6 g5f6 g7f6 d1d5 g8f7 d5d1 f7g6",
        "d5c5",
    ),
    (
        "discovered-attack",
        "q5k1/7p/8/8/B7/8/8/R5K1 b - - 0 1",
        "h7h6 a4b5 g8f7 a1a8 f7e6 a8a1 e6f5",
        "a8b8",
    ),
    (
        "double-attack",
        "q5k1/7p/8/8/B3n3/8/8/R5K1 b - - 0 1",
        "h7h6 a4c6 e4f6 a1a8 g8f7 a8a1 f7g6",
        "a8b8",
    ),
    (
        "deflection",
        "4k3/7p/5n2/3q1B2/8/8/8/3R2K1 b - - 0 1",
        "h7h6 f5d7 f6d7 d1d5 e8f7 d5d1 f7e6",
        "d5a5",
    ),
    ("promotion-awareness", "7k/p7/8/8/8/8/4p3/K5R1 w - - 0 1", "a1a2 e2e1q", "g1e1"),
    ("hanging-piece", "6rk/p7/8/8/8/8/7P/K5R1 w - - 0 1", "h2h3 g8g1", "g1g8"),
)


def tactical_games():
    result = {}

    def add(board, motif, role, state, profile, actual, best, before, after, second):
        name = f"tactic-{motif}-{role}:human-{state}"
        assert board.is_valid(), name
        for pv, score in ((actual, after), (best, before)):
            replay = board.copy()
            for index, uci in enumerate(pv):
                move = chess.Move.from_uci(uci)
                assert move in replay.legal_moves, (name, uci)
                replay.push(move)
                if replay.is_game_over():
                    assert replay.is_checkmate() and index == len(pv) - 1, name
                    assert isinstance(score, dict) and score["kind"] == "mate", name
        raw = witnessed(
            board, actual[0], best=best[0], pv=actual, before=before, after=after, second=second
        )
        raw["best"]["pv"] = best
        raw["best_line"] = line_evidence(
            board, Candidate.model_validate(raw["best"]), raw["before_analysis_id"], 1
        )
        game = projected_game(raw, name).model_dump(mode="json")
        played_policy, best_policy = PROFILES[profile]
        same = actual[0] == best[0]
        if same:
            best_policy = played_policy
        assert max(played_policy[0], best_policy[0]) <= raw["legal_count"], name
        assert same or played_policy[0] != best_policy[0], name
        raw["human"]["played"].update(rank=played_policy[0], probability=played_policy[1])
        raw["human"]["engine_best"].update(rank=best_policy[0], probability=best_policy[1])
        report = public_report(raw, 1200)
        game["frames"][-1]["report"] = report
        assert game["frames"][-1]["termination"] is None, name
        assert any(
            event["kind"] == "tactic"
            and event["facts"]["motif"]
            == (
                "missed_tactical_capture"
                if motif == "undefended-capture"
                else motif.replace("-", "_")
            )
            and event["facts"]["role"] == role
            for event in report["intelligence"]["events"]
        ), name
        assert name not in result
        result[name] = game

    for motif, fen, line, alternative, roles in PATTERNS:
        board, line, alternative = chess.Board(fen), line.split(), alternative.split()
        for role in roles:
            for state, same, profile in STRONG if role == "played" else POOR:
                actual = line if role == "played" else alternative
                best = line if same or role == "missed" else alternative
                add(
                    board,
                    motif,
                    role,
                    state,
                    profile,
                    actual,
                    best,
                    300 if same or role == "missed" else 310,
                    300 if role == "played" else -300,
                    -150 if state == "hard-defense-missed" else 280,
                )
    for motif, fen, line, best in ALLOWED:
        for state, _, profile in POOR:
            add(
                chess.Board(fen),
                motif,
                "allowed",
                state,
                profile,
                line.split(),
                [best],
                0,
                -300,
                -150 if state == "hard-defense-missed" else -20,
            )

    for state, same, profile in STRONG:
        board = chess.Board(f"3r2k1/5ppp/8/{'8' if same else 'Q7'}/8/8/4R3/4R1K1 w - - 0 1")
        line = ["e2e8", "d8e8", "e1e8"]
        add(
            board,
            "back-rank",
            "played",
            state,
            profile,
            line,
            line if same else ["a5d8"],
            {"kind": "mate", "value": 2 if same else 1},
            {"kind": "mate", "value": 2},
            300 if same else {"kind": "mate", "value": 2},
        )
    assert len(result) == 62
    return result


if __name__ == "__main__":
    print(json.dumps(tactical_games()))
