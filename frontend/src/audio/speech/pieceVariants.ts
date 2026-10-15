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
const named = new Map<string, readonly string[]>();
for (const meaning of catalogue.meanings as Meaning[]) {
  if (!meaning.variantOf || !meaning.pieces) continue;
  named.set(meaning.id, meaning.pieces);
  const set = variants.get(meaning.variantOf) ?? new Map<string, string>();
  set.set(meaning.pieces.join("-"), meaning.id);
  variants.set(meaning.variantOf, set);
}

export const hasPieceVariants = (id: string) => variants.has(id);

/** The variant naming these pieces, then the generic line. Unknown pieces keep the generic line. */
export function withPieceVariant(id: string, pieces: readonly string[] | null | undefined): string {
  const variant = pieceVariantId(id, pieces);
  return variant ? `${variant}${ALTERNATIVE_SEPARATOR}${id}` : id;
}

/** The piece variant a line would play for these pieces, if there is one. */
export const pieceVariantId = (id: string, pieces: readonly string[] | null | undefined) =>
  pieces?.length ? variants.get(id)?.get(pieces.join("-")) : undefined;

/** Squares of named pieces, keyed by the piece variant that names them. */
export type Squares = ReadonlyMap<string, string>;

/** Writes the square after the one piece a variant names ("the bishop on e4").
 * Only the bubble shows it; the recording stays as spoken. A line that names
 * the piece more than once, only in the possessive, or followed by "on" or a
 * noun the square cannot describe ("knight fork") is left as it is. In a
 * compound offer the square follows the whole noun ("a rook sacrifice on e4"). */
