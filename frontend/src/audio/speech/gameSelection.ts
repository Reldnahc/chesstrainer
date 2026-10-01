import type {Schema} from "../../api";
import type {Game, Position, Report} from "../../gameReview/types";
import {gameIntent} from "../../dialogue/gameIntent";
import {humanClaims, humanInsightLabels} from "../../dialogue/humanClaims";
import {object, strings} from "../../dialogue/eventClaims";
import type {Claim, CoachUtterance, DialogueIntent} from "../../dialogue/model";

export type WalterGameSpeechContext = {
  game: Game;
  report?: Report | null;
  frame?: Position | null;
  ply: number;
  variation?: boolean;
  intent: DialogueIntent;
  utterance: CoachUtterance;
  /** An unresolved request for this position, not a background game review. */
  pending?: boolean;
  error?: boolean;
  surface?: "bubble" | "human-insight";
  /** Explicit replay of another visible claim; never search for a fallback. */
  claimIndex?: number;
};
type Event = Schema["ReviewEvent"];
const opposite = (side: "white" | "black") => side === "white" ? "black" : "white";
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const square = (value: unknown): value is string => typeof value === "string" && /^[a-h][1-8]$/.test(value);
const files = (value: unknown, allowEmpty = false) => Array.isArray(value) && (allowEmpty || value.length > 0)
  && value.every(f => typeof f === "string" && /^[a-h]$/.test(f));
const squares = (value: unknown, allowEmpty = false) => Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(square);
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.entries(a), right = Object.entries(b);
  return left.length === right.length && left.every(([key, value]) => Object.hasOwn(b, key) && same(value, (b as Record<string, unknown>)[key]));
}
const evidenced = (item: Claim) => item.evidence.length > 0 && item.evidence.every(ref => nonempty(ref.id) && nonempty(ref.field));
const searchEvidence = (item: Claim) => evidenced(item) && item.evidence.some(ref => ref.source === "stockfish");

const simpleIds: Readonly<Record<string, string>> = {
  allowed_mate: "allowed-mate", missed_mate: "missed-mate", sacrifice: "sound-sacrifice",
  only_move: "only-playable-move", decisive_resource: "only-advantage-resource",
  reply_capture: "immediate-capture", reply_check: "reply-check", alternative: "stronger-alternative",
  loss: "evaluation-loss", best: "best-supported-choice", good: "good-choice",
  human_natural_error: "human-natural-error", human_rare: "human-unusual-strong",
  difficult_defense: "human-hard-defense-missed", human_challenging: "human-hard-find",
  human_defense_found: "human-hard-defense-found", human_natural_best: "human-natural-best",
  human_natural_strong: "human-natural-strong", clock_low: "clock-low", clock_fast: "clock-fast",
  clock_long: "clock-long", book: "recognized-opening", book_sound: "recognized-opening",
  departure: "opening-departure", punishment: "chance-taken", missed_punishment: "chance-missed",
  repeated: "repeated-issue", support_restored: "support-restored", erosion: "gradual-erosion",
  conversion: "advantage-converted", history: "saved-history-recurrence",
};
const tacticalMotifs = new Set(["fork", "pin", "skewer", "removing_defender", "back_rank", "promotion_awareness",
  "discovered_attack", "double_attack", "deflection"]);
const causes = new Set(["abandoned_defender", "opponent_threat_recognition", "avoiding_bad_trades"]);

function eventFor(item: Claim, report: Report): Event | undefined {
  if (item.sourceIds.length !== 1) return;
  const matches = report.intelligence?.events.filter(event => event.id === item.sourceIds[0]) ?? [];
  return matches.length === 1 && same(matches[0].evidence, item.evidence) ? matches[0] : undefined;
}

