import { positionalClaim } from "../src/dialogue/eventClaims";
import { positionalFacts } from "./helpers/reviewEvents";

// Rendering grammar cases; legal-transition fixtures are supplied separately by Python.
const facts = [
  positionalFacts("first_development", { piece: "knight" }),
  positionalFacts("rook_file", { after: "open", file: "d" }),
  positionalFacts("passed_pawns", { added: ["d5"] }),
  positionalFacts("passed_pawn_advance", { after: "d6" }),
  positionalFacts("isolated_pawns", { added: ["d5"] }),
  positionalFacts("piece_support", {
    after: ["e4"],
    piece: "knight",
    target: "d5",
    attacked: true,
  }),
  positionalFacts("piece_support", { after: [], piece: "knight", target: "d5", attacked: true }),
  positionalFacts("king_flights", { opened: ["h2"] }),
  positionalFacts("castling", { after: "g1" }),
  positionalFacts("bishop_pair"),
  positionalFacts("doubled_files", { after: ["c"], added: ["c"] }),
];

export function positionalClaims(line: "actual" | "best") {
  return facts.map((value, index) =>
    positionalClaim(
      {
        id: `position-${index}`,
        kind: "positional",
        actor: "white",
        confidence: "board_fact",
        importance: 30,
        facts: { ...value, line, side: "black" },
        evidence: [
          { source: "position", id: "synthetic-grammar-case", field: "immediate_transition" },
        ],
      },
      "played",
      "alternative",
    )!,
  );
}
