import type { IdleChannel } from "./idleModel";
import type { CoachExpression, CoachId } from "./model";

const common: readonly IdleChannel[] = ["eyes", "gaze", "head", "body"];

// These are animated wrappers present in each production SVG, not inferred
// species traits. Keep this inventory beside the rendered-rig coverage when
// adding a coach or giving an existing character another articulated part.
const details = {
  classic: ["glasses", "glint"],
  "man-host": [],
  "man-expert": [],
  "man-partner": [],
  "woman-captain": ["hair"],
  "woman-analyst": ["hair", "glasses", "glint"],
  "woman-spark": ["hair"],
  "woman-blonde": ["hair"],
  "human-boy": ["hair"],
  "human-girl": ["hair"],
  "dog-gentle": ["leftEar", "rightEar", "tail", "glint"],
  "dog-corgi": ["leftEar", "rightEar", "tail", "glint"],
  "dog-collie": ["leftEar", "rightEar", "tail", "glint"],
  "dog-puppy": ["leftEar", "rightEar", "tail", "glint"],
  "cat-tuxedo": ["leftEar", "rightEar", "whiskers", "tail", "glint"],
  "cat-black": ["leftEar", "rightEar", "whiskers", "tail", "glint"],
  "cat-kitten": ["leftEar", "rightEar", "whiskers", "tail", "glint"],
  gorilla: ["leftEar", "rightEar", "glint"],
  raccoon: ["leftEar", "rightEar", "whiskers", "tail", "glint"],
  frog: ["throat", "glint"],
  capybara: ["leftEar", "rightEar", "whiskers", "glint"],
  unicorn: ["hair", "leftEar", "rightEar", "glint"],
  wizard: ["hair", "glasses", "glint"],
  dragon: ["leftEar", "rightEar", "glint"],
  ghost: ["glint"],
  alien: ["glint"],
  robot: ["lens", "scanline", "glint"],
  slime: ["glint"],
  mushroom: ["glint"],
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
