import type { ComponentType } from "react";
import type { Schema } from "../api";
import type { CoachPersonality } from "../dialogue/personality";

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
export type CoachGroup =
  | "humans"
  | "dogs"
  | "cats"
  | "animals"
  | "fantasy"
  | "scifi"
  | "conceptual";
export type CoachFamily = {
  id: string;
  name: string;
  description: string;
  character: string;
  group?: CoachGroup;
  personality?: CoachPersonality;
  animation?: CoachDefinition["animation"];
};
export type CoachArtworkProps = { expression: CoachExpression; family: string };
export type CoachMicro =
  | ""
  | "blink"
  | "glance"
  | "breathe"
  | "nod"
  | "glasses"
  | "hair"
  | "ears"
  | "tail"
  | "sigh"
  | "twinkle"
  | "slow-blink"
  | "look-down"
  | "head-tilt"
  | "lean-in"
  | "posture-reset"
  | "scan";
export type CoachIdle = Exclude<CoachMicro, "">;
export type CoachIdlePool = readonly CoachIdle[];
export type CoachMotionProfile = {
  id: string;
  amplitude: number;
  gaze: number;
  settle: number;
};

export type CoachDefinition = {
  id: string;
  name: string;
  description: string;
  group?: CoachGroup;
  expressionIntents?: Partial<Record<CoachExpression, string>>;
  defaultState: CoachExpression;
  expressions: readonly CoachExpression[];
  fallbacks: Partial<Record<CoachExpression, CoachExpression>>;
  families: readonly CoachFamily[];
  defaultFamily: string;
  capabilities: { reactions: boolean; idle: boolean };
  animation: {
    reactionMs: Partial<Record<CoachExpression, number>>;
    defaultReactionMs: number;
    idleGestures: Partial<Record<CoachExpression, readonly CoachMicro[]>>;
    defaultIdle: readonly CoachMicro[];
    motionProfile?: CoachMotionProfile;
  };
  Artwork: ComponentType<CoachArtworkProps>;
};

export type CoachCollection = Omit<CoachDefinition, "families"> & {
  families: readonly (CoachFamily & { coachId: CoachId })[];
};
export type SelectableCoach = CoachDefinition & {
  id: CoachId;
  collectionId: string;
  personality: CoachPersonality;
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
    intent: "Delighted surprise at an exceptional idea.",
  },
  great: {
    label: "Great",
    intent: "Proud recognition of a particularly important move.",
  },
  best: {
    label: "Best",
    intent: "Quiet conviction in the strongest move.",
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
    intent: "Immediate alarm, settling into concern and readiness to help.",
  },
  missed: {
    label: "Missed opportunity",
    intent: "A moment of regret for an opportunity that was available.",
  },
  check: {
    label: "Check",
    intent: "Leans in, eyes sharp. Something concrete is happening.",
  },
  winning: {
    label: "Winning finish",
    intent: "Joy and satisfaction at a successful finish.",
  },
  losing: {
    label: "Losing finish",
    intent: "Sympathy and acceptance after a loss. No ridicule.",
  },
  thinking: {
    label: "Thinking",
    intent: "Focused consideration while analysis is in progress.",
  },
  uncertain: {
    label: "Uncertain",
    intent: "Visible uncertainty; confidence is not invented.",
  },
  encouraging: {
    label: "Try again",
    intent: "Warm, steady encouragement to try again.",
  },
  recovered: {
    label: "Found it",
    intent: "A restrained celebration of recovery after a miss.",
  },
  explaining: {
    label: "Explaining",
    intent: "Patient attention to an idea being explained.",
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

export function expressionIntent(
  coach: CoachDefinition,
  state: CoachExpression,
) {
  return coach.expressionIntents?.[state] ?? expressionInfo[state].intent;
}

export const microLabels: Record<Exclude<CoachMicro, "">, string> = {
  blink: "Blink",
  glance: "Look around",
  breathe: "Breathe",
  nod: "Small nod",
  glasses: "Settle glasses",
  hair: "Hair settles",
  ears: "Ear flick",
  tail: "Tail flick",
  sigh: "Exhale",
  twinkle: "Delighted glint",
  "slow-blink": "Measured blink",
  "look-down": "Look back at the board",
  "head-tilt": "Consider the position",
  "lean-in": "Attentive lean",
  "posture-reset": "Settle posture",
  scan: "Follow the line",
};

export function resolveAnimation(coach: CoachDefinition, family?: string) {
  const direction = resolveFamily(coach, family);
  return (
    coach.families.find((variant) => variant.id === direction)?.animation ??
    coach.animation
  );
}

export function availableIdles(coach: CoachDefinition, family?: string) {
  const animation = resolveAnimation(coach, family);
  const configured = new Set([
    ...animation.defaultIdle,
    ...Object.values(animation.idleGestures).flat(),
  ]);
  return (Object.keys(microLabels) as Exclude<CoachMicro, "">[]).filter(
    (gesture) => configured.has(gesture),
  );
}

export function expressionIdles(
  coach: CoachDefinition,
  family: string | undefined,
  expression: CoachExpression,
): readonly CoachIdle[] {
  const animation = resolveAnimation(coach, family);
  return (animation.idleGestures[expression] ?? animation.defaultIdle).filter(
    (gesture): gesture is CoachIdle => gesture !== "",
  );
}
