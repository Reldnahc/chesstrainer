import {claim, makeIntent, type DialoguePurpose} from "../src/dialogue/model";
import type {CoachExpression} from "../src/coach/model";

// Synthetic writing exercises, clearly labeled in the laboratory. They do not
// enter reviews, chess evidence, training data, or the production bundle.
type Example = {purpose: DialoguePurpose; expression: CoachExpression; code: string; slots?: Record<string, string | number>};
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
  {purpose: "turning_point", expression: "explaining", code: "turning"},
  {purpose: "repeated_motif", expression: "explaining", code: "repeated", slots: {motif: "pin", count: 2}},
  {purpose: "time_trouble", expression: "explaining", code: "clock_low", slots: {side: "White", seconds: "8.0"}},
  {purpose: "review_complete", expression: "explaining", code: "complete", slots: {detail: "2. g4 was the largest reviewed concession, allowing a forced mate."}},
  {purpose: "variation", expression: "explaining", code: "variation", slots: {detail: "Black can answer Nxe4, capturing the pawn."}},
];

export function exampleIntent(index: number, take = 0) {
  const item = writingExamples[index] ?? writingExamples[0];
  return makeIntent(`writing-example:${item.purpose}:${take}`, item.purpose, item.purpose === "neutral" ? "practice" : "game", item.expression,
    [claim(item.code, item.slots, ["blunder", "winning", "losing"].includes(item.purpose) ? 100 : 75)],
    ["synthetic_writing_exercise_not_chess_evidence"]);
}
