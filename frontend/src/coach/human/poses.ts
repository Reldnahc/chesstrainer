import type { CoachExpression } from "../model";

export type Gesture =
  | "rest"
  | "open"
  | "clap"
  | "chin"
  | "cheeks"
  | "present"
  | "fist"
  | "book"
  | "shrug"
  | "win";
export type Pose = {
  tilt: number;
  lift: number;
  eye: number;
  gaze: [number, number];
  brows: [string, string];
  mouth: string;
  open?: boolean;
  closedEyes?: boolean;
  gesture: Gesture;
  blush?: boolean;
  accent?: "stars" | "rays" | "question" | "check";
};
const brows: Pose["brows"] = ["M24 32 Q30 29 36 32", "M44 32 Q50 29 56 32"];
const smile = "M32 56 Q40 60 48 56 Q40 66 32 56Z";
const grin = "M30 54 Q40 57 50 54 Q49 68 40 68 Q31 67 30 54Z";
const base: Pose = {
  tilt: 0,
  lift: 0,
  eye: 3.8,
  gaze: [0, 0],
  brows,
  mouth: smile,
  gesture: "rest",
};
const pose = (changes: Partial<Pose>): Pose => ({ ...base, ...changes });

export const poses: Record<CoachExpression, Pose> = {
  neutral: pose({ mouth: "M34 57 Q40 61 46 57 Q40 63 34 57Z" }),
  idle: pose({
    tilt: -3,
    gaze: [-1.1, 0.3],
    eye: 3.1,
    mouth: "M34 57 Q40 60 46 57 Q41 62 34 57Z",
  }),
  brilliant: pose({
    tilt: -7,
    lift: -2,
    eye: 5.1,
    brows: ["M23 28 Q30 23 36 28", "M44 28 Q50 23 57 28"],
    mouth: grin,
    open: true,
    gesture: "open",
    blush: true,
    accent: "stars",
  }),
  great: pose({
    tilt: 5,
    lift: -1,
    eye: 3.2,
    brows: ["M24 30 Q30 26 36 30", "M44 30 Q50 26 56 30"],
    mouth: "M32 55 Q40 58 48 55 Q46 65 40 65 Q34 65 32 55Z",
    open: true,
    gesture: "clap",
    blush: true,
  }),
  best: pose({
    tilt: -3,
    eye: 2.9,
    gaze: [0.5, 0],
    brows: ["M24 31 L35 32", "M45 32 L56 30"],
    mouth: "M33 56 Q41 60 48 54 Q44 63 39 62 Q35 61 33 56Z",
    gesture: "present",
  }),
  good: pose({
    tilt: 2,
    eye: 3.1,
    mouth: smile,
    closedEyes: true,
    gesture: "rest",
    blush: true,
  }),
  book: pose({
    tilt: 4,
    gaze: [0, 1.6],
    eye: 3.2,
    brows: ["M24 32 Q30 29 36 31", "M44 31 Q50 29 56 32"],
    mouth: "M35 56 Q41 59 46 55 Q44 61 40 61 Q37 60 35 56Z",
    gesture: "book",
  }),
  inaccuracy: pose({
    tilt: 9,
    eye: 2.8,
    gaze: [-0.7, 0.3],
    brows: ["M24 30 Q30 25 36 28", "M44 33 Q50 32 56 34"],
    mouth: "M35 59 Q40 56 46 59 Q40 59 35 59Z",
    gesture: "chin",
  }),
  mistake: pose({
    tilt: -8,
    lift: 1.5,
    eye: 2.2,
    closedEyes: true,
    brows: ["M24 33 Q30 32 36 29", "M44 29 Q50 32 56 33"],
    mouth: "M33 61 Q40 55 47 61 Q40 58 33 61Z",
    gesture: "open",
  }),
  blunder: pose({
    tilt: 5,
    lift: 1.5,
    eye: 5.6,
    brows: ["M23 28 Q30 24 36 26", "M44 26 Q50 24 57 28"],
    mouth: "M35 59 Q35 53 40 53 Q45 53 45 59 Q45 67 40 67 Q35 67 35 59Z",
    open: true,
    gesture: "cheeks",
    accent: "rays",
  }),
  missed: pose({
    tilt: -10,
    eye: 3.9,
    gaze: [-1.8, -0.3],
    brows: ["M24 29 Q30 27 36 31", "M44 30 Q50 28 56 32"],
    mouth: "M37 56 Q44 53 46 57 Q47 62 43 62 Q38 61 37 56Z",
    open: true,
    gesture: "open",
  }),
  check: pose({
    tilt: -4,
    lift: 2,
    eye: 3.1,
    gaze: [0, 1],
    brows: ["M24 30 L36 33", "M44 33 L56 30"],
    mouth: "M34 57 Q40 56 47 57 Q40 60 34 57Z",
    gesture: "present",
    accent: "check",
  }),
  winning: pose({
    tilt: -5,
    lift: -3,
    eye: 3.5,
    closedEyes: true,
    brows: ["M24 29 Q30 24 36 29", "M44 29 Q50 24 56 29"],
    mouth: grin,
    open: true,
    gesture: "win",
    blush: true,
    accent: "stars",
  }),
  losing: pose({
    tilt: 5,
    lift: 3,
    eye: 2.6,
    gaze: [0, 1.2],
    brows: ["M24 33 Q30 31 36 28", "M44 28 Q50 31 56 33"],
    mouth: "M35 61 Q40 57 46 61 Q40 59 35 61Z",
    gesture: "rest",
  }),
  thinking: pose({
    tilt: -6,
    eye: 3.4,
    gaze: [1.4, -1.1],
    brows: ["M24 31 Q30 28 36 30", "M44 29 Q50 26 56 29"],
    mouth: "M36 58 Q40 57 45 58 Q40 60 36 58Z",
    gesture: "chin",
  }),
  uncertain: pose({
    tilt: 11,
    eye: 4,
    gaze: [0.8, -0.4],
    brows: ["M24 28 Q30 24 36 28", "M44 33 Q50 31 56 34"],
    mouth: "M34 59 Q39 61 43 57 Q46 55 48 58 Q43 61 39 62 Q36 62 34 59Z",
    gesture: "shrug",
    accent: "question",
  }),
  encouraging: pose({
    tilt: -4,
    lift: 0,
    eye: 3.5,
    brows: ["M24 32 Q30 27 36 30", "M44 30 Q50 27 56 32"],
    mouth: "M32 56 Q40 60 48 56 Q47 64 40 64 Q33 64 32 56Z",
    open: true,
    gesture: "open",
    blush: true,
  }),
  recovered: pose({
    tilt: 6,
    lift: -1,
    eye: 3,
    closedEyes: true,
    brows: ["M24 30 Q30 26 36 30", "M44 30 Q50 26 56 30"],
    mouth: grin,
    open: true,
    gesture: "fist",
    blush: true,
  }),
  explaining: pose({
    tilt: 4,
    eye: 3.7,
    gaze: [-0.8, 0.3],
    brows: ["M24 30 Q30 26 36 29", "M44 32 Q50 29 56 32"],
    mouth: "M33 56 Q40 57 47 55 Q47 63 41 63 Q36 63 33 56Z",
    open: true,
    gesture: "present",
  }),
  draw: pose({
    tilt: -2,
    eye: 3,
    brows: ["M24 31 Q30 29 36 31", "M44 31 Q50 29 56 31"],
    mouth: "M33 58 Q42 61 48 56 Q44 63 39 62 Q35 61 33 58Z",
    gesture: "shrug",
  }),
};

export const handPoses: Record<
  Gesture,
  { left: [number, number, number]; right: [number, number, number] }
> = {
  rest: { left: [17, 94, -8], right: [63, 94, 8] },
  open: { left: [12, 76, -35], right: [68, 74, 35] },
  clap: { left: [34, 80, 25], right: [47, 80, -25] },
  chin: { left: [18, 93, -8], right: [43, 65, -25] },
  cheeks: { left: [18, 56, -16], right: [62, 56, 16] },
  present: { left: [17, 93, -8], right: [68, 73, 60] },
  fist: { left: [18, 94, -8], right: [66, 70, 20] },
  book: { left: [25, 88, -20], right: [55, 88, 20] },
  shrug: { left: [12, 77, -65], right: [68, 77, 65] },
  win: { left: [12, 63, -23], right: [68, 63, 23] },
};
