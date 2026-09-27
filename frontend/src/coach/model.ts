import type { ComponentType } from "react";
import type { Schema } from "../api";

export const expressions = [
  "neutral",
  "idle",
  "brilliant",
  "great",
  "best",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "blunder",
  "missed",
  "check",
  "winning",
  "losing",
  "thinking",
  "uncertain",
  "encouraging",
  "recovered",
  "explaining",
  "draw",
] as const;
export type CoachExpression = (typeof expressions)[number];
export type CoachId = NonNullable<Schema["CoachPreferences"]["coach_id"]>;
export type CoachMotion = NonNullable<Schema["CoachPreferences"]["motion"]>;
export type CoachPreferences = { coach_id: CoachId; motion: CoachMotion };
export type CoachReaction = { state: CoachExpression; key: string };
export type CoachFamily = {
  id: string;
  name: string;
  description: string;
  character: string;
};
export type CoachArtworkProps = { expression: CoachExpression; family: string };
export type CoachMicro =
  | ""
  | "blink"
  | "glance"
  | "breathe"
  | "nod"
  | "glasses"
  | "sigh"
  | "twinkle";

export type CoachDefinition = {
  id: string;
  name: string;
  description: string;
  defaultState: CoachExpression;
  expressions: readonly CoachExpression[];
  fallbacks: Partial<Record<CoachExpression, CoachExpression>>;
  families: readonly CoachFamily[];
  defaultFamily: string;
  capabilities: { reactions: boolean; idle: boolean };
  animation: {
    reactionMs: Partial<Record<CoachExpression, number>>;
    defaultReactionMs: number;
    idleRangeMs: readonly [number, number];
    idleGestures: Partial<Record<CoachExpression, readonly CoachMicro[]>>;
    defaultIdle: readonly CoachMicro[];
  };
  Artwork: ComponentType<CoachArtworkProps>;
};

export const expressionInfo: Record<
  CoachExpression,
  { label: string; intent: string }
> = {
  neutral: {
    label: "Ready",
    intent: "Attentive, with a small welcoming smile.",
  },
  idle: {
    label: "At ease",
    intent: "A patient glance around the board.",
  },
  brilliant: {
    label: "Brilliant",
    intent: "A delighted double take. He saw the idea a beat after you did.",
  },
  great: {
    label: "Great",
    intent: "Raised brows, a proud nod and a little applause.",
  },
  best: {
    label: "Best",
    intent: "Quiet conviction. Exactly the move he was hoping for.",
  },
  good: {
    label: "Good",
    intent: "A relaxed smile and an approving nod.",
  },
  book: {
    label: "Book",
    intent: "Recognition: this is familiar territory.",
  },
  inaccuracy: {
    label: "Inaccuracy",
    intent: "A considering tilt. There is a slightly better way.",
  },
  mistake: {
    label: "Mistake",
    intent: "A sympathetic wince, then attention returns to the board.",
  },
  blunder: {
    label: "Blunder",
    intent: "A sharp intake of breath, lifted hands, then a concerned settle.",
  },
  missed: {
    label: "Missed opportunity",
    intent: "A glance back and an open palm: that chance was there.",
  },
  check: {
    label: "Check",
    intent: "Leans in, eyes sharp. Something concrete is happening.",
  },
  winning: {
    label: "Winning finish",
    intent: "A joyful lift and a satisfied, eyes-closed grin.",
  },
  losing: {
    label: "Losing finish",
    intent: "Softened brows and lowered shoulders. No ridicule.",
  },
  thinking: {
    label: "Thinking",
    intent: "Eyes follow an idea, with a hand resting at his chin.",
  },
  uncertain: {
    label: "Uncertain",
    intent: "Uneven brows and a small shrug; confidence is not invented.",
  },
  encouraging: {
    label: "Try again",
    intent: "An open hand and a warm, steady look.",
  },
  recovered: {
    label: "Found it",
    intent: "A small fist pump for recovering after a miss.",
  },
  explaining: {
    label: "Explaining",
    intent: "An open palm offers the idea with a welcoming teaching gesture.",
  },
  draw: {
    label: "Draw",
    intent: "A balanced shrug and an accepting half-smile.",
  },
};

export function resolveExpression(
  coach: CoachDefinition,
  requested: CoachExpression,
): CoachExpression {
  const visited = new Set<CoachExpression>();
  let state = requested;
  while (!coach.expressions.includes(state) && !visited.has(state)) {
    visited.add(state);
    state = coach.fallbacks[state] ?? coach.defaultState;
  }
  return coach.expressions.includes(state)
    ? state
    : (coach.expressions[0] ?? "neutral");
}

export function resolveFamily(coach: CoachDefinition, requested?: string) {
  return (
    coach.families.find((family) => family.id === requested)?.id ??
    coach.defaultFamily
  );
}
