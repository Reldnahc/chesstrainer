import type {Report} from "../gameReview/types";
import {claim, type Claim, type EvidenceRef} from "./model";

export const humanInsightLabels: Readonly<Record<string, string>> = {
  human_natural_error: "Natural mistake",
  human_rare: "Unusual but strong",
  human_challenging: "Hard find",
  human_natural_best: "Natural best move",
  human_natural_strong: "Natural strong choice",
  difficult_defense: "Hard defense missed",
  human_defense_found: "Hard defense found",
};

/** Present the saved practical assessment; never infer a new grade or difficulty. */
export function humanClaims(report: Report, ply: number, mover: string | null): Claim[] {
  const human = report.human, practical = report.practical;
  if (!human || human.status !== "available" || !human.evidence_id || !practical
    || practical.human_evidence_id !== human.evidence_id || human.mover !== mover
    || human.played?.uci !== report.actual.uci || human.engine_best?.uci !== report.best.uci
    || ["unknown", "forced"].includes(practical.best_find_difficulty)) return [];
  const refs: EvidenceRef[] = [
    {source: "human", id: human.evidence_id, field: "policy", ply},
    ...practical.stockfish_analysis_ids.map(id => ({source: "stockfish" as const, id, field: "candidate_search", ply})),
  ];
  const interpretations = practical.interpretations ?? [];
  const best = report.best.san, foundBest = report.actual.uci === report.best.uci;
  const poor = ["Inaccuracy", "Mistake", "Miss", "Blunder"].includes(report.engine_label ?? report.label);
  const result: Claim[] = [];
  if (interpretations.includes("natural_error")) result.push(claim("human_natural_error", {}, 69, refs));
  if (practical.best_find_difficulty === "difficult" && practical.components.only_good_move_at_depth && poor)
    result.push(claim("difficult_defense", {best}, 74, refs));
  else if (foundBest && interpretations.includes("hard_to_find_defense"))
    result.push(claim("human_defense_found", {best}, 74, refs));
  else if (foundBest && practical.best_find_difficulty === "difficult")
    result.push(claim("human_challenging", {best}, 72, refs));
  else if (interpretations.includes("unusual_strong_move"))
    result.push(claim("human_rare", {}, 70, refs));
  else if (foundBest && practical.best_find_difficulty === "challenging")
    result.push(claim("human_challenging", {best}, 70, refs));
  else if (interpretations.includes("natural_best"))
    result.push(claim(foundBest ? "human_natural_best" : "human_natural_strong", {}, 64, refs));
  return result;
}

export function humanSourceNotes(report: Report): {name: string; note: string; url?: string} {
  const maia = report.human?.provenance?.provider === "maia3";
  const alignment = report.human?.domain.alignment;
  const limited = report.practical?.limitations.some(value =>
    ["rating_fallback", "outside_probed_rating_range", "pre_setup_history_unknown", "incomplete_policy"].includes(value));
  const note = limited || !["related", "shifted"].includes(alignment ?? "")
    ? "Rough estimate: limited game or rating data."
    : alignment === "shifted"
      ? maia ? "Rough estimate: trained on Lichess blitz." : "Rough estimate: different training context."
      : "Human-move estimate, not an engine score.";
  return {name: maia ? "Maia" : "Human model", note,
    ...(maia ? {url: "https://www.maiachess.com/"} : {})};
}
