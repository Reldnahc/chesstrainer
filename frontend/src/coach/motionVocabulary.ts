import type {
  CoachDefinition,
  CoachExpression,
  CoachIdlePool,
  CoachId,
  CoachMotionProfile,
} from "./model";

type Pools = Record<CoachExpression, CoachIdlePool>;

// Each slot animates a different part or action. Concern never borrows a
// celebration, and closed-eye expressions never rely on a pupil-only glance.
const expressionPools: Pools = {
  neutral: ["blink", "glance", "breathe", "head-tilt"],
  idle: ["slow-blink", "scan", "breathe", "posture-reset"],
  brilliant: ["blink", "nod", "lean-in", "posture-reset"],
  great: ["blink", "nod", "head-tilt", "posture-reset"],
  best: ["blink", "nod", "lean-in", "posture-reset"],
  good: ["slow-blink", "nod", "breathe", "head-tilt"],
  book: ["blink", "look-down", "head-tilt", "posture-reset"],
  inaccuracy: ["blink", "head-tilt", "look-down", "breathe"],
  mistake: ["slow-blink", "sigh", "head-tilt", "posture-reset"],
  blunder: ["blink", "sigh", "look-down", "posture-reset"],
  missed: ["blink", "scan", "head-tilt", "sigh"],
  check: ["scan", "lean-in", "head-tilt", "posture-reset"],
  winning: ["slow-blink", "nod", "lean-in", "posture-reset"],
  losing: ["slow-blink", "sigh", "look-down", "breathe"],
  thinking: ["scan", "look-down", "head-tilt", "breathe"],
  uncertain: ["blink", "head-tilt", "look-down", "posture-reset"],
  encouraging: ["slow-blink", "nod", "breathe", "lean-in"],
  recovered: ["blink", "nod", "head-tilt", "posture-reset"],
  explaining: ["blink", "scan", "nod", "posture-reset"],
  draw: ["slow-blink", "head-tilt", "breathe", "posture-reset"],
};

const styles = {
  measured: {
    neutral: ["slow-blink", "look-down", "breathe", "head-tilt"],
    brilliant: ["slow-blink", "nod", "head-tilt", "lean-in"],
    best: ["slow-blink", "nod", "look-down", "posture-reset"],
    blunder: ["slow-blink", "look-down", "sigh", "head-tilt"],
    thinking: ["slow-blink", "look-down", "breathe", "head-tilt"],
  },
  curious: {
    neutral: ["blink", "scan", "head-tilt", "lean-in"],
    book: ["scan", "look-down", "head-tilt", "breathe"],
    missed: ["scan", "look-down", "head-tilt", "posture-reset"],
    thinking: ["scan", "head-tilt", "lean-in", "look-down"],
    uncertain: ["slow-blink", "scan", "head-tilt", "look-down"],
  },
  buoyant: {
    neutral: ["blink", "scan", "lean-in", "posture-reset"],
    brilliant: ["blink", "nod", "lean-in", "twinkle"],
    great: ["blink", "nod", "lean-in", "posture-reset"],
    winning: ["slow-blink", "nod", "posture-reset", "twinkle"],
    recovered: ["blink", "nod", "lean-in", "posture-reset"],
  },
  deliberate: {
    neutral: ["blink", "scan", "posture-reset", "breathe"],
    best: ["blink", "look-down", "nod", "posture-reset"],
    blunder: ["look-down", "sigh", "posture-reset", "head-tilt"],
    thinking: ["scan", "look-down", "posture-reset", "breathe"],
    explaining: ["scan", "head-tilt", "nod", "posture-reset"],
  },
  reassuring: {
    neutral: ["slow-blink", "glance", "breathe", "head-tilt"],
    mistake: ["slow-blink", "sigh", "look-down", "breathe"],
    blunder: ["slow-blink", "sigh", "look-down", "posture-reset"],
    encouraging: ["slow-blink", "nod", "breathe", "head-tilt"],
    recovered: ["slow-blink", "nod", "breathe", "posture-reset"],
  },
} satisfies Record<string, Partial<Pools>>;

type MotionDirection = Omit<CoachMotionProfile, "id"> & {
  style: keyof typeof styles;
  pools?: Partial<Pools>;
};

