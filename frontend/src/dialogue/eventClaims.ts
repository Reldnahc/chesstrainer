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
  if (f.line !== "actual" && f.line !== "best") return null;
  const alternative = f.line === "best";
  const lead = `${alternative ? best : move} `;
  const priority = alternative ? 61 : 66;
  const make = (code: string, slots: Claim["slots"]): Claim => ({
    ...claim(code, slots, priority, event.evidence, [event.id]),
    position: {line: alternative ? "alternative" : "actual", move: alternative ? best : move},
  });
  switch (f.feature) {
    case "first_development": return make("development", {lead, piece: words(f.piece)});
    case "rook_file": return f.after === "open" || f.after === "semi_open"
      ? make("rook_file", {lead, side: words(f.side), kind: words(f.after), file: words(f.file)}) : null;
    case "passed_pawns": return strings(f.added).length
      ? make("passed", {lead, side: words(f.side), squares: join(strings(f.added))}) : null;
    case "passed_pawn_advance": return make("passer_advance", {lead, square: words(f.after)});
    case "isolated_pawns": return strings(f.added).length
      ? make("isolated", {lead, side: words(f.side), squares: join(strings(f.added))}) : null;
    // Gaining or losing a defender only matters for a piece under attack; for
    // any other piece it is trivia that crowds out the move's real story.
    case "piece_support": return f.attacked === true ? make(strings(f.after).length ? "support" : "unsupported",
      {lead, piece: words(f.piece), square: words(f.target)}) : null;
    case "king_flights": return make("flights", {lead, squares: join(strings(f.opened))});
    case "castling": return make("castle", {lead, square: words(f.after)});
    case "bishop_pair": return make("bishops", {lead, side: words(f.side)});
    case "doubled_files": return strings(f.after).length
      ? make("doubled", {lead, side: words(f.side), files: join(strings(f.after))}) : null;
    default: return null;
  }
}

export function tacticalClaim(event: Event, move: string, best: string, opponent: string): Claim | null {
  const f = event.facts, role = f.role;
  if (role === "caused") return causalClaim(event, move);
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
  const result = claim(`tactic_${role}`, {move, best, opponent, motif: words(f.motif), detail},
    role === "allowed" ? 94 : role === "missed" ? 91 : 83, event.evidence, [event.id]);
  if (event.actor !== "white" && event.actor !== "black") return result;
  const witness = Array.isArray(f.witness) ? f.witness.map(object) : [];
  const expectedPly = role === "allowed" ? 2 : 1;
  const first = witness[0];
  // A reference board alone says nothing about when a tactic is available. A
  // multi-ply witness can include both an immediate fork and its later collection.
  const immediate = event.confidence === "line_witness" && Array.isArray(f.plies) &&
    f.plies.length === 1 && f.plies[0] === expectedPly && f.frame_ply === expectedPly &&
    witness.length === 1 && first.ply === expectedPly && typeof first.san === "string" &&
    !!first.san && (role === "allowed" || first.san === (role === "missed" ? best : move));
  const forkTargets = [...new Set(targets.filter(p => /^[a-h][1-8]$/.test(p.square) &&
    ["white", "black"].includes(String(p.color)) &&
    ["pawn", "knight", "bishop", "rook", "queen", "king"].includes(String(p.piece)))
    .map(p => `${p.piece} on ${p.square}`))].slice(0, 3);
  const capture = witness.find(frame => Number.isInteger(frame.ply) && Number(frame.ply) > 0 &&
    typeof frame.san === "string" && frame.san &&
    ["pawn", "knight", "bishop", "rook", "queen"].includes(String(frame.capture)));
  return {...result, tactic: {timing: immediate ? "immediate" : "possible", actor: event.actor,
    ...(immediate ? {action: String(first.san)} : {}),
    effect: f.motif === "fork" && forkTargets.length >= 2 ? {kind: "fork", targets: forkTargets}
      : typeof f.settled_material_delta === "number" && Number.isFinite(f.settled_material_delta) && f.settled_material_delta > 0
        ? {kind: "material"}
        : capture ? {kind: "capture", san: String(capture.san), piece: String(capture.capture), ply: Number(capture.ply)}
          : {kind: "none"}}};
}

function causalClaim(event: Event, move: string): Claim | null {
  const f = event.facts, roles = object(f.roles), pieces = object(f.pieces);
  const witness = Array.isArray(f.witness) ? f.witness.map(object) : [];
  const first = witness.find(frame => frame.ply === 1), reply = witness.find(frame => frame.ply === 2);
  const opponent = event.actor === "white" ? "Black" : "White";
  if (f.opportunity_actor !== opponent.toLowerCase() || !reply?.san || !reply.capture) return null;
  const side = event.actor === "white" ? "White" : "Black";
  const slots = {move, side, opponent, reply: String(reply.san)};
  const make = (code: string, detail: Claim["slots"]) => claim(code, {...slots, ...detail}, 95, event.evidence, [event.id]);
  if (f.motif === "avoiding_bad_trades") {
    const moved = object(pieces[strings(roles.moved_piece)[0]]);
    return moved.color === event.actor && moved.piece && first?.capture
      ? make("cause_avoiding_bad_trades", {piece: String(moved.piece), captured: String(first.capture)}) : null;
  }
  const square = strings(roles.target)[0], target = object(pieces[square]);
  if (target.color !== event.actor || !target.piece) return null;
  const detail = {piece: String(target.piece), square};
  if (f.motif === "abandoned_defender") return make("cause_abandoned_defender", detail);
  if (f.motif === "opponent_threat_recognition" && f.context_fen && f.context_move)
    return make("cause_opponent_threat_recognition", detail);
  return null;
}