export function withSquares(id: string, text: string, squares: Squares | undefined): string {
  const square = squares?.get(id), pieces = named.get(id);
  if (!square || pieces?.length !== 1) return text;
  const found = [...text.matchAll(new RegExp(`\\b${pieces[0]}\\b`, "gi"))];
  if (found.length !== 1) return text;
  let end = found[0].index + found[0][0].length;
  const rest = text.slice(end);
  if (/^['’]s\b/.test(rest) || /^\s+(on|forks?|pairs?|trades?)\b/i.test(rest)) return text;
  const compound = /^\s+(sacrifices?|sac|offers?)\b/i.exec(rest);
  if (compound) end += compound[0].length;
  return `${text.slice(0, end)} on ${square}${text.slice(end)}`;
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

/** The pieces a line names, and the square of that piece when it is just one. */
export type NamedPieces = {pieces: string[]; square?: string};

/** One piece type shared by every square of a role, all of the expected side. */
function single(squares: string[], side: Side, at: Lookup): NamedPieces | null {
  const found = squares.map(at);
  if (!squares.length || !found.every(item => item?.color === side && order.includes(String(item.piece)))) return null;
  const types = new Set(found.map(item => String(item!.piece)));
  return types.size === 1 ? {pieces: [...types], ...(squares.length === 1 ? {square: squares[0]} : {})} : null;
}

/** Two checking pieces, named in a fixed order ("knight-rook"). */
function pair(squares: string[], side: Side, at: Lookup): NamedPieces | null {
  const found = squares.map(at);
  if (squares.length !== 2 || !found.every(item => item?.color === side && order.includes(String(item.piece)))) return null;
  return {pieces: found.map(item => String(item!.piece)).sort((a, b) => order.indexOf(a) - order.indexOf(b))};
}

/** Where a pattern's subject piece is recorded in its witness roles. */
function subject(kind: string, roles: Record<string, unknown>, actor: Side, at: Lookup, moved?: string): NamedPieces | null {
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
export function tacticPieces(event: Event): NamedPieces | null {
  const f = event.facts, kind = tacticSubjects[String(f.motif)], pieces = object(f.pieces);
  if (!kind || (event.actor !== "white" && event.actor !== "black")) return null;
  const named = subject(kind, object(f.roles), event.actor, square => object(pieces[square]));
  // A tactic's attacker may still have to move there, so only a piece that stays put keeps its square.
  return named && !standing.has(kind) ? {pieces: named.pieces} : named;
}

/** Subjects that stand on their square before the tactic: its targets and defenders. */
const standing = new Set(["pin", "pin_target", "pinned", "skewer", "capture", "defender", "own_target"]);

const finding = (subject?: string, id?: string) => ({...(subject ? {subject} : {}), ...(id ? {id} : {})});
/** Every explanation finding mechanism with a recorded meaning: the piece it is
 * about (when its line names one), and the game-review clip it borrows (otherwise its own
 * explanation-finding-* line). Practice selection and piece variants both read
 * this one table. A "promotion" finding is the promoting move itself, which the
 * game bank's promotion clips describe as a pawn still on its way, so it has none. */
export const FINDING_MEANINGS: Readonly<Record<string, {subject?: string; id?: string}>> = {
  fork_recognized: finding("fork", "tactic-fork-played"), fork_collected: finding("fork"),
  pin_prevents_capture: finding("pinned"), pin_restricts_escape: finding("pinned"),
  pin_defenders_no_recapture: finding(), pin_collected: finding("pin_target"),
  skewer_collected: finding("skewer"), king_skewer_collected: finding("capture"),
  defender_captured: finding("defender", "tactic-removing-defender-played"), sole_defender_captured: finding("defender"),
  deflection: finding("defender", "tactic-deflection-played"), deflection_collected: finding("capture"),
  discovered_capture: finding("slider"), discovered_check: finding("slider"), double_check: finding("double_check"),
  double_attack_collected: finding("second"), promotion_material_retained: finding(),
  undefended_capture: finding("capture", "tactic-undefended-capture-played"), undefended_capture_gain: finding("capture"),
  back_rank_mate: finding("back_rank", "tactic-back-rank-played"),
  abandoned_defender: finding("own_target", "cause-abandoned-defender"),
  unfavorable_exchange: finding("moved", "cause-avoiding-bad-trades"), relative_pin_released: finding("relative_pin"),
};

/** The recorded meaning of an explanation finding mechanism, if it has one. */
export const findingMeaningId = (mechanism: string | null | undefined) => {
  const meaning = mechanism ? FINDING_MEANINGS[mechanism] : undefined;
  return meaning ? meaning.id ?? `explanation-finding-${mechanism!.replaceAll("_", "-")}` : null;
};

/** The subject piece of an explanation finding, read from the board its roles describe. */
export function findingPieces(data: MoveExplanation, finding: PatternFinding): NamedPieces | null {
  const kind = finding.mechanism ? FINDING_MEANINGS[finding.mechanism]?.subject : undefined;
  const fen = data.frames[finding.frame_ply]?.fen;
  if (!kind || !fen || !finding.roles) return null;
  return subject(kind, finding.roles, finding.actor, square => pieceOn(fen, square), finding.moves[0]?.slice(2, 4));
}

/** The piece a capture frame takes, on the square it stood. A frame highlights
 * from and to, then the captured square when it differs (en passant). */
export function capturedPieces(frame: Pick<ExplanationFrame, "capture" | "highlights">): NamedPieces | null {
  if (!frame.capture || !order.includes(frame.capture)) return null;
  const square = frame.highlights?.[2] ?? frame.highlights?.[1];
  return {pieces: [frame.capture], ...(square && /^[a-h][1-8]$/.test(square) ? {square} : {})};
}

/** The piece a sound sacrifice offers: the one its accepting capture takes. */
export function sacrificedPieces(acceptance: unknown, fen: string | null | undefined, mover: Side): NamedPieces | null {
  const square = typeof acceptance === "string" ? acceptance.slice(2, 4) : null, found = square ? pieceOn(fen, square) : null;
  return found && found.color === mover ? {pieces: [found.piece], square: square!} : null;
}
