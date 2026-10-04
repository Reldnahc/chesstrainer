import type { Game, Position, Report } from "../gameReview/types";
import type {CoachExpression} from "../coach/model";
import {scoreText} from "../evaluation";
import {claim, makeIntent, type Claim, type DialoguePurpose, type EvidenceRef} from "./model";
import {positionalClaim, tacticalClaim, words} from "./eventClaims";
import {humanClaims} from "./humanClaims";
import {deriveBookPresentation} from "./openingPresentation";

const purposes: Record<Report["label"], DialoguePurpose> = {
  Brilliant: "brilliant", Great: "great", Best: "best", Good: "good", Book: "book",
  Inaccuracy: "inaccuracy", Mistake: "mistake", Blunder: "blunder", Miss: "missed",
};

function moveLabel(game: Game, ply: number) {
  const frame = game.frames[ply];
  return frame ? `${frame.number}${frame.actor === "black" ? "..." : "."} ${frame.san}` : `Ply ${ply}`;
}

/** The coach's dialogue never carries a Maia (human-move model) reading; only
 * the separate Maia tag and popup ask for it, with `human`. */
export function gameIntent({game, report, frame, ply, key, expression, explaining = false,
  variation = false, error = false, pending = false, human = false}: {
  game: Game; report?: Report | null; frame?: Position | null; ply: number; key: string;
  expression: CoachExpression; explaining?: boolean; variation?: boolean; error?: boolean; pending?: boolean;
  human?: boolean;
}) {
  const mode = variation ? "variation" : "game";
  if (explaining && report?.board_cues)
    return makeIntent(key, "explanation", "explanation", "explaining", [claim("explanation", {detail: report.board_cues.caption}, 75)], ["show_why_uses_current_board_cues"]);
  if (frame?.termination && frame.result) {
    const kind = frame.result === "1/2-1/2" ? "draw" : expression === "winning" ? "mate_win" : "mate_loss";
    return makeIntent(key, kind === "draw" ? "draw" : expression === "winning" ? "winning" : "losing", mode, expression,
      [claim(kind, {}, 100, [{source: "position", id: frame.fen, field: "automatic_outcome", ply}])]);
  }
  if (!report) {
    if (error) return makeIntent(key, "uncertain", mode, "uncertain", [claim("unavailable")]);
    const code = pending ? "thinking" : "compatibility";
    const detail = game.job?.status === "cancelled" ? "Your review is paused. Resume it below, or move a piece to explore."
      : "Select a move or move a piece to explore an alternative.";
    return makeIntent(key, pending ? "thinking" : "neutral", mode, expression, [claim(code, {detail})]);
  }
  const mover = frame?.turn === "white" ? "black" : frame?.turn === "black" ? "white"
    : !variation ? game.frames[ply]?.actor : null;
  const learnerMove = !!mover && mover === game.orientation;
  const subject = learnerMove ? "learner" : mover ? "opponent" : "position";
  let purpose: DialoguePurpose = learnerMove ? purposes[report.label] : "explanation";
  // Recognized theory is shared by both players; it is not personal praise.
  // Keep the incoming reaction so check and explicit explanations still win.
  if (!learnerMove && !(mover && report.label === "Book")) expression = "explaining";
  const poor = ["Inaccuracy", "Mistake", "Miss", "Blunder"].includes(report.engine_label ?? report.label);
  const side = mover === "white" ? "White" : mover === "black" ? "Black" : "The mover";
  const opponent = mover === "white" ? "Black" : mover === "black" ? "White" : "The opponent";
  const move = report.actual.san, best = report.best.san;
  const claims: Claim[] = [];
  const events = report.intelligence?.events ?? [];
  const node = !variation ? game.context?.nodes.find(n => n.ply === ply && n.input_digest === report.intelligence?.input_digest) : undefined;
  const refs: EvidenceRef[] = node?.evidence ?? (report.practical?.stockfish_analysis_ids ?? []).map(id => ({source: "stockfish", id, field: "candidate_search", ply}));
  for (const event of events) {
    const f = event.facts;
    const add = (code: string, slots: Claim["slots"], priority: number) => claims.push(claim(code, slots, priority, event.evidence, [event.id]));
    if (event.kind === "mate") add(f.transition === "allowed" ? "allowed_mate" : "missed_mate",
      {best, opponent, reply: report.immediate_reply ? `${opponent}'s strongest reply is ${report.immediate_reply.san}.` : ""}, 100);
    if (event.kind === "tactic") {
      const item = tacticalClaim(event, move, best, opponent);
      if (item) claims.push(item);
    }
    if (event.kind === "sacrifice") add("sacrifice", {}, 90);
    if (event.kind === "critical_resource") {
      add(f.purpose === "defense" ? "only_move" : "decisive_resource", {}, 93);
      if (learnerMove) purpose = f.difficult ? "difficult_defense" : "only_move";
    }
    if (event.kind === "positional") {
      // Positive explanations describe the played move; errors can compare the better candidate.
      if ((!poor && f.line !== "actual") || (poor && f.line === "actual" && f.feature === "first_development")) continue;
      const item = positionalClaim(event, move, best);
      if (item) claims.push(item);
    }
    if (event.kind === "opening_departure" && !report.opening) add("departure", {}, 48);
  }
  if (report.opening) {
    const opening = deriveBookPresentation({game, report, frame, ply, variation});
    claims.push({...claim(poor ? "book" : "book_sound", {opening: report.opening.name || "a recognized opening line"}, poor ? 49 : 96,
      [{source: "book", id: report.opening.version, field: "recognized_opening", ply}]), ...(opening ? {opening} : {})});
  }
  const practical = report.practical;
  // The graph remains two-sided. Personal relationships require the saved
  // learner, a matching evidence generation and an actual learner move.
  if (!variation && node && learnerMove && node.actor === game.orientation) {
    for (const relation of game.context?.relationships ?? []) {
      if (relation.plies.at(-1) !== ply || relation.actor !== game.orientation) continue;
      const earlier = moveLabel(game, relation.plies[0]), f = relation.facts;
      const linked = (code: string, slots: Claim["slots"], priority: number) => claims.push(claim(code, slots, priority, relation.evidence, [relation.id]));
      if (relation.kind === "recovery") {
        linked("recovery", {earlier, help: Array.isArray(f.opponent_errors) && f.opponent_errors.length ? " The opponent's errors helped make that possible." : ""}, 88);
        purpose = "recovery";
        expression = "recovered";
      }
      if (relation.kind === "punishment") linked(f.outcome === "capitalized" ? "punishment" : "missed_punishment", {earlier, side}, 81);
      if (relation.kind === "repeated_motif" && ["allowed", "caused", "missed"].includes(String(f.role))) linked("repeated", {count: Number(f.occurrence), motif: words(f.motif)}, 74);
      // A restored defender matters only when this move's piece is under attack.
      if (relation.kind === "support_restored" && report.intelligence?.events.some(event =>
        event.id === relation.event_ids.at(-1) && event.facts.attacked === true))
        linked("support_restored", {earlier, piece: words(f.piece)}, 75);
      if (relation.kind === "erosion") linked("erosion", {earlier}, 71);
      if (relation.kind === "advantage_run" && f.outcome === "converted") linked("conversion", {earlier, side}, 75);
    }
    for (const item of game.history?.weaknesses ?? []) if (item.status === "supported" && item.related_plies.includes(ply))
      claims.push(claim("history", {motif: words(item.skill_id), games: item.independent_games}, 67, item.evidence, item.decision_ids));
  }
  if (poor) {
    const reply = report.immediate_reply, recapture = report.immediate_recapture;
    // A capture the mover takes straight back is an even trade, not a loss.
    const evenTrade = !!reply?.capture && (reply.material_change >= 0 || (recapture?.material_change ?? -1) >= 0);
    if (reply?.capture) {
      if (!evenTrade) claims.push(claim("reply_capture", {opponent, reply: reply.san, piece: reply.capture, side}, 78, refs));
    }
    // The allowed-mate claim above already names this exact immediate reply.
    // Repeating it as a lower-priority check adds no new explanation.
    else if (reply?.gives_check && !claims.some(c => c.code === "allowed_mate" && c.slots.reply))
      claims.push(claim("reply_check", {opponent, reply: reply.san}, 62, refs));
    if (!claims.some(c => c.priority >= 78)) {
      const before = report.best.score, after = report.actual.score;
      if (before.kind === "cp" && after.kind === "cp" && before.value > after.value)
        claims.push(claim("loss", {loss: ((before.value - after.value) / 100).toFixed(2)}, 82, refs));
    }
    claims.push(claim("alternative", {best, evaluation: scoreText(report.best.score)}, 42, refs));
  } else if (!claims.length) claims.push(claim(report.label === "Good" ? "good" : "best", {}, 40, refs));
  if (human && learnerMove) claims.push(...humanClaims(report, ply, mover ?? null));
  if (!report.intelligence && learnerMove) return makeIntent(key, purpose, mode, expression,
    [claim("compatibility", {detail: report.coach || report.reason}, 50)], ["legacy_report_without_semantics"]);
  return makeIntent(`${key}:${report.intelligence?.input_digest ?? "legacy"}`, purpose, mode, expression, claims,
    ["stockfish_quality_separate_from_human_policy", variation ? "branch_has_no_recorded_game_relationships" : "current_ply_context_only",
      "saved_learner_perspective", ...(practical?.limitations ?? [])], subject);
}
