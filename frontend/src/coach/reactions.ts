import type { ColdPosition, Feedback, Schema } from "../api";
import type { CoachExpression, CoachReaction } from "./model";

const quality: Record<Schema["GameMoveReport"]["label"], CoachExpression> = {
  Brilliant: "brilliant",
  Great: "great",
  Best: "best",
  Good: "good",
  Book: "book",
  Inaccuracy: "inaccuracy",
  Mistake: "mistake",
  Blunder: "blunder",
  Miss: "missed",
};

export function gameReaction({
  key,
  frame,
  report,
  learner,
  explaining,
  error,
  pending,
}: {
  key: string;
  frame?: Pick<Schema["GamePosition"], "san" | "termination" | "result"> | null;
  report?: Pick<Schema["GameMoveReport"], "label"> | null;
  learner: "white" | "black";
  explaining: boolean;
  error: boolean;
  pending: boolean;
}): CoachReaction {
  let state: CoachExpression = "neutral";
  // Only the displayed board's terminal result counts. The PGN's eventual result
  // must never leak into an earlier move or a manually explored variation.
  if (explaining) state = "explaining";
  else if (frame?.termination && frame.result === "1/2-1/2") state = "draw";
  else if (
    frame?.termination &&
    (frame.result === "1-0" || frame.result === "0-1")
  )
    state =
      (frame.result === "1-0") === (learner === "white") ? "winning" : "losing";
  else if (report) {
    state = quality[report.label];
    if (frame?.san?.endsWith("+") && ["best", "good", "book"].includes(state))
      state = "check";
  } else if (error) state = "uncertain";
  else if (pending) state = "thinking";
  return { key, state };
}

export function practiceReaction({
  position,
  feedback,
  busy,
  mistake,
  hadFailure,
  error = false,
}: {
  position: ColdPosition;
  feedback: Feedback | null;
  busy: boolean;
  mistake: boolean;
  hadFailure: boolean;
  error?: boolean;
}): CoachReaction {
  let state: CoachExpression = "neutral";
  if (busy) state = "thinking";
  else if (error) state = "uncertain";
  else if (feedback?.grade === "revealed") state = "explaining";
  else if (feedback?.completed)
    state = hadFailure || position.failed ? "recovered" : "good";
  else if (mistake) state = "mistake";
  else if (feedback || position.failed) state = "encouraging";
  // Cold SRS only conveys readiness, never hints at an undisclosed tactical theme.
  return {
    key: `${position.session_id}:${feedback?.attempt_id ?? "cold"}:${busy}`,
    state,
  };
}