function tacticalRecording(item: Claim, event: Event, mover: "white" | "black", report: Report): string | null {
  const f = event.facts, role = f.role, motif = String(f.motif);
  if (event.kind !== "tactic" || event.confidence !== "line_witness" || !searchEvidence(item)) return null;
  // The grade only rejects a contradictory role; it cannot invent a tactic.
  const poor = ["Inaccuracy", "Mistake", "Miss", "Blunder"].includes(report.engine_label ?? report.label);
  if ((role === "played" && poor) || (["allowed", "caused", "missed"].includes(String(role)) && !poor)) return null;
  const source = role === "missed" ? "best" : "actual";
  if (!item.evidence.some(ref => ref.source === "stockfish" && ref.field.startsWith(`${source}_line/findings/`))
    || !item.evidence.some(ref => ref.source === "rule" && ref.field === "verified_witness")
    || !Array.isArray(f.plies) || !f.plies.length || !f.plies.every(ply => typeof ply === "number" && Number.isInteger(ply) && ply >= 1)
    || !Array.isArray(f.witness) || f.witness.length !== f.plies.length
    || !same(f.witness.map(frame => object(frame).ply), f.plies)
    || !["verified_line", "engine_mate", "engine_defense"].includes(String(f.verification))) return null;
  if (role === "caused") {
    if (!causes.has(motif) || item.code !== `cause_${motif}` || event.actor !== mover
      || f.opportunity_actor !== opposite(mover) || f.frame_ply !== 0 || !same(f.plies, [1, 2])) return null;
    const witness = f.witness.map(object), first = witness.find(frame => frame.ply === 1), reply = witness.find(frame => frame.ply === 2);
    if (!nonempty(reply?.capture) || reply?.san !== item.slots.reply || first?.san !== report.actual.san) return null;
    return `cause-${motif.replaceAll("_", "-")}`;
  }
  if (!["played", "allowed", "missed"].includes(String(role)) || item.code !== `tactic_${role}`
    || event.actor !== (role === "allowed" ? opposite(mover) : mover)
    || (role === "missed" && report.actual.uci === report.best.uci)) return null;
  if (tacticalMotifs.has(motif)) return `tactic-${motif.replaceAll("_", "-")}-${role}`;
  if (motif === "missed_tactical_capture" && role !== "allowed") return `tactic-undefended-capture-${role}`;
  if (motif === "hanging_piece" && role === "allowed") return "tactic-hanging-piece-allowed";
  return null;
}

function positionalRecording(item: Claim, event: Event, mover: "white" | "black", report: Report): string | null {
  const f = event.facts, line = item.position?.line;
  if (event.kind !== "positional" || event.confidence !== "board_fact" || event.actor !== mover
    || !searchEvidence(item) || !["white", "black"].includes(String(f.side))
    || !item.evidence.some(ref => ref.source === "position" && ref.field === "immediate_transition")
    || !line || f.line !== (line === "actual" ? "actual" : "best")
    || f.uci !== report[line === "actual" ? "actual" : "best"].uci
    || item.position?.move !== report[line === "actual" ? "actual" : "best"].san
    || (line === "alternative" && report.actual.uci === report.best.uci)
    || (item.slots.side !== undefined && item.slots.side !== f.side)) return null;
  let name: string | null = null;
  switch (f.feature) {
    case "first_development":
      if (["bishop", "knight"].includes(String(f.piece)) && f.side === mover && square(f.before) && square(f.after)
        && item.evidence.some(ref => ref.source === "pgn" && ref.field === "original_minor_piece_history")) name = "development";
      break;
    case "rook_file":
      if (files([f.file]) && ["open", "semi_open"].includes(String(f.after))) name = f.after === "open" ? "rook-open" : "rook-semi-open";
      break;
    case "passed_pawns": if (squares(f.added)) name = "passed"; break;
    case "isolated_pawns": if (squares(f.added)) name = "isolated"; break;
    case "passed_pawn_advance":
      if (f.side === mover && square(f.before) && square(f.after) && String(f.uci).length === 4) name = "passer-advance";
      break;
    case "piece_support":
      if (square(f.target) && ["knight", "bishop", "rook", "queen"].includes(String(f.piece))
        && squares(f.before, true) && squares(f.after, true)) {
        if (!strings(f.before).length && strings(f.after).length) name = "support";
        if (strings(f.before).length && !strings(f.after).length) name = "unsupported";
      }
      break;
    case "king_flights": if (f.side === mover && squares(f.opened)) name = "king-flight"; break;
    case "castling": if (f.side === mover && square(f.before) && square(f.after)) name = "castling"; break;
    case "bishop_pair": if (f.side === opposite(mover) && f.before === 2 && f.after === 1) name = "bishop-pair"; break;
    case "doubled_files": if (files(f.before, true) && files(f.after) && !same(f.before, f.after)) name = "doubled"; break;
  }
  return name ? `positional-${name}-${line}` : null;
}

