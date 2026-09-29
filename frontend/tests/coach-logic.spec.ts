import { test, expect } from "@playwright/test";
import { gameReaction, practiceReaction } from "../src/coach/reactions";
import { classicPerformance } from "../src/coach/classic/performance";
import {
  expressions,
  availableIdles,
  expressionIntent,
  resolveExpression,
  resolveFamily,
  resolveAnimation,
  type CoachDefinition,
} from "../src/coach/model";
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

test("every move quality maps to a semantic reaction without guessing from scores", () => {
  const expected = {
    Brilliant: "brilliant",
    Great: "great",
    Best: "best",
    Good: "good",
    Book: "book",
    Inaccuracy: "inaccuracy",
    Mistake: "mistake",
    Blunder: "blunder",
    Miss: "missed",
  } as const;
  for (const [label, state] of Object.entries(expected))
    expect(
      gameReaction({
        ...game,
        report: { label: label as keyof typeof expected },
      }),
    ).toEqual({ key: game.key, state });
  expect(gameReaction({ ...game, pending: true }).state).toBe("thinking");
  expect(gameReaction({ ...game, pending: true, error: true }).state).toBe(
    "uncertain",
  );
  expect(
    gameReaction({ ...game, pending: true, report: { label: "Good" } }).state,
  ).toBe("good");
  expect(
    gameReaction({ ...game, explaining: true, report: { label: "Blunder" } })
      .state,
  ).toBe("explaining");
});

test("check respects major labels and endings use the displayed position and learner", () => {
  const frame = { san: "Nf6+", termination: null, result: null };
  expect(
    gameReaction({ ...game, frame, report: { label: "Good" } }).state,
  ).toBe("check");
  expect(
    gameReaction({ ...game, frame, report: { label: "Brilliant" } }).state,
  ).toBe("brilliant");
  expect(
    gameReaction({ ...game, frame, report: { label: "Blunder" } }).state,
  ).toBe("blunder");
  const mate = { san: "Qh7#", termination: "checkmate", result: "1-0" };
  expect(gameReaction({ ...game, frame: mate }).state).toBe("winning");
  expect(gameReaction({ ...game, frame: mate, learner: "black" }).state).toBe(
    "losing",
  );
  expect(
    gameReaction({ ...game, frame: { ...mate, result: "0-1" } }).state,
  ).toBe("losing");
  expect(
    gameReaction({ ...game, frame: { ...mate, result: "1/2-1/2" } }).state,
  ).toBe("draw");
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
  expect(
    practiceReaction({ ...practice, feedback: failed, mistake: true }).state,
  ).toBe("mistake");
  expect(practiceReaction({ ...practice, feedback: failed }).state).toBe(
    "encouraging",
  );
  expect(
    practiceReaction({ ...practice, feedback: failed, busy: true, error: true })
      .state,
  ).toBe("thinking");
  expect(practiceReaction({ ...practice, error: true }).state).toBe(
    "uncertain",
  );
  const solved = { ...failed, completed: true, grade: "good" };
  expect(practiceReaction({ ...practice, feedback: solved }).state).toBe(
    "good",
  );
  expect(
    practiceReaction({ ...practice, feedback: solved, hadFailure: true }).state,
  ).toBe("recovered");
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

test("future coaches can omit reactions and even have cyclic fallbacks safely", () => {
  const coach: CoachDefinition = {
    id: "test-only",
    name: "Test fixture",
    description: "Minimal artwork for fallback contracts",
    Artwork: () => null,
    defaultState: "neutral",
    defaultFamily: "test",
    families: [{ id: "test", name: "Test", description: "", character: "" }],
    capabilities: { reactions: false, idle: false },
    animation: classicPerformance,
    expressions: ["neutral", "good"],
    fallbacks: {
      brilliant: "great",
      great: "good",
      blunder: "mistake",
      mistake: "blunder",
    },
  };
  expect(resolveExpression(coach, "brilliant")).toBe("good");
  expect(resolveExpression(coach, "blunder")).toBe("neutral");
  expect(resolveExpression(coach, "thinking")).toBe("neutral");
  expect(resolveFamily(coach, "removed")).toBe(coach.defaultFamily);
  expect(availableIdles(coach)).toContain("glasses");
  expect(availableIdles(coach)).not.toContain("tail");
  const variant = {
    ...coach,
    families: [
      {
        ...coach.families[0],
        animation: {
          ...classicPerformance,
          defaultIdle: ["ears"] as const,
          idleGestures: {},
        },
      },
    ],
  };
  expect(availableIdles(variant)).toEqual(["ears"]);
  expect(resolveAnimation(variant, "removed")).toBe(
    variant.families[0].animation,
  );
  expect(resolveAnimation(coach)).toBe(classicPerformance);
  expect(new Set(availableIdles(coach)).size).toBe(
    availableIdles(coach).length,
  );
  expect(
    expressionIntent(
      { ...coach, expressionIntents: { brilliant: "Perked ears" } },
      "brilliant",
    ),
  ).toBe("Perked ears");
  expect(expressionIntent(coach, "neutral")).toContain("welcoming");
  for (const state of expressions)
    expect(resolveExpression({ ...coach, expressions }, state)).toBe(state);
});
