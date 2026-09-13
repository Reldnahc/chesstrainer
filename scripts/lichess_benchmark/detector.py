"""Benchmark-only adapter to production's line-pattern detector.

The CSV has no alternative-move scores. We do not fabricate Candidate scores or
call LocalClassifier.classify. Visible line outcomes supply explicitly weaker
support to the shared pattern layer; they are not proof of a forced outcome.
"""

import hashlib
from dataclasses import dataclass
from pathlib import Path

import chess
from trainer import (
    chess_core,
    combination_patterns,
    continuations,
    diagnosis_types,
    lichess_patterns,
    lichess_witnesses,
    local_classifier,
    tactical_geometry,
    tactical_patterns,
    taxonomy,
    verified_patterns,
)
from trainer._vendor.lichess_puzzler import COMMIT, cook, model, util
from trainer.diagnosis_types import Finding
from trainer.local_classifier import LocalClassifier

from .positions import PuzzleLine
from .themes import ThemeMapping


@dataclass
class Witness:
    finding: Finding
    offset: int

    def payload(self) -> dict:
        return {
            "finding": self.finding.model_dump(mode="json"),
            "window_start_solution_ply": self.offset + 1,
            "solution_plies": [ply + self.offset for ply in self.finding.plies],
            "frame_solution_ply": self.finding.frame_ply + self.offset,
            "source": "lichess_supplied_line_not_native_analysis",
        }


@dataclass
class Detection:
    witnesses: list[Witness]
    windows: list[dict]


def detector_metadata() -> dict:
    modules = (
        chess_core,
        combination_patterns,
        continuations,
        diagnosis_types,
        local_classifier,
        lichess_patterns,
        lichess_witnesses,
        verified_patterns,
        cook,
        model,
        util,
        tactical_geometry,
        tactical_patterns,
        taxonomy,
    )
    return {
        "entry_point": "trainer.tactical_patterns.detect_patterns",
        "rule_version": diagnosis_types.RULE_VERSION,
        "upstream_commit": COMMIT,
        "parameters": LocalClassifier().parameters,
        "python_chess_version": chess.__version__,
        "source_sha256": {
            module.__name__: hashlib.sha256(Path(module.__file__).read_bytes()).hexdigest()
            for module in modules
        },
        "full_mistake_classifier_invoked": False,
        "native_defense_probes": False,
        "engine_scores_supplied": False,
    }


def detect_line(line: PuzzleLine) -> Detection:
    # No Settings() call: the host's .env, database and engine are irrelevant.
    params = LocalClassifier().parameters
    horizon = params["max_plies"] + params["extension_plies"]
    witnesses, windows = [], []
    seen = set()
    for offset in range(0, len(line.solution_uci), 2):
        boards = line.boards[offset : offset + horizon + 1]
        endpoint = continuations.continuation_end(
            boards, line.solver, params["max_plies"], params["extension_plies"]
        )
        end = endpoint.end_ply
        delta = continuations.balance(boards[end], line.solver) - continuations.balance(
            boards[0], line.solver
        )
        material_supported = delta >= params["min_material"]
        mate_supported = boards[end].is_checkmate() and boards[end].turn != line.solver
        # The observed delta can end on a capture with an unknown recapture. It
        # enables a line-recognition test only; the report preserves this caveat.
        window = {
            "start_solution_ply": offset + 1,
            "end_solution_ply": offset + end,
            "root_fen": boards[0].fen(),
            "observed_material_delta": delta,
            "material_supported": material_supported,
            "mate_supported": mate_supported,
            "production_endpoint": endpoint.model_dump(),
            "available_solution_plies": len(line.solution_uci) - offset,
        }
        windows.append(window)
        found = tactical_patterns.detect_patterns(
            boards,
            1,
            end,
            f"benchmark-line:{line.row.record_number}:{offset + 1}",
            "missed_opportunity",
            material_supported=material_supported,
            mate_supported=mate_supported,
            max_tactic_plies=params["tactic_plies"],
        )
        for finding in found:
            if finding.actor != ("white" if line.solver else "black"):
                raise ValueError("Detector returned a witness for the wrong puzzle side")
            key = (finding.skill_id, tuple(p + offset for p in finding.plies))
            if key not in seen:
                seen.add(key)
                witnesses.append(Witness(finding, offset))
    return Detection(witnesses, windows)


def matches(mapping: ThemeMapping, witness: Witness) -> bool:
    """Project typed witness subtypes; never recognize a chess motif ourselves."""
    finding = witness.finding
    if finding.skill_id != mapping.skill:
        return False
    if mapping.witness_kind == "initial_capture":
        return witness.offset + min(finding.plies) == 1
    if mapping.witness_kind == "double_check":
        return "king" in finding.roles and len(finding.roles.get("attackers", [])) > 1
    if mapping.witness_kind == "discovered_check":
        return "king" in finding.roles and "moved_piece" in finding.roles
    if mapping.witness_kind == "underpromotion":
        return any(
            chess.Move.from_uci(move).promotion in {chess.KNIGHT, chess.BISHOP, chess.ROOK}
            for move in finding.moves
        )
    return True