function terminalRecording(item: Claim, {frame, game}: WalterGameSpeechContext): string | null {
  if (!frame?.termination || !evidenced(item) || !item.evidence.some(ref => ref.source === "position"
    && ref.id === frame.fen && ref.field === "automatic_outcome")) return null;
  if (item.code === "draw") return frame.result === "1/2-1/2" ? "draw" : null;
  if (frame.termination !== "checkmate" || !["1-0", "0-1"].includes(frame.result ?? "") || frame.legal_moves.length) return null;
  const winner = frame.result === "1-0" ? "white" : "black";
  if (frame.turn === winner) return null;
  return item.code === (winner === game.orientation ? "mate_win" : "mate_loss")
    ? winner === game.orientation ? "mate-finished" : "mate-defense-ended" : null;
}

function legalReplyRecording(item: Claim, {frame, report}: WalterGameSpeechContext): string | null {
  const cues = report?.board_cues, uci = cues?.caption_reply_uci;
  if (item.code !== "explanation" || !frame || !report || !cues || cues.caption_kind !== "legal_reply"
    || cues.fen !== frame.fen || report.actual.san !== frame.san || !uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)
    || report.immediate_reply?.uci !== uci || !frame.legal_moves.some(move => move.from_square === uci.slice(0, 2)
      && move.to_square === uci.slice(2, 4) && (move.promotion ?? "") === uci.slice(4))) return null;
  return "game-explanation-legal-reply";
}

