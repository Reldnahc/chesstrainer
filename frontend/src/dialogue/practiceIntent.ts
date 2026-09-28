import type { ColdPosition, Feedback, ExplanationFrame, MoveExplanation } from "../api";
import type { CoachExpression } from "../coach/model";
import { claim, makeIntent } from "./model";

/** This adapter only accepts feedback the practice API has already authorized. */
export function practiceIntent({position, feedback, frame, hadFailure, expression, error = false}: {
  position: ColdPosition; feedback: Feedback | null; frame?: ExplanationFrame | null;
  hadFailure: boolean; expression: CoachExpression; error?: boolean;
}) {
  const key = `${position.session_id}:${feedback?.attempt_id ?? "cold"}:${frame?.fen ?? "position"}`;
  if (error) return makeIntent(key, "uncertain", "practice", "uncertain", [claim("practice_error")]);
  // Neither a future preview frame nor stray summary fields may warm a cold card.
  if (!feedback) return makeIntent(key, position.failed ? "encouraging" : "neutral", "practice", expression,
    [claim(position.failed ? "retry" : "cold")], ["cold_feedback_gate"]);
  const detail = frame?.annotation || feedback.explanation_summary || feedback.message || "Study the move, then try the next position.";
  const recovery = feedback.completed && feedback.grade !== "revealed" && (hadFailure || position.failed);
  const code = recovery ? "recovered" : feedback.completed ? "accepted" : frame ? "explanation" : "retry";
  return makeIntent(key, recovery ? "recovery" : feedback.grade === "revealed" ? "explanation" : feedback.completed ? "good" : "encouraging",
    "practice", expression, [claim(code, {detail}, 65, [], feedback.attempt_id ? [feedback.attempt_id] : [])],
    ["authorized_practice_feedback", "no_recorded_game_context_in_cold_practice"]);
}

export function explanationIntent(key: string, data: MoveExplanation, frame: ExplanationFrame, index: number) {
  const refs = data.analysis_id ? [{source: "stockfish" as const, id: data.analysis_id, field: `explanation/frames/${index}`}]: [];
  return makeIntent(`${key}:${index}:${frame.fen}`, "explanation", "explanation", "explaining", [
    claim("explanation", {detail: frame.annotation}, 76, refs),
    ...(data.summary.trim() !== frame.annotation.trim() ? [claim("explanation_summary", {detail: data.summary}, 70, refs)] : []),
  ], ["authorized_saved_continuation", `authority:${data.authority}`]);
}
