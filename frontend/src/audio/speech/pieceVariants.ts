import type {ExplanationFrame, MoveExplanation, PatternFinding, Schema} from "../../api";
import {object, strings} from "../../dialogue/eventClaims";
import catalogue from "./meanings.json" with {type: "json"};
import {ALTERNATIVE_SEPARATOR, SEQUENCE_SEPARATOR} from "./sequence";

type Side = "white" | "black";
type Event = Schema["ReviewEvent"];
type Meaning = {id: string; variantOf?: string; pieces?: string[]};

// A piece variant names the one piece its meaning is about ("the pinned knight")
// instead of a generic "piece". The catalogue lists every piece that can occur.
const variants = new Map<string, Map<string, string>>();
for (const meaning of catalogue.meanings as Meaning[]) {
  if (!meaning.variantOf || !meaning.pieces) continue;
  const set = variants.get(meaning.variantOf) ?? new Map<string, string>();
  set.set(meaning.pieces.join("-"), meaning.id);
  variants.set(meaning.variantOf, set);
}

export const hasPieceVariants = (id: string) => variants.has(id);

/** The variant naming these pieces, then the generic line. Unknown pieces keep the generic line. */
export function withPieceVariant(id: string, pieces: readonly string[] | null | undefined): string {
  const variant = pieces?.length ? variants.get(id)?.get(pieces.join("-")) : undefined;
  return variant ? `${variant}${ALTERNATIVE_SEPARATOR}${id}` : id;
}

/** Applies a variant to each sentence of a sequence that has one. */
export function withPieceVariants(id: string, pieces: ReadonlyMap<string, readonly string[]>): string {
  return id.split(SEQUENCE_SEPARATOR).map(part => withPieceVariant(part, pieces.get(part))).join(SEQUENCE_SEPARATOR);
}

const opposite = (side: Side): Side => side === "white" ? "black" : "white";
const order = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const letters: Record<string, string> = {p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king"};

/** The piece standing on a square of a FEN board, or null. */
export function pieceOn(fen: string | null | undefined, square: string): {piece: string; color: Side} | null {
  if (!fen || !/^[a-h][1-8]$/.test(square)) return null;
  const rows = fen.split(" ")[0]?.split("/");
  if (rows?.length !== 8) return null;
  const row = rows[8 - Number(square[1])], file = square.charCodeAt(0) - 97;
  let column = 0;
  for (const char of row) {
    if (/\d/.test(char)) { column += Number(char); continue; }
    if (column === file) {
      const piece = letters[char.toLowerCase()];
      return piece ? {piece, color: char === char.toLowerCase() ? "black" : "white"} : null;
    }
    column++;
  }
  return null;
}

type Lookup = (square: string) => {piece?: unknown; color?: unknown} | null;

/** One piece type shared by every square of a role, all of the expected side. */
function single(squares: string[], side: Side, at: Lookup): string[] | null {
  const found = squares.map(at);
  if (!squares.length || !found.every(item => item?.color === side && order.includes(String(item.piece)))) return null;
  const types = new Set(found.map(item => String(item!.piece)));
  return types.size === 1 ? [...types] : null;
}

/** Two checking pieces, named in a fixed order ("knight-rook"). */
function pair(squares: string[], side: Side, at: Lookup): string[] | null {
  const found = squares.map(at);
  if (squares.length !== 2 || !found.every(item => item?.color === side && order.includes(String(item.piece)))) return null;
  return found.map(item => String(item!.piece)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Where a pattern's subject piece is recorded in its witness roles. */
function subject(kind: string, roles: Record<string, unknown>, actor: Side, at: Lookup, moved?: string): string[] | null {
  const role = (key: string) => strings(roles[key]);
  const own = (key: string) => single(role(key), actor, at), theirs = (key: string) => single(role(key), opposite(actor), at);
  switch (kind) {
    case "fork": return own("attacker");
    // Upstream pins name the pinned piece; a collected pin's target is the pinned piece.
    case "pin": return role("pinned_defender").length ? theirs("pinned_defender") : role("king").length ? theirs("target") : null;
    case "pin_target": return theirs("target");
    case "pinned": return theirs("pinned_defender");
    // The front piece of a skewer; the king when the skewer gives check.
    case "skewer": {
      if (role("targets").length === 2) return single(role("targets").filter(square => !role("target").includes(square)), opposite(actor), at);
      return role("king").length ? theirs("king") : null;
    }
    case "discovered_attack": return role("blocker").length ? own("blocker") : own("moved_piece");
    case "capture": return theirs("target");
    case "defender": return theirs("defender");
    case "back_rank": return role("attacker").length ? own("attacker") : own("attackers");
    case "own_target": return own("target");
    case "moved": return own("moved_piece");
    case "slider": return own("attacker");
    case "double_check": return pair(role("attackers"), actor, at);
    // The second attacker of a discovered double attack is the one that did not move.
    case "second": return moved ? single(role("attackers").filter(square => square !== moved), actor, at) : null;
    case "relative_pin": return theirs("attacker");
    default: return null;
  }
}

const tacticSubjects: Record<string, string> = {
  fork: "fork", pin: "pin", skewer: "skewer", discovered_attack: "discovered_attack",
  missed_tactical_capture: "capture", hanging_piece: "capture", removing_defender: "defender",
  deflection: "defender", back_rank: "back_rank", abandoned_defender: "own_target",
  opponent_threat_recognition: "own_target", avoiding_bad_trades: "moved",
};

/** The subject piece of a game-review tactic, from its witness roles and pieces. */
export function tacticPieces(event: Event): string[] | null {
  const f = event.facts, kind = tacticSubjects[String(f.motif)], pieces = object(f.pieces);
  if (!kind || (event.actor !== "white" && event.actor !== "black")) return null;
  return subject(kind, object(f.roles), event.actor, square => object(pieces[square]));
}

const findingSubjects: Record<string, string> = {
  fork_recognized: "fork", fork_collected: "fork", pin_prevents_capture: "pinned", pin_restricts_escape: "pinned",
  pin_collected: "pin_target", skewer_collected: "skewer", king_skewer_collected: "capture",
  defender_captured: "defender", sole_defender_captured: "defender", deflection: "defender",
  deflection_collected: "capture", discovered_capture: "slider", discovered_check: "slider",
  double_check: "double_check", double_attack_collected: "second", undefended_capture: "capture",
  undefended_capture_gain: "capture", back_rank_mate: "back_rank", abandoned_defender: "own_target",
  unfavorable_exchange: "moved", relative_pin_released: "relative_pin",
};

/** The subject piece of an explanation finding, read from the board its roles describe. */
export function findingPieces(data: MoveExplanation, finding: PatternFinding): string[] | null {
  const kind = finding.mechanism ? findingSubjects[finding.mechanism] : undefined;
  const fen = data.frames[finding.frame_ply]?.fen;
  if (!kind || !fen || !finding.roles) return null;
  return subject(kind, finding.roles, finding.actor, square => pieceOn(fen, square), finding.moves[0]?.slice(2, 4));
}

/** The piece a capture frame takes. */
export function capturedPieces(frame: ExplanationFrame): string[] | null {
  return frame.capture && order.includes(frame.capture) ? [frame.capture] : null;
}

/** The piece a sound sacrifice offers: the one its accepting capture takes. */
export function sacrificedPieces(acceptance: unknown, fen: string | null | undefined, mover: Side): string[] | null {
  const square = typeof acceptance === "string" ? acceptance.slice(2, 4) : null, found = square ? pieceOn(fen, square) : null;
  return found && found.color === mover ? [found.piece] : null;
}
