"""Coherent policy permutations of legal saved analysis, never invented claims."""

import json
from copy import deepcopy
from types import SimpleNamespace

import chess
import chess.pgn
from review_human_fixtures import CASES, human_game
from review_speech_combination_fixtures import fixtures, projected_game, witnessed
from trainer.chess_core import Candidate, Score
from trainer.game_review import analyze_move, line_evidence, position, public_report
from trainer.review_intelligence.context import move_contexts

PROFILES = {
    "preferred": ((1, 0.40), (2, 0.25)),
    "preferred-plausible": ((1, 0.40), (4, 0.06)),
    "preferred-unusual": ((1, 0.40), (7, 0.02)),
    "plausible-unusual": ((4, 0.06), (7, 0.02)),
    "unusual": ((7, 0.02), (8, 0.01)),
    "plausible": ((4, 0.06), (5, 0.05)),
}


def frames_for(parsed):
    board = parsed.board()
    frames = [position(board) | dict(san="Start", uci=None, actor=None, number=1, report=None)]
    for move in parsed.mainline_moves():
        san, actor, number = (
            board.san(move),
            "white" if board.turn else "black",
            board.fullmove_number,
        )
        board.push(move)
        frames.append(
            position(board) | dict(san=san, uci=move.uci(), actor=actor, number=number, report=None)
        )
    return frames


