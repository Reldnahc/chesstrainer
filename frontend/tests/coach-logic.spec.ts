import { test, expect } from "./helpers/browserTest";
import { gameReaction, practiceReaction } from "../src/coach/reactions";
import type { ColdPosition, Feedback } from "../src/api";

const game = {
  key: "game:4",
  learner: "white" as const,
  explaining: false,
  error: false,
  pending: false,
};
const position: ColdPosition = {
  session_id: "practice-a",
  exercise_id: "exercise-a",
  last_attempt_id: null,
  fen: "",
  orientation: "white",
  failed: false,
  review_reason: "new",
  previous_reviews: 0,
  practice_only: false,
  legal_moves: [],
};
const practice = {
  position,
  feedback: null,
  busy: false,
  mistake: false,
  hadFailure: false,
};

test("check respects major labels and endings use the displayed position and learner", () => {
  const frame = { san: "Nf6+", termination: null, result: null };
  expect(gameReaction({ ...game, frame, report: { label: "Good" } }).state).toBe("check");
  expect(gameReaction({ ...game, frame, report: { label: "Brilliant" } }).state).toBe("brilliant");
  expect(gameReaction({ ...game, frame, report: { label: "Blunder" } }).state).toBe("blunder");
  const mate = { san: "Qh7#", termination: "checkmate", result: "1-0" };
  expect(gameReaction({ ...game, frame: mate }).state).toBe("winning");
  expect(gameReaction({ ...game, frame: mate, learner: "black" }).state).toBe("losing");
  expect(gameReaction({ ...game, frame: { ...mate, result: "0-1" } }).state).toBe("losing");
  expect(gameReaction({ ...game, frame: { ...mate, result: "1/2-1/2" } }).state).toBe("draw");
  expect(
    gameReaction({
      ...game,
      frame: { ...mate, termination: null, result: null },
    }).state,
  ).toBe("neutral");
});

test("practice protects cold answers, distinguishes recovery and never judges a failed request", () => {
  expect(practiceReaction(practice).state).toBe("neutral");
  const failed: Feedback = {
    completed: false,
    grade: "again",
    attempt_id: "attempt-1",
  };
  expect(practiceReaction({ ...practice, feedback: failed, mistake: true }).state).toBe("mistake");
  expect(practiceReaction({ ...practice, feedback: failed }).state).toBe("encouraging");
  expect(practiceReaction({ ...practice, feedback: failed, busy: true, error: true }).state).toBe(
    "thinking",
  );
  expect(practiceReaction({ ...practice, error: true }).state).toBe("uncertain");
  const solved = { ...failed, completed: true, grade: "good" };
  expect(practiceReaction({ ...practice, feedback: solved }).state).toBe("good");
  expect(practiceReaction({ ...practice, feedback: solved, hadFailure: true }).state).toBe(
    "recovered",
  );
  expect(
    practiceReaction({
      ...practice,
      position: { ...position, failed: true },
      feedback: solved,
    }).state,
  ).toBe("recovered");
  expect(
    practiceReaction({
      ...practice,
      feedback: { ...solved, grade: "revealed" },
    }).state,
  ).toBe("explaining");
  expect(
    practiceReaction({
      ...practice,
      position: { ...position, session_id: "next" },
    }).key,
  ).not.toBe(practiceReaction(practice).key);
});
