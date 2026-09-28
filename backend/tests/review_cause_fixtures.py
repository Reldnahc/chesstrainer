"""Legal causal fixtures shared by Python and the production dialogue regressions."""

import json
from types import SimpleNamespace

import chess
from test_local_classifier import evidence
from test_patterns_v3 import CAUSE_ACTUAL, CAUSE_BEST, CAUSE_FEN
from trainer.game_review import analyze_move, public_report

CAUSES = ("abandoned_defender", "opponent_threat_recognition", "avoiding_bad_trades")


def cause_report(skill, black=False):
    payload = evidence(CAUSE_FEN, CAUSE_BEST, CAUSE_ACTUAL, 900, -500, black)
    if skill == "avoiding_bad_trades":
        payload = evidence(
            "3r2k1/8/8/3p4/8/8/8/3R2K1 w - - 0 1",
            ["g1h2", "g8h7", "h2g3", "h7g6"],
            ["d1d5", "d8d5", "g1f2", "g8f7", "f2e3", "f7e6"],
            0,
            -400,
            black,
        )
    board = chess.Board(payload["fen"])
    if skill == "opponent_threat_recognition":
        board = chess.Board("6k1/8/8/1q6/8/8/2N5/R5K1 b - - 0 1")
        if black:
            board = board.mirror()
        board.push_uci("b4a4" if black else "b5a5")
    for candidate in [*payload["best_candidates"], payload["played_candidate"]]:
        candidate["depth"] = 16

    def analyze(_board, **options):
        actual = bool(options.get("root_moves"))
        return SimpleNamespace(
            id="played-evidence" if actual else "root-evidence",
            engine_version="Synthetic authority",
            candidates=[payload["played_candidate"]] if actual else payload["best_candidates"],
        )

    return analyze_move(
        SimpleNamespace(analyze=analyze), board, chess.Move.from_uci(payload["user_move"]["uci"])
    )


if __name__ == "__main__":
    print(
        json.dumps(
            [
                {
                    "skill": skill,
                    "black": black,
                    "report": public_report(cause_report(skill, black), 1000),
                }
                for skill in CAUSES
                for black in (False, True)
            ]
        )
    )
