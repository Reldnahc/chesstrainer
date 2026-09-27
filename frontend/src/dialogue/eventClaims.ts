import type { Schema } from "../api";
import {claim, type Claim} from "./model";

type Event = Schema["ReviewEvent"];
export const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
export const words = (value: unknown) => typeof value === "string"
  ? value === "missed_tactical_capture" ? "undefended capture" : value.replaceAll("_", " ") : "";
const join = (items: string[]) => items.length === 2 ? `${items[0]} and ${items[1]}` : items.join(", ");

export function positionalClaim(event: Event, move: string, best: string): Claim | null {
  const f = event.facts;
  const alternative = f.line === "best";
  const lead = `${alternative ? best : move} `;
  const priority = alternative ? 61 : 66;
  const make = (code: string, slots: Claim["slots"]) => claim(code, slots, priority, event.evidence, [event.id]);
  switch (f.feature) {
    case "first_development": return make("development", {lead, piece: words(f.piece)});
    case "rook_file": return f.after === "open" || f.after === "semi_open"
      ? make("rook_file", {lead, side: words(f.side), kind: words(f.after), file: words(f.file)}) : null;
    case "passed_pawns": return strings(f.added).length
      ? make("passed", {lead, side: words(f.side), squares: join(strings(f.added))}) : null;
    case "passed_pawn_advance": return make("passer_advance", {lead, square: words(f.after)});
    case "isolated_pawns": return strings(f.added).length
      ? make("isolated", {lead, side: words(f.side), squares: join(strings(f.added))}) : null;
    case "piece_support": return make(strings(f.after).length ? "support" : "unsupported",
      {lead, piece: words(f.piece), square: words(f.target)});
    case "king_flights": return make("flights", {lead, squares: join(strings(f.opened))});
    case "castling": return make("castle", {lead, square: words(f.after)});
    case "bishop_pair": return make("bishops", {side: words(f.side)});
    case "doubled_files": return strings(f.after).length
      ? make("doubled", {side: words(f.side), files: join(strings(f.after))}) : null;
    default: return null;
  }
}

export function tacticalClaim(event: Event, move: string, best: string, opponent: string): Claim | null {
  const f = event.facts, role = f.role;
  if (!["played", "allowed", "missed"].includes(String(role))) return null;
  let detail = "";
  const roles = object(f.roles), pieces = object(f.pieces);
  const targets = strings(roles.targets).map(square => ({square, color: object(pieces[square]).color, piece: object(pieces[square]).piece}))
    .filter(p => p.color && p.color !== event.actor && p.piece);
  if (f.motif === "fork" && targets.length >= 2)
    detail = `The ${join(targets.slice(0, 3).map(p => `${p.piece} on ${p.square}`))} are attacked together.`;
  else if (typeof f.settled_material_delta === "number" && f.settled_material_delta > 0)
    detail = "The verified continuation wins material.";
  else {
    const witness = Array.isArray(f.witness) ? f.witness.map(object) : [];
    const capture = witness.find(frame => frame.capture && frame.san);
    if (capture) detail = `The line includes ${capture.san}, capturing a ${capture.capture}.`;
  }
  return claim(`tactic_${role}`, {move, best, opponent, motif: words(f.motif), detail},
    role === "allowed" ? 94 : role === "missed" ? 91 : 83, event.evidence, [event.id]);
}
