"""Legal boards with synthetic searches/policies, projected by production rules.

These test dialogue reachability and evidence binding, not engine strength.
No rendered claims or practical assessments are manufactured here.
"""

import json
from copy import deepcopy

import chess
from review_cause_fixtures import CAUSES, cause_report
from review_human_fixtures import human_game
from review_intelligence_fixtures import move_report
from test_patterns_v2 import CASES as PATTERN_CASES
from trainer.chess_core import Candidate, Score, digest, evaluation_loss
from trainer.contracts.games import GameDetail
from trainer.game_review import line_evidence, position, public_report


def projected_game(raw, name, policy="natural_error"):
    board = chess.Board(raw["actual_line"]["frames"][0]["fen"])
    assert board.is_valid()
    mover = "white" if board.turn else "black"
    human = human_game(policy, mover).frames[1].report.human.model_dump(mode="json")
    human.update(
        evidence_id=f"speech-policy-{name}",
        history_key=digest({"fen": board.fen()}),
        mover=mover,
        legal_count=board.legal_moves.count(),
    )
    human["played"]["uci"] = raw["actual"]["uci"]
    human["engine_best"]["uci"] = raw["best"]["uci"]
    if (
        raw["actual"]["uci"] != raw["best"]["uci"]
        and human["played"]["rank"] == human["engine_best"]["rank"]
    ):
        # The unusual-strong source describes the same move twice. Distinct
        # moves must occupy different ranks in the rebound synthetic policy.
        human["engine_best"].update(rank=8, probability=0.015)
    assert max(human["played"]["rank"], human["engine_best"]["rank"]) <= human["legal_count"]
    human["domain"]["history_from_start"] = False
    raw["human"] = human
    report = public_report(raw, 1200)
    start = position(board) | dict(san="Start", uci=None, actor=None, number=1, report=None)
    played = raw["actual"]["uci"]
    assert chess.Move.from_uci(played) in board.legal_moves
    board.push_uci(played)
    end = position(board) | dict(
        san=report["actual"]["san"], uci=played, actor=mover, number=1, report=report
    )
    return GameDetail.model_validate(
        dict(
            id=name,
            white="Learner" if mover == "white" else "Opponent",
            black="Learner" if mover == "black" else "Opponent",
            orientation=mover,
            frames=[start, end],
            result="*",
            played_on=None,
            rating=1200,
            white_rating=1200,
            black_rating=1400,
            accuracy=None,
            job=None,
        )
    )


def witnessed(board, played, **kwargs):
    raw = move_report(board, played, **kwargs)
    loss = evaluation_loss(
        Score.model_validate(raw["best"]["score"]), Score.model_validate(raw["actual"]["score"])
    )
    poor = loss.mate_lost or loss.allows_mate or (loss.cp or 0) >= 50
    for field in ("actual", "best"):
        raw[f"{field}_line"] = line_evidence(
            board,
            Candidate.model_validate(raw[field]),
            raw["played_analysis_id" if field == "actual" else "before_analysis_id"],
            2 if field == "actual" and poor else 1,
        )
    return raw


def fixtures(raw_cases=None):
    def project(raw, name, policy="natural_error"):
        game = projected_game(raw, name, policy)
        if raw_cases is not None:
            raw_cases[name] = (deepcopy(raw), game)
        return game

    result = {"evaluation-natural": human_game("natural_error")}
    for skill in CAUSES:
        for black in (False, True):
            name = f"cause-{skill}-{'black' if black else 'white'}"
            result[name] = project(cause_report(skill, black), name)

    board = chess.Board()
    for move in ("f2f3", "e7e5"):
        board.push_uci(move)
    result["allowed-mate-natural"] = project(
        witnessed(
            board,
            "g2g4",
            best="b1c3",
            pv=["g2g4", "d8h4"],
            after={"kind": "mate", "value": -1},
        ),
        "allowed-mate-natural",
    )
    result["missed-mate-natural"] = project(
        witnessed(
            chess.Board("7k/8/5KQ1/8/8/8/8/8 w - - 0 1"),
            "g6g5",
            best="g6g7",
            before={"kind": "mate", "value": 1},
            after=400,
            second=350,
        ),
        "missed-mate-natural",
    )

    for policy in ("hard_find", "unusual_strong"):
        name = f"fork-{policy}"
        result[name] = project(
            witnessed(
                chess.Board("8/7k/8/8/4q3/5N2/8/K7 w - - 0 1"),
                "f3g5",
                best="f3e5" if policy == "unusual_strong" else "f3g5",
                before=320 if policy == "unusual_strong" else 300,
                after=300,
                second=280,
                pv=["f3g5", "h7g8", "g5e4"],
            ),
            name,
            policy,
        )
        for motif, fen, line, alternative in PATTERN_CASES[:1]:
            name = f"{motif}-{policy}"
            result[name] = project(
                witnessed(
                    chess.Board(fen),
                    line[0],
                    pv=line,
                    best=alternative[0] if policy == "unusual_strong" else line[0],
                    before=320 if policy == "unusual_strong" else 300,
                    after=300,
                    second=280,
                ),
                name,
                policy,
            )
        for value, resource in ((0, "defense"), (300, "advantage")):
            name = f"resource-{resource}-{policy}"
            result[name] = project(
                witnessed(
                    chess.Board("6k1/8/8/8/8/8/8/R5K1 w - - 0 1"),
                    "a1a2",
                    before=value,
                    after=value,
                    second=-200,
                ),
                name,
                policy,
            )

    result["allowed-fork-natural"] = project(
        witnessed(
            chess.Board("8/p6k/8/8/4q3/5N2/8/K7 b - - 0 1"),
            "a7a6",
            best="e4e3",
            pv=["a7a6", "f3g5", "h7g8", "g5e4"],
            before=0,
            after=-300,
        ),
        "allowed-fork-natural",
    )
    result["allowed-skewer-natural"] = project(
        witnessed(
            chess.Board("8/p6q/6k1/1B6/8/8/8/6K1 b - - 0 1"),
            "a7a6",
            best="h7g7",
            pv=["a7a6", "b5d3", "g6g5", "d3h7", "g5f4"],
            before=0,
            after=-300,
        ),
        "allowed-skewer-natural",
    )

    # The verified pawn capture has no admitted tactical mechanism. Its direct
    # reply fact still pairs with the human assessment, without deleting findings.
    raw = witnessed(
        chess.Board("6k1/8/8/r7/8/8/P6P/6K1 w - - 0 1"),
        "h2h3",
        best="a2a3",
        pv=["h2h3", "a5a2"],
        before=0,
        after=-500,
    )
    assert not raw["actual_line"]["findings"]
    result["capture-natural"] = project(raw, "capture-natural")

    # Preserve a complete good report as a negative: human claims suppress the
    # generic Best fallback, so the nonexistent pair must never authorize audio.
    result["human-without-objective"] = project(
        move_report(chess.Board("7k/p7/8/8/8/P5K1/8/8 w - - 0 1"), "g3h3"),
        "human-without-objective",
        "unusual_strong",
    )
    result["unsupported-defensive-pair"] = human_game("missed_defense")
    return result


if __name__ == "__main__":
    print(json.dumps({name: game.model_dump(mode="json") for name, game in fixtures().items()}))
