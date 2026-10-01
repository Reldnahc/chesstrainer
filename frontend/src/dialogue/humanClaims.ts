import type {Report} from "../gameReview/types";
import {claim, makeIntent, type Claim, type CoachUtterance, type DialogueIntent, type EvidenceRef} from "./model";

/** One prepared insight supplies the visible badge, its explanation and speech. */
export type HumanInsightPresentation = {intent: DialogueIntent; utterance: CoachUtterance};

export const humanInsightLabels: Readonly<Record<string, string>> = {
  human_natural_error: "Natural mistake",
  human_rare: "Unusual but strong",
  human_challenging: "Hard find",
  human_natural_best: "Natural best move",
  human_natural_strong: "Natural strong choice",
  difficult_defense: "Hard defense missed",
  human_defense_found: "Hard defense found",
};

export function humanInsightIntent(parent: DialogueIntent): DialogueIntent {
  const items = parent.claims.filter(item => humanInsightLabels[item.code]).sort((a, b) => b.priority - a.priority).slice(0, 1);
  const build = (key: string) => makeIntent(`${key}:human`, parent.purpose, parent.mode,
    parent.expression, items, parent.decisions, parent.subject);
  const intent = build(parent.id), legacy = parent.wordingKey ? build(parent.wordingKey) : null;
  // Bind the derived fact to the real parent while preserving unchanged voices'
  // variants when the parent's added metadata concerns a different claim.
  return legacy ? {...intent, wordingKey: legacy.wordingKey ?? legacy.id} : intent;
}

/** Explain the supported label, independently of a coach's abbreviated reaction. */
export function humanInsightExplanation(code: string, report: Report): string {
  const played = report.actual.san, best = report.best.san;
  const meanings: Record<string, string> = {
    human_natural_error: `Maia models human move choices, not move strength. It sees ${played} as a natural choice, but Stockfish finds ${best} stronger.`,
    human_rare: `Maia models human move choices, not move strength. ${played} is unusual in its predictions, yet Stockfish confirms it is strong.`,
    human_natural_best: `Maia models human move choices, not move strength. ${played} is both a natural choice in its predictions and Stockfish's best move.`,
    human_natural_strong: `Maia models human move choices, not move strength. ${played} is a natural choice in its predictions and a strong move, though Stockfish prefers ${best}.`,
    human_challenging: `This describes how hard ${best} is to discover, not how strong it is. Fieldwork combines Maia's human-move predictions with Stockfish's alternatives to assess that difficulty.`,
    difficult_defense: `Stockfish found ${best} as the only good move at the searched depth. Maia's human-move predictions and the available alternatives help identify it as a difficult resource to find.`,
    human_defense_found: `You found ${best}, a difficult defensive resource. That difficulty comes from Maia's human-move predictions and Stockfish's alternatives, rather than the move's evaluation alone.`,
  };
  const explanation = meanings[code] ?? "";
  return report.human?.provenance?.provider === "maia3"
    ? explanation : explanation.replaceAll("Maia", "The human model").replaceAll("The human model's", "the human model's");
}

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
