import type { ComponentType } from "react";
import type { Schema } from "../api";
import type { CoachPersonality } from "../dialogue/personality";
import { configuredGestures } from "./idleGestures";

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
  "humans" | "dogs" | "cats" | "animals" | "fantasy" | "scifi" | "conceptual";
export type CoachFamily = {
  id: string;
  name: string;
  description: string;
  character: string;
  group?: CoachGroup;
  personality?: CoachPersonality;
  animation?: CoachDefinition["animation"];
  speech?: boolean;
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
  | "scan"
  | "double-blink"
  | "glance-right"
  | "look-up"
  | "nod-twice"
  | "tilt-right"
  | "weight-shift"
  | "signature-a"
  | "signature-b";
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
  capabilities: { reactions: boolean; idle: boolean; speech?: boolean };
  animation: {
    reactionMs: Partial<Record<CoachExpression, number>>;
    defaultReactionMs: number;
    idleGestures: Partial<Record<CoachExpression, readonly CoachMicro[]>>;
    defaultIdle: readonly CoachMicro[];
    motionProfile?: CoachMotionProfile;
  };
  Artwork: ComponentType<CoachArtworkProps>;
};

/** The only motion a coach authors; `coachPerformance` supplies every idle pool. */
export type ReactionTiming = Pick<CoachDefinition["animation"], "reactionMs" | "defaultReactionMs">;

/** Every registered family names its coach and personality; nothing falls back silently. */
export type CoachCollection = Omit<CoachDefinition, "families"> & {
  families: readonly (CoachFamily & { coachId: CoachId; personality: CoachPersonality })[];
};
/** Catalog input before each family's performance is resolved from its reaction
 * timing and its personality is read from the one table keyed by its coach ID. */
export type AuthoredCoachCollection = Omit<CoachCollection, "animation" | "families"> & {
  animation: ReactionTiming;
  families: readonly (Omit<CoachCollection["families"][number], "animation" | "personality"> & {
    animation?: ReactionTiming;
  })[];
};
export type SelectableCoach = CoachDefinition & {
  id: CoachId;
  collectionId: string;
  personality: CoachPersonality;
};

export const expressionInfo: Record<CoachExpression, { label: string; intent: string }> = {
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
  return coach.expressions.includes(state) ? state : (coach.expressions[0] ?? "neutral");
}

export function resolveFamily(coach: CoachDefinition, requested?: string) {
  return coach.families.find(family => family.id === requested)?.id ?? coach.defaultFamily;
}

export function expressionIntent(coach: CoachDefinition, state: CoachExpression) {
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
  "double-blink": "Two quick blinks",
  "glance-right": "Glance right",
  "look-up": "Look up thoughtfully",
  "nod-twice": "Two approving nods",
  "tilt-right": "Consider from the other side",
  "weight-shift": "Shift and settle",
  "signature-a": "Character gesture one",
  "signature-b": "Character gesture two",
};

export function resolveAnimation(coach: CoachDefinition, family?: string) {
  const direction = resolveFamily(coach, family);
  return coach.families.find(variant => variant.id === direction)?.animation ?? coach.animation;
}

/** Artwork must opt in; a recording never makes an unsupported rig improvise a mouth. */
export function supportsSpeech(coach: CoachDefinition, family?: string): boolean {
  const direction = resolveFamily(coach, family);
  return (
    coach.families.find(variant => variant.id === direction)?.speech ??
    coach.capabilities.speech ??
    false
  );
}

export function availableIdles(coach: CoachDefinition, family?: string) {
  const animation = resolveAnimation(coach, family);
  const configured = new Set(
    coach.expressions.flatMap(expression =>
      configuredGestures(animation, expression).map(gesture => gesture.id),
    ),
  );
  return (Object.keys(microLabels) as Exclude<CoachMicro, "">[]).filter(gesture =>
    configured.has(gesture),
  );
}

export function expressionIdles(
  coach: CoachDefinition,
  family: string | undefined,
  expression: CoachExpression,
): readonly CoachIdle[] {
  const animation = resolveAnimation(coach, family);
  return configuredGestures(animation, expression).map(gesture => gesture.id as CoachIdle);
}

export function idlePresentation(
  coach: CoachDefinition,
  family: string | undefined,
  expression: CoachExpression,
  id: CoachIdle,
) {
  const gesture = configuredGestures(resolveAnimation(coach, family), expression).find(
    candidate => candidate.id === id,
  );
  return { label: gesture?.label ?? microLabels[id], description: gesture?.description };
}