def policy_games():
    raws, contexts, histories = {}, {}, {}
    fixtures(raws)

    def add(raw, name):
        game = projected_game(raw, name)
        raws[name] = (raw, game)

    board = chess.Board("8/7k/8/8/4q3/5N2/8/K7 w - - 0 1")
    raw = witnessed(board, "a1a2", best="f3g5", before=300, after=-300, second=280)
    raw["best"]["pv"] = ["f3g5", "h7g8", "g5e4"]
    raw["best_line"] = line_evidence(
        board, Candidate.model_validate(raw["best"]), raw["before_analysis_id"], 1
    )
    add(raw, "missed-fork")

    board = chess.Board("r5k1/8/8/8/8/8/1P3PPP/6K1 w - - 0 1")
    add(
        witnessed(
            board, "b2b3", best="h2h3", after={"kind": "mate", "value": -1}, pv=["b2b3", "a8a1"]
        ),
        "back-rank-allowed",
    )
    board = chess.Board("6k1/1p3ppp/2pp3r/8/8/8/1P3PP1/R5K1 w - - 0 1")
    add(
        witnessed(
            board,
            "g1f1",
            best="a1a8",
            before={"kind": "mate", "value": 1},
            after=-300,
            pv=["g1f1", "h6h1", "f1e2"],
        ),
        "back-rank-missed",
    )

    # A real rook offer: discovered double check, then a knight fork collects the
    # queen. The finite line gains a pawn-equivalent and ends with pawns remaining,
    # not checkmate; its synthetic cp scores do not contradict a terminal PV.
    board = chess.Board("4q2k/p5R1/8/7N/8/8/PB6/2K5 w - - 0 1")
    pv = ["g7g8", "h8g8", "h5f6", "g8f8", "f6e8", "f8e8"]
    for same in (True, False):
        actual = Candidate(
            uci=pv[0],
            san=board.san(chess.Move.from_uci(pv[0])),
            score=Score(kind="cp", value=100),
            pv=pv,
            depth=16,
        )
        other = Candidate(
            uci="b2f6",
            san="Bf6",
            score=Score(kind="cp", value=90 if same else 110),
            pv=["b2f6"],
            depth=16,
        )
        roots = [actual, other] if same else [other, actual]

        def analyze(position, **options):
            if options.get("root_moves"):
                capture = Candidate(
                    uci=pv[1],
                    san=position.san(chess.Move.from_uci(pv[1])),
                    score=Score(kind="cp", value=-100),
                    pv=pv[1:],
                    depth=16,
                )
                return SimpleNamespace(
                    id="sacrifice-acceptance",
                    engine_version="Synthetic authority",
                    candidates=[capture.model_dump()],
                )
            return SimpleNamespace(
                id="sacrifice-root",
                engine_version="Synthetic authority",
                candidates=[candidate.model_dump() for candidate in roots],
            )

        raw = analyze_move(SimpleNamespace(analyze=analyze), board, chess.Move.from_uci(pv[0]))
        assert raw["sacrifice"] is not None
        assert all(not frame.get("termination") for frame in raw["actual_line"]["frames"])
        add(raw, f"sacrifice-{same}")

    for feature, fen, played, other, pv in (
        ("bishops", "7k/8/8/8/3b4/2B5/1P6/K4B2 b - - 0 1", "d4c3", "d4e5", ["d4c3", "b2c3"]),
        ("passer", "7k/p7/8/4P3/8/8/8/R5K1 w - - 0 1", "e5e6", "e5e6", ["e5e6"]),
        ("flights", "k7/p7/8/8/8/8/R4PPP/6K1 w - - 0 1", "h2h3", "g2g3", ["h2h3"]),
    ):
        board = chess.Board(fen)
        for same in (True, False):
            # The passer alternative preserves the same feature with another
            # legal rook move as the engine preference when needed.
            best = played if same else "a1b1" if feature == "passer" else other
            add(
                witnessed(board, played, best=best, before=10 if same else 20, after=10, pv=pv),
                f"position-{feature}-{same}",
            )

    for kind, pawns in (("open", "8"), ("semi-open", "3p4")):
        board = chess.Board(f"7k/{pawns}/8/8/8/8/P7/R5K1 w - - 0 1")
        for same in (True, False):
            add(
                witnessed(
                    board,
                    "a1d1",
                    best="a1d1" if same else "a1e1",
                    before=10 if same else 20,
                    after=10,
                ),
                f"rook-{kind}-{same}",
            )

    # A setup PGN's first clock does not establish time spent. Supply the same
    # player's previous clock and evaluate the third, legally replayed ply.
    board = chess.Board("7k/p7/8/8/8/P4K2/8/8 w - - 0 1")
    for kind, seconds, remaining in (("low", 20, 19), ("fast", 600, 599), ("long", 600, 400)):
        for same in (True, False):
            name = f"clock-{kind}-{same}"
            parsed = chess.pgn.Game()
            parsed.setup(board)
            parsed.headers["TimeControl"] = str(seconds)
            first = parsed.add_variation(chess.Move.from_uci("f3g3"))
            first.set_clock(seconds)
            second = first.add_variation(chess.Move.from_uci("h8g8"))
            second.set_clock(seconds)
            node = second.add_variation(chess.Move.from_uci("g3f3"))
            node.set_clock(remaining)
            contexts[name] = move_contexts(parsed)[3]
            histories[name] = frames_for(parsed)
            add(
                witnessed(
                    second.board(),
                    "g3f3",
                    best="g3f3" if same else "g3f4",
                    before=0 if same else 10,
                ),
                name,
            )

    # A losing runner-up permits a hard-defense assessment without fabricating
    # practical flags. Preserve the whole root inventory when it is present.
    for name, (raw, game) in list(raws.items()):
        score = raw["actual"]["score"]
        losing = (
            score["kind"] == "mate"
            and score["value"] < 0
            or score["kind"] == "cp"
            and score["value"] <= -200
        )
        if raw["actual"]["uci"] == raw["best"]["uci"] or not losing:
            continue
        value = deepcopy(raw)
        value["second_score"] = {"kind": "cp", "value": -150}
        for candidate in value.get("root_candidates", []):
            if candidate["uci"] != value["best"]["uci"]:
                candidate["score"] = {"kind": "cp", "value": -150}
        raws[f"{name}-narrow"] = (value, game)

    result = {f"human-{key}": human_game(key).model_dump(mode="json") for key in CASES}
    for name, (raw, game) in raws.items():
        for profile, (played, best) in PROFILES.items():
            value = deepcopy(raw)
            same_move = value["actual"]["uci"] == value["best"]["uci"]
            if same_move:
                best = played
            if max(played[0], best[0]) > value["legal_count"]:
                continue
            assert same_move or played[0] != best[0]
            human = value["human"]
            human["evidence_id"] += f"-{profile}"
            human["played"].update(rank=played[0], probability=played[1])
            human["engine_best"].update(rank=best[0], probability=best[1])
            report = public_report(value, 1200, context=contexts.get(name))
            projected = game.model_dump(mode="json")
            projected["id"] += f"-{profile}"
            if name in histories:
                projected["frames"] = deepcopy(histories[name])
            projected["frames"][-1]["report"] = report
            result[f"{name}-{profile}"] = projected
    return result


if __name__ == "__main__":
    print(json.dumps(policy_games()))