// Acting choices belong beside the rig, independently of chess facts or prose.
// Signature gestures appear only on characters with the corresponding part.
export const motionDirections = {
  classic: {
    style: "reassuring", amplitude: 1, gaze: 1, settle: 1,
    pools: {
      brilliant: ["blink", "twinkle", "nod", "lean-in"],
      blunder: ["slow-blink", "sigh", "glasses", "look-down"],
      thinking: ["scan", "look-down", "glasses", "head-tilt"],
    },
  },
  "man-host": {
    style: "buoyant", amplitude: 1.05, gaze: 1, settle: 1.1,
    pools: { explaining: ["glance", "nod", "lean-in", "posture-reset"] },
  },
  "man-expert": {
    style: "deliberate", amplitude: 0.62, gaze: 0.8, settle: 0.7,
    pools: { brilliant: ["slow-blink", "nod", "look-down", "posture-reset"] },
  },
  "man-partner": {
    style: "curious", amplitude: 0.9, gaze: 1.15, settle: 0.85,
    pools: { great: ["blink", "head-tilt", "lean-in", "nod"] },
  },
  "woman-captain": {
    style: "deliberate", amplitude: 1, gaze: 0.95, settle: 1.15,
    pools: { encouraging: ["blink", "nod", "lean-in", "posture-reset"] },
  },
  "woman-analyst": {
    style: "measured", amplitude: 0.55, gaze: 0.65, settle: 0.65,
    pools: {
      book: ["slow-blink", "look-down", "glasses", "head-tilt"],
      thinking: ["slow-blink", "look-down", "breathe", "glasses"],
    },
  },
  "woman-spark": {
    style: "buoyant", amplitude: 1.15, gaze: 1.25, settle: 1.1,
    pools: {
      neutral: ["blink", "scan", "lean-in", "hair"],
      good: ["blink", "nod", "head-tilt", "hair"],
      blunder: ["blink", "sigh", "look-down", "hair"],
    },
  },
  "woman-blonde": {
    style: "reassuring", amplitude: 0.85, gaze: 0.9, settle: 0.95,
    pools: {
      idle: ["slow-blink", "head-tilt", "breathe", "hair"],
      encouraging: ["slow-blink", "nod", "breathe", "hair"],
    },
  },
  "human-boy": {
    style: "buoyant", amplitude: 1.18, gaze: 1.2, settle: 1.2,
    pools: { thinking: ["blink", "scan", "lean-in", "head-tilt"] },
  },
  "human-girl": {
    style: "curious", amplitude: 1.05, gaze: 1.25, settle: 1.05,
    pools: {
      brilliant: ["blink", "twinkle", "head-tilt", "lean-in"],
      check: ["blink", "scan", "lean-in", "posture-reset"],
    },
  },
  "dog-gentle": {
    style: "reassuring", amplitude: 0.7, gaze: 0.7, settle: 0.85,
    pools: {
      neutral: ["slow-blink", "glance", "breathe", "ears"],
      good: ["slow-blink", "nod", "breathe", "tail"],
      blunder: ["slow-blink", "sigh", "look-down", "ears"],
    },
  },
  "dog-corgi": {
    style: "buoyant", amplitude: 1.2, gaze: 1.05, settle: 1.2,
    pools: {
      neutral: ["ears", "posture-reset", "nod", "glance"],
      brilliant: ["ears", "tail", "nod", "lean-in"],
      best: ["ears", "nod", "lean-in", "posture-reset"],
      blunder: ["ears", "sigh", "look-down", "posture-reset"],
    },
  },
  "dog-collie": {
    style: "deliberate", amplitude: 1, gaze: 1.25, settle: 0.95,
    pools: {
      neutral: ["ears", "scan", "lean-in", "posture-reset"],
      thinking: ["ears", "scan", "look-down", "head-tilt"],
      recovered: ["blink", "nod", "tail", "posture-reset"],
    },
  },
  "dog-puppy": {
    style: "buoyant", amplitude: 1.2, gaze: 1.1, settle: 1.2,
    pools: {
      neutral: ["blink", "ears", "head-tilt", "tail"],
      brilliant: ["ears", "tail", "lean-in", "twinkle"],
      blunder: ["blink", "sigh", "ears", "look-down"],
      encouraging: ["slow-blink", "nod", "ears", "tail"],
    },
  },
  "cat-tuxedo": {
    style: "measured", amplitude: 0.65, gaze: 0.85, settle: 0.65,
    pools: {
      neutral: ["slow-blink", "glance", "head-tilt", "tail"],
      brilliant: ["slow-blink", "nod", "head-tilt", "tail"],
      check: ["ears", "scan", "lean-in", "posture-reset"],
    },
  },
  "cat-black": {
    style: "measured", amplitude: 0.55, gaze: 0.8, settle: 0.75,
    pools: {
      idle: ["slow-blink", "glance", "breathe", "tail"],
      thinking: ["slow-blink", "look-down", "head-tilt", "ears"],
      losing: ["slow-blink", "sigh", "breathe", "ears"],
    },
  },
  "cat-kitten": {
    style: "curious", amplitude: 1.15, gaze: 1.3, settle: 1.1,
    pools: {
      neutral: ["blink", "ears", "scan", "head-tilt"],
      brilliant: ["blink", "ears", "tail", "twinkle"],
      thinking: ["ears", "scan", "head-tilt", "lean-in"],
    },
  },
  gorilla: {
    style: "deliberate", amplitude: 0.65, gaze: 0.75, settle: 1.05,
    pools: { brilliant: ["slow-blink", "nod", "breathe", "posture-reset"] },
  },
  raccoon: {
    style: "curious", amplitude: 1.05, gaze: 1.25, settle: 1,
    pools: {
      neutral: ["blink", "scan", "ears", "head-tilt"],
      brilliant: ["blink", "lean-in", "tail", "nod"],
      missed: ["ears", "scan", "look-down", "head-tilt"],
    },
  },
  frog: {
    style: "measured", amplitude: 0.32, gaze: 0.45, settle: 0.55,
    pools: {
      neutral: ["blink", "breathe", "head-tilt", "glance"],
      brilliant: ["blink", "nod", "breathe", "posture-reset"],
      winning: ["slow-blink", "nod", "breathe", "head-tilt"],
    },
  },
  capybara: {
    style: "reassuring", amplitude: 0.4, gaze: 0.5, settle: 0.8,
    pools: { brilliant: ["slow-blink", "nod", "breathe", "head-tilt"] },
  },
  unicorn: {
    style: "buoyant", amplitude: 0.95, gaze: 1, settle: 0.9,
    pools: { encouraging: ["slow-blink", "nod", "head-tilt", "lean-in"] },
  },
  wizard: {
    style: "measured", amplitude: 0.65, gaze: 0.7, settle: 0.8,
    pools: {
      book: ["slow-blink", "look-down", "glasses", "head-tilt"],
      thinking: ["scan", "look-down", "glasses", "breathe"],
    },
  },
  slime: {
    style: "buoyant", amplitude: 1.2, gaze: 1, settle: 1.3,
    pools: { good: ["blink", "nod", "breathe", "posture-reset"] },
  },
  dragon: {
    style: "deliberate", amplitude: 0.9, gaze: 0.8, settle: 1.15,
    pools: { brilliant: ["slow-blink", "nod", "lean-in", "posture-reset"] },
  },
  ghost: {
    style: "measured", amplitude: 0.45, gaze: 0.65, settle: 0.6,
    pools: { check: ["slow-blink", "scan", "look-down", "lean-in"] },
  },
  mushroom: {
    style: "curious", amplitude: 0.6, gaze: 0.65, settle: 0.85,
    pools: {
      brilliant: ["slow-blink", "head-tilt", "nod", "breathe"],
      neutral: ["slow-blink", "head-tilt", "glance", "breathe"],
    },
  },
  alien: {
    style: "curious", amplitude: 0.75, gaze: 1.4, settle: 0.6,
    pools: { brilliant: ["scan", "head-tilt", "lean-in", "posture-reset"] },
  },
  robot: {
    style: "deliberate", amplitude: 0.65, gaze: 1.2, settle: 0.65,
    pools: {
      neutral: ["scan", "head-tilt", "look-down", "posture-reset"],
      brilliant: ["scan", "nod", "lean-in", "posture-reset"],
      blunder: ["scan", "look-down", "head-tilt", "posture-reset"],
      thinking: ["scan", "look-down", "head-tilt", "posture-reset"],
    },
  },
  "living-pawn": {
    style: "deliberate", amplitude: 1.05, gaze: 0.95, settle: 1.15,
    pools: {
      neutral: ["blink", "lean-in", "nod", "posture-reset"],
      brilliant: ["blink", "nod", "lean-in", "posture-reset"],
      encouraging: ["slow-blink", "nod", "lean-in", "posture-reset"],
    },
  },
} satisfies Record<CoachId, MotionDirection>;

export function coachPerformance(
  coachId: string,
  base: CoachDefinition["animation"],
): CoachDefinition["animation"] {
  const direction: MotionDirection = (
    motionDirections as Partial<Record<string, MotionDirection>>
  )[coachId] ?? {
    style: "reassuring", amplitude: 1, gaze: 1, settle: 1,
  };
  const pools: Pools = {
    ...expressionPools,
    ...styles[direction.style],
    ...direction.pools,
  };
  return {
    ...base,
    defaultIdle: pools.neutral,
    idleGestures: pools,
    motionProfile: {
      id: coachId,
      amplitude: direction.amplitude,
      gaze: direction.gaze,
      settle: direction.settle,
    },
  };
}
