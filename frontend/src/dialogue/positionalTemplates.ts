import type {Claim} from "./model";

// Base predicates only: the shared renderer owns the named move and conditional
// tense. Actual-board personality templates cannot override hypothetical scope.
const predicates: Readonly<Record<string, string>> = {
  development: "develop the {piece} from its original square.",
  rook_file: "leave {side}'s rook on a {kind} {file}-file.",
  passed: "leave {side} with passed pawns on {squares}; no enemy pawn would be ahead on those or neighboring files.",
  passer_advance: "advance the passed pawn to {square}.",
  isolated: "leave {side} with isolated pawns on {squares}, with no friendly pawn on a neighboring file.",
  support: "give the {piece} on {square} support.",
  unsupported: "leave the {piece} on {square} undefended; that alone would not mean it was lost.",
  flights: "open {squares} as a legal flight square for the king.",
  castle: "castle the king to {square} and relocate the rook.",
  bishops: "remove {side}'s pair of opposite-colored bishops.",
  doubled: "leave {side} with doubled pawns on files {files}.",
};

export function alternativeTemplate(item: Claim): readonly string[] {
  const predicate = predicates[item.code];
  if (!predicate || !item.position?.move.trim()) return [];
  return [`${item.position.move} would ${predicate}`];
}
