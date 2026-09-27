import type { CoachExpression } from "../model";

export type AnimalPose = {
  tilt: number;
  lift: number;
  eye: number;
  gaze: [number, number];
  ears: [number, number];
  brows: [string, string];
  mouth: "smile" | "grin" | "oh" | "concern" | "ponder";
  paws: "rest" | "offer" | "pair" | "chin" | "cheeks" | "celebrate" | "book";
  closed?: boolean;
  tail: number;
};
const base: AnimalPose = {
  tilt: 0,
  lift: 0,
  eye: 5.2,
  gaze: [0, 0],
  ears: [0, 0],
  brows: ["M29 32Q35 29 41 31", "M59 31Q65 29 71 32"],
  mouth: "smile",
  paws: "rest",
  tail: 0,
};
const pose = (overrides: Partial<AnimalPose>): AnimalPose => ({
  ...base,
  ...overrides,
});

export const animalPoses: Record<CoachExpression, AnimalPose> = {
  neutral: pose({}),
  idle: pose({ tilt: -3, eye: 4.2, gaze: [-1, 0.2], ears: [-4, 5] }),
  brilliant: pose({
    tilt: -7,
    lift: -2,
    eye: 6.3,
    ears: [8, -8],
    brows: ["M28 29Q35 24 42 28", "M58 28Q65 24 72 29"],
    mouth: "grin",
    paws: "pair",
    tail: -12,
  }),
  great: pose({
    tilt: 4,
    eye: 5.5,
    ears: [5, -5],
    mouth: "grin",
    paws: "offer",
    tail: -7,
  }),
  best: pose({
    tilt: -2,
    eye: 4,
    gaze: [0.6, 0],
    ears: [6, -2],
    brows: ["M29 31 41 32", "M59 32 71 30"],
    paws: "offer",
  }),
  good: pose({ tilt: 3, closed: true, ears: [-3, 3], tail: -4 }),
  book: pose({
    tilt: 5,
    eye: 4.5,
    gaze: [0, 1.3],
    ears: [3, -3],
    paws: "book",
    mouth: "ponder",
  }),
  inaccuracy: pose({
    tilt: 10,
    eye: 4,
    gaze: [-0.7, 0.5],
    ears: [-15, 4],
    brows: ["M29 29Q35 26 41 29", "M59 34 71 35"],
    mouth: "ponder",
    paws: "chin",
    tail: 8,
  }),
  mistake: pose({
    tilt: -7,
    lift: 2,
    closed: true,
    ears: [-23, 23],
    brows: ["M29 34Q35 32 41 29", "M59 29Q65 32 71 34"],
    mouth: "concern",
    paws: "offer",
    tail: 16,
  }),
  blunder: pose({
    tilt: 4,
    lift: 1,
    eye: 7.1,
    ears: [-30, 30],
    brows: ["M28 29Q35 24 42 26", "M58 26Q65 24 72 29"],
    mouth: "oh",
    paws: "cheeks",
    tail: 25,
  }),
  missed: pose({
    tilt: -10,
    eye: 5.7,
    gaze: [-1.7, -0.2],
    ears: [-17, 6],
    brows: ["M29 30Q35 28 41 32", "M59 31Q65 29 71 33"],
    mouth: "oh",
    paws: "offer",
    tail: 9,
  }),
  check: pose({
    tilt: -4,
    lift: 1,
    eye: 4.1,
    gaze: [0, 1],
    ears: [8, -8],
    brows: ["M29 30 41 34", "M59 34 71 30"],
    mouth: "ponder",
    paws: "offer",
    tail: -4,
  }),
  winning: pose({
    tilt: -5,
    lift: -3,
    closed: true,
    ears: [10, -10],
    mouth: "grin",
    paws: "celebrate",
    tail: -16,
  }),
  losing: pose({
    tilt: 6,
    lift: 3,
    eye: 3.7,
    gaze: [0, 1.3],
    ears: [-25, 25],
    brows: ["M29 35Q35 32 41 29", "M59 29Q65 32 71 35"],
    mouth: "concern",
    tail: 25,
  }),
  thinking: pose({
    tilt: -7,
    eye: 4.6,
    gaze: [1.4, -1],
    ears: [6, 13],
    brows: ["M29 31Q35 28 41 30", "M59 28Q65 25 71 28"],
    mouth: "ponder",
    paws: "chin",
  }),
  uncertain: pose({
    tilt: 12,
    eye: 5.6,
    gaze: [0.8, -0.3],
    ears: [-25, -3],
    brows: ["M29 28Q35 24 41 28", "M59 34 71 35"],
    mouth: "ponder",
    paws: "pair",
    tail: 6,
  }),
  encouraging: pose({
    tilt: -4,
    eye: 4.8,
    ears: [-6, 6],
    brows: ["M29 32Q35 28 41 30", "M59 30Q65 28 71 32"],
    mouth: "smile",
    paws: "offer",
    tail: -4,
  }),
  recovered: pose({
    tilt: 6,
    lift: -1,
    closed: true,
    ears: [5, -5],
    mouth: "grin",
    paws: "offer",
    tail: -10,
  }),
  explaining: pose({
    tilt: 4,
    eye: 4.8,
    gaze: [-0.6, 0.3],
    ears: [3, 8],
    brows: ["M29 30Q35 26 41 29", "M59 32Q65 29 71 32"],
    paws: "offer",
    mouth: "smile",
  }),
  draw: pose({ tilt: -2, eye: 4, ears: [-8, 8], paws: "pair", mouth: "smile" }),
};

export function animalPose(
  expression: CoachExpression,
  quiet: boolean,
): AnimalPose {
  const original = animalPoses[expression];
  return quiet
    ? {
        ...original,
        tilt: original.tilt * 0.6,
        eye: original.eye * 0.9,
        tail: original.tail * 0.6,
        paws:
          expression === "blunder"
            ? "chin"
            : expression === "brilliant"
              ? "offer"
              : original.paws,
      }
    : original;
}