/** Facts select whole recordings; prose, portrait expression and grade never select audio. */
export function selectWalterGameRecording(context: WalterGameSpeechContext): string | null {
  const {game, report, frame, ply, variation = false, intent, utterance, pending, error, surface = "bubble", claimIndex = 0} = context;
  if (pending || !frame || !nonempty(frame.fen) || utterance.coachId !== "classic"
    || utterance.intentId !== intent.id
    || !Number.isInteger(claimIndex) || claimIndex < 0 || (surface === "human-insight" && claimIndex !== 0)) return null;
  const item = utterance.renderedClaims?.[claimIndex], trace = utterance.trace.variants[claimIndex];
  if (!item || !trace || trace.code !== item.code || !same(trace.sourceIds, item.sourceIds)
    || !intent.claims.some(candidate => same(candidate, item))) return null;
  if (!variation && game.frames[ply]?.fen !== frame.fen) return null;
  const mode = variation ? "variation" : "game";
  if (surface === "bubble" && claimIndex === 0 && !report && intent.mode === mode) {
    // These finite no-report messages are replayable, never automatically spoken.
    // The exact fresh branch excludes arbitrary legacy compatibility prose.
    const status = gameIntent({game, frame, ply, variation, error, pending: false,
      key: "speech-status-validation", expression: intent.expression});
    if (!status.claims.some(candidate => same(candidate, item))) return null;
    if (item.code === "unavailable" && error) return "game-unavailable";
    if (item.code === "compatibility" && !error) return game.job?.status === "cancelled"
      ? "game-review-paused" : "game-browse-instructions";
  }
  if (error || !utterance.autoSpeakSuitable) return null;
  if (intent.mode === "explanation") {
    if (surface !== "bubble" || claimIndex !== 0) return null;
    const explanation = gameIntent({game, report, frame, ply, variation, explaining: true,
      key: "speech-explanation-validation", expression: intent.expression});
    return explanation.claims.some(candidate => same(candidate, item)) ? legalReplyRecording(item, context) : null;
  }
  if (intent.mode !== mode) return null;
  // Refresh through the existing producer, rather than maintaining a second
  // interpretation of analysis/context or treating an old utterance as truth.
  const fresh = gameIntent({game, report, frame, ply, variation, key: "speech-validation", expression: intent.expression});
  if (!fresh.claims.some(candidate => same(candidate, item))) return null;
  if (["mate_win", "mate_loss", "draw"].includes(item.code)) return terminalRecording(item, context);
  if (!report?.intelligence || !nonempty(report.intelligence.input_digest) || frame.san !== report.actual.san
    || (report.board_cues && report.board_cues.fen !== frame.fen)
    || (report.intelligence.ply !== null && report.intelligence.ply !== ply)) return null;
  const mover = opposite(frame.turn);
  if (surface === "human-insight" && !humanInsightLabels[item.code]) return null;
  if (humanInsightLabels[item.code]) return mover === game.orientation && searchEvidence(item)
    && humanClaims(report, ply, mover).some(candidate => same(candidate, item)) ? simpleIds[item.code] ?? null : null;
  const event = eventFor(item, report);
  if (item.code.startsWith("tactic_") || item.code.startsWith("cause_"))
    return event ? tacticalRecording(item, event, mover, report) : null;
  if (item.position) return event ? positionalRecording(item, event, mover, report) : null;
  if (!evidenced(item)) return null;
  if (item.code === "book" || item.code === "book_sound") return report.opening
    && nonempty(report.opening.version) ? "recognized-opening" : null;
  if (event) {
    if (event.actor !== mover) return null;
    if (item.code === "allowed_mate" || item.code === "missed_mate") return event.kind === "mate" && event.confidence === "searched"
      && searchEvidence(item) && event.facts.transition === (item.code === "allowed_mate" ? "allowed" : "missed") ? simpleIds[item.code] : null;
    if (item.code === "sacrifice") return event.kind === "sacrifice" && event.confidence === "searched"
      && item.evidence.some(ref => ref.source === "stockfish" && ref.field === "acceptance_search") ? simpleIds[item.code] : null;
    if (["only_move", "decisive_resource"].includes(item.code)) return event.kind === "critical_resource" && event.confidence === "searched"
      && searchEvidence(item) && Number(event.facts.only_good_at_depth) > 0 ? simpleIds[item.code] : null;
    if (item.code.startsWith("clock_")) return !variation && event.kind === "clock_observation" ? simpleIds[item.code] ?? null : null;
    if (item.code === "departure") return !variation && event.kind === "opening_departure" ? "opening-departure" : null;
    return null;
  }
  if (["recovery", "punishment", "missed_punishment", "repeated", "support_restored", "erosion", "conversion", "history"].includes(item.code)) {
    // Fresh gameIntent above enforces current node generation, actor and relation
    // endpoint (and supported history); branches never inherit those relationships.
    if (variation || mover !== game.orientation || !item.sourceIds.length) return null;
    return item.code === "recovery" ? item.slots.help ? "recovery-assisted" : "recovery" : simpleIds[item.code];
  }
  // Source-backed event codes must not bypass their validation when an event ID
  // is absent or ambiguous. Only these direct report claims have no event ID.
  return ["reply_capture", "reply_check", "alternative", "loss", "best", "good"].includes(item.code)
    && searchEvidence(item) ? simpleIds[item.code] ?? null : null;
}
