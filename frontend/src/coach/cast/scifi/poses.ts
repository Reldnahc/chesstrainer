import type { CSSProperties } from "react";
import type { CoachExpression } from "../../model";

export type CastHands = "rest" | "offer" | "lift" | "brace" | "chin" | "resolve" | "balance" | "book";
export type CastMouth = "smile" | "grin" | "round" | "wince" | "flat" | "concern";
export type CastPose = {
  tilt: number;
  lift: number;
  eye: number;
  gaze: readonly [number, number];
  brows: readonly [number, number];
  mouth: CastMouth;
  hands: CastHands;
  closed?: boolean;
};

const rest: CastPose = {
  tilt: 0,
  lift: 0,
  eye: 1,
  gaze: [0, 0],
  brows: [0, 0],
  mouth: "smile",
  hands: "rest",
};
const p = (change: Partial<CastPose>): CastPose => ({ ...rest, ...change });

// The body language is shared by meaning, while each artwork gives those
// poses its own anatomy, expression shapes and level of emotional amplitude.
export const castPoses: Record<CoachExpression, CastPose> = {
  neutral: p({}),
  idle: p({ tilt: -3, eye: 0.85, gaze: [-1, 0], hands: "rest" }),
  brilliant: p({ tilt: -6, lift: -2, eye: 1.2, brows: [-10, 10], mouth: "grin", hands: "lift" }),
  great: p({ tilt: 3, lift: -1, eye: 1.05, brows: [-6, 6], mouth: "grin", hands: "offer" }),
  best: p({ tilt: -2, eye: 0.8, brows: [7, -7], hands: "resolve" }),
  good: p({ tilt: 3, closed: true, hands: "rest" }),
  book: p({ tilt: 2, eye: 0.8, gaze: [0, 1.5], mouth: "flat", hands: "book" }),
  inaccuracy: p({ tilt: 8, eye: 0.75, gaze: [-1, 0.3], brows: [-13, -2], mouth: "wince", hands: "chin" }),
  mistake: p({ tilt: -5, lift: 1, eye: 0.72, brows: [-15, 15], mouth: "concern", hands: "offer" }),
  blunder: p({ tilt: 5, lift: 1, eye: 1.4, brows: [-18, 18], mouth: "round", hands: "brace" }),
  missed: p({ tilt: -8, eye: 1.08, gaze: [-2, 0], brows: [-8, 7], mouth: "round", hands: "offer" }),
  check: p({ tilt: -2, lift: -1, eye: 0.72, gaze: [0, 1], brows: [17, -17], mouth: "flat", hands: "resolve" }),
  winning: p({ tilt: -4, lift: -3, closed: true, brows: [-10, 10], mouth: "grin", hands: "lift" }),
  losing: p({ tilt: 5, lift: 3, eye: 0.55, gaze: [0, 1.5], brows: [-16, 16], mouth: "concern", hands: "rest" }),
  thinking: p({ tilt: -6, eye: 0.8, gaze: [1.6, -1], brows: [-3, 12], mouth: "flat", hands: "chin" }),
  uncertain: p({ tilt: 10, eye: 0.9, gaze: [0.8, 0], brows: [-18, -7], mouth: "wince", hands: "balance" }),
  encouraging: p({ tilt: -4, eye: 0.9, brows: [-7, 7], hands: "offer" }),
  recovered: p({ tilt: 4, lift: -1, closed: true, mouth: "grin", hands: "resolve" }),
  explaining: p({ tilt: 3, eye: 0.9, gaze: [-0.5, 0], brows: [-8, 0], mouth: "smile", hands: "offer" }),
  draw: p({ tilt: -1, eye: 0.8, mouth: "smile", hands: "balance" }),
};

export function poseStyle(pose: CastPose, temperament = 1): CSSProperties {
  return {
    "--study-tilt": `${pose.tilt * temperament}deg`,
    "--study-lift": `${pose.lift * temperament}px`,
    "--study-temperament": temperament,
  } as CSSProperties;
}

export const mouthPaths: Record<CastMouth, string> = {
  smile: "M43 65q7 6 14 0",
  grin: "M40 63q10 4 20 0-1 12-10 12T40 63Z",
  round: "M46 66a4 6 0 1 0 8 0 4 6 0 1 0-8 0Z",
  wince: "m43 69 5-2 4 2 5-2",
  flat: "M44 68h12",
  concern: "M43 69q7-6 14 0",
};
