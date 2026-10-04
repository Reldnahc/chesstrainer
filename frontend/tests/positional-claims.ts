import type {Schema} from "../src/api";
import {positionalClaim} from "../src/dialogue/eventClaims";

// Rendering grammar cases; legal-transition fixtures are supplied separately by Python.
const facts = [
  {feature: "first_development", piece: "knight"},
  {feature: "rook_file", after: "open", file: "d"},
  {feature: "passed_pawns", added: ["d5"]},
  {feature: "passed_pawn_advance", after: "d6"},
  {feature: "isolated_pawns", added: ["d5"]},
  {feature: "piece_support", after: ["e4"], piece: "knight", target: "d5", attacked: true},
  {feature: "piece_support", after: [], piece: "knight", target: "d5", attacked: true},
  {feature: "king_flights", opened: ["h2"]},
  {feature: "castling", after: "g1"},
  {feature: "bishop_pair"},
  {feature: "doubled_files", after: ["c"], added: ["c"]},
] satisfies Schema["ReviewEvent"]["facts"][];

export function positionalClaims(line: "actual" | "best") {
  return facts.map((value, index) => positionalClaim({id: `position-${index}`, kind: "positional", actor: "white",
    confidence: "board_fact", importance: 30, facts: {...value, line, side: "black"},
    evidence: [{source: "position", id: "synthetic-grammar-case", field: "immediate_transition"}]}, "played", "alternative")!);
}
