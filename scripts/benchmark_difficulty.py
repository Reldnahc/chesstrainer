"""Inspect deterministic difficulty over saved M0/M1 measurements, not population calibration."""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

import chess.pgn
from review_benchmark.corpus import board_for, load_corpus
from trainer.chess_core import digest
from trainer.config import Settings
from trainer.human_models.context import request_for
from trainer.human_models.evidence import policy_summary
from trainer.human_models.preset import provenance
from trainer.human_models.types import HumanEvidence, HumanMove, HumanPolicy
from trainer.review_intelligence.difficulty import VERSION, assess_difficulty


def measure(stockfish_path, human_path):
    stockfish = json.loads(stockfish_path.read_text())
    human = json.loads(human_path.read_text())
    corpus = load_corpus()
    if stockfish["corpus_digest"] != digest(corpus) or human["model"] != "79m":
        raise ValueError("Use the pinned 79M and matching baseline corpus")
    if human["method"] not in {"policy", "isolated"}:
        raise ValueError("A complete exact policy is required, not UCI rank/WDL")
    reports = {row["id"]: row["report"] for row in stockfish["passes"][0]["rows"]}
    positions = {row["id"]: row for row in corpus["positions"]}
    # This replay describes a pinned *historical measurement*, not the interpreter
    # running this command. No native engine, Torch import or network is required.
    identity = provenance(Settings(_env_file=None))
    identity.inference.update(
        torch="2.8.0+cpu" if human["device"] == "cpu" else "2.8.0+cu128",
        device=human["device"],
        threads=human["threads"],
    )
    rows = []
    for recorded in human["passes"][0]["rows"]:
        item = positions[recorded["id"]]
        board = board_for(item)
        game = chess.pgn.Game()
        # These are synthetic domain scenarios, never observations about players.
        game.headers["Site"] = {
            "chesscom": "https://chess.com",
            "lichess": "https://lichess.org",
        }.get(item["platform"], "?")
        game.headers["Event"] = (
            "Synthetic Blitz"
            if item["platform"] == "lichess"
            else "Synthetic Rapid"
            if item["platform"] == "chesscom" and item["time_control"] != "180"
            else "Synthetic"
        )
        game.headers["TimeControl"] = item["time_control"] or "?"
        game.headers["WhiteElo" if board.turn else "BlackElo"] = str(recorded["self_elo"])
        game.headers["BlackElo" if board.turn else "WhiteElo"] = str(recorded["opponent_elo"])
        request = request_for(game, board, 1000)
        policy = HumanPolicy(
            provenance=identity,
            complete=True,
            moves=[HumanMove(rank=i + 1, **move) for i, move in enumerate(recorded["moves"])],
        )
        if {m.uci for m in policy.moves} != {m.uci() for m in board.legal_moves}:
            raise ValueError("Measurement does not cover this position's legal moves")
        report = reports[item["id"]]
        evidence = HumanEvidence(
            status="available",
            configuration_key=digest(identity.model_dump()),
            history_key=digest(request.history.model_dump()),
            mover=request.mover,
            conditioning=request.conditioning,
            domain=request.domain,
            legal_count=board.legal_moves.count(),
            **policy_summary(policy, item["played"], report["best"]["uci"]),
        )
        result = assess_difficulty(report | {"human": evidence.model_dump(mode="json")})
        rows.append(
            {
                "id": item["id"],
                "self_rating": recorded["self_elo"],
                "opponent_rating": recorded["opponent_elo"],
                "assessment": result.model_dump(mode="json"),
            }
        )
    return {
        "version": VERSION,
        "corpus": corpus["version"],
        "warning": "Synthetic conditioning probes, not calibrated population success rates.",
        "measurement_sha256": {
            "stockfish": hashlib.sha256(stockfish_path.read_bytes()).hexdigest(),
            "human": hashlib.sha256(human_path.read_bytes()).hexdigest(),
        },
        "by_rating": {
            str(rating): {
                "difficulty": dict(
                    Counter(
                        row["assessment"]["best_find_difficulty"]
                        for row in rows
                        if row["self_rating"] == rating
                    )
                ),
                "naturalness": dict(
                    Counter(
                        row["assessment"]["played_naturalness"]
                        for row in rows
                        if row["self_rating"] == rating
                    )
                ),
            }
            for rating in corpus["ratings"]
        },
        "rows": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stockfish-report", type=Path, required=True)
    parser.add_argument("--human-report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = measure(args.stockfish_report, args.human_report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(result, output, indent=2)
        output.write("\n")
    print(json.dumps(result["by_rating"], indent=2))


if __name__ == "__main__":
    main()
