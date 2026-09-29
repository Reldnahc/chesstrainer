import type { IdleChannel } from "./idleModel";
import type { CoachExpression, CoachId } from "./model";

const common: readonly IdleChannel[] = ["eyes", "gaze", "head", "body"];

// These are animated wrappers present in each production SVG, not inferred
// species traits. Keep this inventory beside the rendered-rig coverage when
// adding a coach or giving an existing character another articulated part.
const human: readonly IdleChannel[] = ["brows", "leftArm", "rightArm"];
const paws: readonly IdleChannel[] = ["leftPaw", "rightPaw"];
const details = {
  classic: [...human, "glasses", "glint"],
  "man-host": human,
  "man-expert": human,
  "man-partner": human,
  "woman-captain": [...human, "hair"],
  "woman-analyst": [...human, "hair", "glasses", "glint"],
  "woman-spark": [...human, "hair"],
  "woman-blonde": [...human, "hair"],
  "human-boy": [...human, "hair"],
  "human-girl": [...human, "hair"],
  "dog-gentle": [...paws, "leftEar", "rightEar", "tail", "glint"],
  "dog-corgi": [...paws, "leftEar", "rightEar", "tail", "glint"],
  "dog-collie": [...paws, "leftEar", "rightEar", "tail", "glint"],
  "dog-puppy": [...paws, "leftEar", "rightEar", "tail", "glint"],
  "cat-tuxedo": [...paws, "leftEar", "rightEar", "whiskers", "tail", "glint"],
  "cat-black": [...paws, "leftEar", "rightEar", "whiskers", "tail", "glint"],
  "cat-kitten": [...paws, "leftEar", "rightEar", "whiskers", "tail", "glint"],
  gorilla: [...paws, "leftEar", "rightEar", "glint"],
  raccoon: [...paws, "leftEar", "rightEar", "whiskers", "tail", "glint"],
  frog: [...paws, "throat", "glint"],
  capybara: [...paws, "leftEar", "rightEar", "whiskers", "glint"],
  unicorn: ["hair", "leftEar", "rightEar", "glint"],
  wizard: ["hair", "glasses", "glint", "hem", "leftArm", "rightArm"],
  dragon: ["leftEar", "rightEar", "glint", "wings"],
  ghost: ["glint", "hem"],
  alien: ["glint", "brows"],
  robot: ["lens", "scanline", "glint", "antenna"],
  slime: ["glint", "hem"],
  mushroom: ["glint", "cap"],
  "living-pawn": ["glint"],
} satisfies Record<CoachId, readonly IdleChannel[]>;

// Special eye artwork can replace the usual light reflection. Closed reaction
// eyelids are deliberately not included here: this describes the settled rig.
const omitted: Partial<Record<CoachId, Partial<Record<CoachExpression, readonly IdleChannel[]>>>> = {
  robot: { blunder: ["glint"] },
  "living-pawn": { brilliant: ["glint"] },
};

export function rigChannels(coachId: string, expression: CoachExpression): readonly IdleChannel[] {
  if (!Object.hasOwn(details, coachId)) return common;
  const id = coachId as CoachId;
  const hidden = omitted[id]?.[expression] ?? [];
  const channels: IdleChannel[] = [...common, ...details[id]];
  if (expression === "brilliant" || expression === "winning") channels.push("stars");
  return channels.filter(channel => !hidden.includes(channel));
}
