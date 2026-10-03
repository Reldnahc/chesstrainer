import {claim, makeIntent, type DialoguePurpose} from "../src/dialogue/model";
import type {CoachExpression} from "../src/coach/model";

// Synthetic writing exercises, clearly labeled in the laboratory. They do not
// enter reviews, chess evidence, training data, or the production bundle.
type Example = {purpose: DialoguePurpose; expression: CoachExpression; code: string; slots?: Record<string, string | number>; label?: string;
  supporting?: {code: string; slots?: Record<string, string | number>; priority: number}[]};
export const writingExamples: Example[] = [
  {purpose: "neutral", expression: "neutral", code: "cold"},
  {purpose: "thinking", expression: "thinking", code: "thinking"},
  {purpose: "uncertain", expression: "uncertain", code: "unavailable"},
  {purpose: "brilliant", expression: "brilliant", code: "sacrifice"},
  {purpose: "great", expression: "great", code: "only_move"},
  {purpose: "best", expression: "best", code: "tactic_played", slots: {move: "Ng5+", motif: "fork", detail: "The king on h7 and queen on e4 are attacked together."}},
  {purpose: "good", expression: "good", code: "development", slots: {lead: "Nf3 ", piece: "knight"}},
  {purpose: "book", expression: "book", code: "book", slots: {opening: "Bongcloud Attack"}},
  {purpose: "opening_departure", expression: "book", code: "departure"},
  {purpose: "inaccuracy", expression: "inaccuracy", code: "loss", slots: {loss: "0.48"}},
  {purpose: "mistake", expression: "mistake", code: "tactic_allowed", slots: {opponent: "Black", motif: "pin", detail: "The verified continuation wins material."}},
  {purpose: "blunder", expression: "blunder", code: "allowed_mate", slots: {opponent: "Black", reply: "Black's strongest reply is Qh4#."}},
  {purpose: "missed", expression: "missed", code: "tactic_missed", slots: {best: "Ng5+", motif: "fork", detail: "The king and queen are attacked together."}},
  {purpose: "difficult_defense", expression: "great", code: "difficult_defense", slots: {best: "Qf2"}},
  {purpose: "only_move", expression: "great", code: "only_move"},
  {purpose: "winning", expression: "winning", code: "mate_win"},
  {purpose: "losing", expression: "losing", code: "mate_loss"},
  {purpose: "draw", expression: "draw", code: "draw"},
  {purpose: "encouraging", expression: "encouraging", code: "retry"},
  {purpose: "recovery", expression: "recovered", code: "recovery", slots: {earlier: "17. Qe2", help: " The opponent's errors helped make that possible."}},
  {purpose: "explanation", expression: "explaining", code: "explanation", slots: {detail: "The knight attacks the king and queen together."}},
  {purpose: "repeated_motif", expression: "explaining", code: "repeated", slots: {motif: "pin", count: 2}},
  {purpose: "variation", expression: "explaining", code: "variation", slots: {detail: "Black can answer Nxe4, capturing the pawn."}},
  {purpose: "mistake", expression: "mistake", code: "human_natural_error", label: "natural Maia-supported mistake",
    supporting: [{code: "alternative", slots: {best: "Qf2", evaluation: "+0.2"}, priority: 42}]},
  {purpose: "best", expression: "best", code: "human_challenging", label: "difficult best move", slots: {best: "Nb1"}},
  {purpose: "blunder", expression: "blunder", code: "cause_abandoned_defender", label: "blunder: abandoned defender",
    slots: {move: "Ne3", side: "White", piece: "rook", square: "a1", opponent: "Black", reply: "Qxa1"},
    supporting: [{code: "alternative", slots: {best: "Ne1", evaluation: "0.0"}, priority: 42}]},
  {purpose: "mistake", expression: "mistake", code: "cause_opponent_threat_recognition", label: "mistake: preceding threat",
    slots: {move: "a3", side: "White", piece: "bishop", square: "c4", opponent: "Black", reply: "dxc4"}},
  {purpose: "mistake", expression: "mistake", code: "cause_avoiding_bad_trades", label: "mistake: bad trade",
    slots: {move: "Qxd5", side: "White", piece: "queen", captured: "pawn", opponent: "Black", reply: "Nxd5"}},
  {purpose: "difficult_defense", expression: "great", code: "human_defense_found", label: "difficult defense found", slots: {best: "Qf2"}},
];

// A stable cross-section for reading a voice with its identity hidden. Every
// coach gets the same intent objects, including the same optional second facts.
export const comparisonExamples = [26, 5, 24, 25, 19, 12, 6, 14, 15, 18];

export function exampleIntent(index: number, take = 0) {
  const item = writingExamples[index] ?? writingExamples[0];
  return makeIntent(`writing-example:${item.purpose}:${take}`, item.purpose, item.purpose === "neutral" ? "practice" : "game", item.expression,
    [claim(item.code, item.slots, ["blunder", "winning", "losing"].includes(item.purpose) ? 100 : 75),
      ...(item.supporting ?? []).map(support => claim(support.code, support.slots, support.priority))],
    ["synthetic_writing_exercise_not_chess_evidence"]);
}
