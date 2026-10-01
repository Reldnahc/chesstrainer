"""Legal reply-only board cues through the production report/position projections."""

import json

import chess
from review_cause_fixtures import cause_report
from trainer.contracts.games import GameReviewReport
from trainer.game_review import position, public_report


def reply_only():
    report = cause_report("abandoned_defender")
    report["actual_line"]["findings"] = []
    frame = position(chess.Board(report["actual_line"]["frames"][1]["fen"]))
    frame["san"] = report["actual"]["san"]
    return {
        "report": GameReviewReport.model_validate(public_report(report, 1000)).model_dump(),
        "frame": frame,
    }


if __name__ == "__main__":
    print(json.dumps(reply_only()))
