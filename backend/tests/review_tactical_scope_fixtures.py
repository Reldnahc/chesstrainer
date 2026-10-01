"""Legal tactical scopes through production projection, with synthetic scores only."""

import json

import chess
from review_intelligence_fixtures import move_report
from test_local_classifier import BEST as COLLECTED_LINE
from test_local_classifier import FEN as COLLECTED_FEN
from trainer.chess_core import Candidate, Score, evaluation_loss
from trainer.game_review import line_evidence, public_report

# The immediate fork is the legal fixture in test_review_events. Its short line
# recognizes the attack without pretending that the later queen capture happened.
FORK_FEN = "8/7k/8/8/4q3/5N2/8/K7 w - - 0 1"
FORK_LINE = ["f3g5", "h7g8", "g5e4"]
SCENARIOS = ("played_fork", "missed_fork", "allowed_fork", "collected_fork", "root_capture")


def tactical_scope_report(scenario, black=False):
    """Keep the reviewed mover white by default; mirror every move for black."""
    setup = []
    if scenario == "played_fork":
        fen, actual, best, before, after = FORK_FEN, FORK_LINE, FORK_LINE, 0, 0
    elif scenario == "missed_fork":
        fen, actual, best, before, after = FORK_FEN, ["f3d2"], FORK_LINE, 0, -200
    elif scenario == "allowed_fork":
        # Kh2 allows ...Ng4+, forking the king and queen; this is the same
        # geometry with the opponent's fork at reply ply 2 instead of root ply 1.
        fen = "k7/8/5n2/4Q3/8/8/8/7K w - - 0 1"
        actual, best = ["h1h2", "f6g4", "h2g1", "g4e5"], ["h1g1"]
        before, after = 0, -200
    elif scenario == "collected_fork":
        fen, actual, best = COLLECTED_FEN, COLLECTED_LINE, COLLECTED_LINE
        before, after = 300, 300
    elif scenario == "root_capture":
        # Loose-piece recognition uses the pre-capture reference board. Retain
        # actual setup history, and do not invent a settled endpoint on this PV.
        fen, setup = "5k2/8/8/8/8/8/q7/R5K1 b - - 0 1", ["f8g8"]
        actual, best, before, after = ["a1a2"], ["a1a2"], 900, 900
    else:
        raise ValueError(f"Unknown tactical scope fixture: {scenario}")

    board = chess.Board(fen)
    if black:
        board = board.mirror()

        def mirror(line):
            return [
                chess.Move(
                    chess.square_mirror(move.from_square),
                    chess.square_mirror(move.to_square),
                    promotion=move.promotion,
                ).uci()
                for move in map(chess.Move.from_uci, line)
            ]

        actual, best, setup = mirror(actual), mirror(best), mirror(setup)
    for move in setup:
        board.push_uci(move)

    report = move_report(board, actual[0], best=best[0], before=before, after=after, pv=actual)
    report["best"]["pv"] = best
    loss = evaluation_loss(
        Score.model_validate(report["best"]["score"]),
        Score.model_validate(report["actual"]["score"]),
    )
    poor = loss.allows_mate or loss.mate_lost or (loss.cp or 0) >= 50
    report["actual_line"] = line_evidence(
        board,
        Candidate.model_validate(report["actual"]),
        report["played_analysis_id"],
        2 if poor else 1,
    )
    report["best_line"] = (
        report["actual_line"]
        if actual[0] == best[0]
        else line_evidence(
            board, Candidate.model_validate(report["best"]), report["before_analysis_id"], 1
        )
    )
    return public_report(report, 1000)


if __name__ == "__main__":
    print(
        json.dumps(
            [
                {
                    "scenario": scenario,
                    "black": black,
                    "report": tactical_scope_report(scenario, black),
                }
                for scenario in SCENARIOS
                for black in (False, True)
            ]
        )
    )
