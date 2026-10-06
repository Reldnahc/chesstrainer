import type { Game, Position, Report } from "../gameReview/types";
import type {CoachExpression} from "../coach/model";
import {scoreText} from "../evaluation";
import {claim, makeIntent, type Claim, type DialoguePurpose, type EvidenceRef} from "./model";
import {positionalClaim, strings, tacticalClaim, words} from "./eventClaims";
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
  const poor = ["Inaccuracy", "Mistake", "Miss", "Blunder"].includes(report.label);
  const side = mover === "white" ? "White" : mover === "black" ? "Black" : "The mover";
  const opponent = mover === "white" ? "Black" : mover === "black" ? "White" : "The opponent";
  const move = report.actual.san, best = report.best.san;
  const claims: Claim[] = [];
  const events = report.intelligence?.events ?? [];
  const node = !variation ? game.context?.nodes.find(n => n.ply === ply && n.input_digest === report.intelligence?.input_digest) : undefined;
  const refs: EvidenceRef[] = node?.evidence ?? (report.practical?.stockfish_analysis_ids ?? []).map(id => ({source: "stockfish", id, field: "candidate_search", ply}));
  const answer = report.immediate_reply;
  const recaptured = !!answer?.capture && answer.uci?.slice(2, 4) === report.actual.uci.slice(2, 4) && move.includes("x");
  for (const event of events) {
    const f = event.facts;
    const add = (code: string, slots: Claim["slots"], priority: number) => claims.push(claim(code, slots, priority, event.evidence, [event.id]));
    if (event.kind === "mate") add(f.transition === "allowed" ? "allowed_mate" : "missed_mate",
      {best, opponent, reply: report.immediate_reply ? `${opponent}'s strongest reply is ${report.immediate_reply.san}.` : ""}, 100);
    // A move inside a forced mate is about the mate, ahead of any tactic or
    // structure. A played back-rank tactic already explains that same mate.
    // Through a long mating run the same side's moves share a stage; it is told once,
    // and later moves of that stage speak their grade instead of repeating it.
    if (event.kind === "forced_mate" && typeof f.stage === "string" && !events.some(other => other.kind === "tactic"
      && other.facts.motif === "back_rank" && other.facts.role === "played")
      && (variation || !game.frames[ply - 2]?.report?.intelligence?.events.some(other =>
        other.kind === "forced_mate" && other.facts.stage === f.stage)))
      add(`forced_mate_${f.stage}`, {move, best, opponent, mate: Number(f.mate_in)}, 97);
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
      // Positive explanations describe the played move. An error keeps only facts
      // that explain its cost, never a gain of the played move or a drawback of the better one.
      if (poor ? !explainsCost(f, mover) : f.line !== "actual") continue;
      // A defender gained or lost by a piece that is simply traded off is not the story.
      if (f.feature === "piece_support" && f.line === "actual" && recaptured && f.target === report.actual.uci.slice(2, 4)) continue;
      // "A bishop could have developed", "the alternative was to castle" or "another move
      // would have pushed the passed pawn" is confusing when the played move did the same.
      if (["first_development", "castling", "passed_pawn_advance", "passed_pawns", "rook_file"].includes(String(f.feature))
        && f.line !== "actual" && events.some(other =>
        other.kind === "positional" && other.facts.feature === f.feature && other.facts.line === "actual")) continue;
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
      // A restored defender matters only when this move's piece is under attack,
      // and is never good news on a move graded as an error. It replaces the plain
      // "gains a defender" fact from the same event rather than repeating it.
      const restored = relation.event_ids.at(-1);
      if (relation.kind === "support_restored" && !poor && report.intelligence?.events.some(event =>
        event.id === restored && event.facts.attacked === true)) {
        claims.splice(0, claims.length, ...claims.filter(item => !(item.code === "support" && !!restored && item.sourceIds.includes(restored))));
        linked("support_restored", {earlier, piece: words(f.piece)}, 75);
      }
      // A run of concessions is only told on a move that is itself one.
      if (relation.kind === "erosion" && poor) linked("erosion", {earlier}, 71);
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

/** Whether a board fact helps explain why a move graded as an error cost something:
 * the mover's own losses after the played move, the opponent's gains, or what the
 * better move would have gained. King-square trivia never explains an error. */
function explainsCost(f: Record<string, unknown>, mover: string | null | undefined): boolean {
  const own = f.side === mover, actual = f.line === "actual";
  switch (f.feature) {
    case "piece_support": {
      const defended = strings(f.after).length > 0;
      return actual ? own && !defended : own === defended;
    }
    case "doubled_files": case "isolated_pawns": case "bishop_pair": return actual ? own : !own;
    case "rook_file": case "passed_pawns": return actual ? !own : own;
    case "passed_pawn_advance": case "first_development": case "castling": return !actual;
    default: return false;
  }
}
