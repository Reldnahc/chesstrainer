import type {Game, Report} from "../src/gameReview/types";
import {gameReaction} from "../src/coach/reactions";
import {gameIntent} from "../src/dialogue/gameIntent";
import {renderNeutral} from "../src/dialogue/neutral";

export function inspectPosition(game: Game, ply: number, explaining = false, variation = false) {
  const frame = game.frames[ply];
  const report = frame?.report;
  const key = `${game.id}:${ply}:`;
  const reaction = gameReaction({key, frame, report, learner: game.orientation, explaining, error: false, pending: false});
  const intent = gameIntent({game, frame, report, ply, key, expression: reaction.state, explaining, variation});
  const full = report as Report & {before_analysis_id?: string; played_analysis_id?: string; engine_version?: string; actual_line?: unknown; best_line?: unknown};
  return {
    intent, utterance: renderNeutral(intent),
    stockfish: report ? {best: report.best, actual: report.actual, before_analysis_id: full.before_analysis_id,
      played_analysis_id: full.played_analysis_id, engine_version: full.engine_version, depth: report.depth,
      label: report.label, engine_label: report.engine_label, reason: report.reason,
      actual_line: full.actual_line, best_line: full.best_line} : null,
    human: report?.human ?? null,
    practical: report?.practical ?? null,
    events: report?.intelligence ?? null,
    context: {node: game.context?.nodes.find(n => n.ply === ply),
      links: game.context?.relationships.filter(r => r.plies.includes(ply)),
      turning: game.context?.turning_points.filter(t => t.ply === ply), limitations: game.context?.limitations},
    history: game.history?.weaknesses.filter(w => w.related_plies.includes(ply)) ?? [],
  };
}

export const MAX_BYTES = 20 * 1024 * 1024;
function displayableFen(value: unknown) {
  if (typeof value !== "string") return false;
  const fields = value.split(" "), rows = fields[0].split("/");
  // Syntax only, to protect the board renderer. python-chess still owns legality.
  return fields.length === 6 && rows.length === 8 && rows.every(row =>
    /^[prnbqkPRNBQK1-8]+$/.test(row) && [...row].reduce((n, c) => n + (Number(c) || 1), 0) === 8);
}
export function parseReview(text: string): Game {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("Choose a review smaller than 20 MB.");
  const value = JSON.parse(text);
  if (!value || typeof value.id !== "string" || !["white", "black"].includes(value.orientation)
      || !Array.isArray(value.frames) || !value.frames.length || value.frames.length > 5000)
    throw new Error("Expected a game-detail JSON response with positions and orientation.");
  for (const frame of value.frames) {
    if (!frame || !displayableFen(frame.fen) || typeof frame.san !== "string" || !["white", "black"].includes(frame.turn))
      throw new Error("The review contains an invalid position.");
    if (frame.report?.intelligence && frame.report.intelligence.version !== "move-events-4")
      throw new Error("This laboratory needs move-events-4. Export the game from the current server.");
  }
  // Dry-run the actual renderer before replacing the last good document. This is
  // diagnostic input, never chess authority or executable content.
  try { value.frames.forEach((_: unknown, ply: number) => inspectPosition(value, ply)); }
  catch { throw new Error("The review has incomplete or incompatible evidence fields."); }
  return value;
}
