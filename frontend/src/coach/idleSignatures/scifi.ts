import { gesture, track } from "../idleModel";
import { attentive, positive, type SignatureCollection } from "./types";

export const scifiSignatures: SignatureCollection = {
  alien: [
    {
      ...gesture("signature-a", "detail", [
        track("brows", "unusual-alien-question", 1450),
        track("eyes", "unusual-alien-refocus", 1350, 100),
        track("gaze", "unusual-alien-inspect", 1200, 250),
      ], { cooldownMs: 6500 }),
      id: "signature-a", label: "Human behavior detected",
      description: "One brow asks the question; the wide eyes narrow and refocus a beat later.",
      expressions: attentive,
    },
    {
      ...gesture("signature-b", "attention", [
        track("gaze", "unusual-alien-discover", 1550),
        track("head", "unusual-alien-follow", 1250, 300),
      ], { cooldownMs: 6500 }),
      id: "signature-b", label: "A second look",
      description: "The eyes discover something off to the side before the head slowly catches up.",
      expressions: [...attentive, "good", "best", "encouraging", "recovered"],
    },
  ],
  robot: [
    {
      ...gesture("signature-a", "detail", [
        track("lens", "unusual-robot-aperture", 1400),
        track("antenna", "unusual-robot-aerial", 1200, 200),
      ], { cooldownMs: 6500 }),
      id: "signature-a", label: "Focus calibration",
      description: "The lens rings close and reopen while the antenna gives one springy correction.",
      expressions: [...attentive, "best", "good", "encouraging", "recovered"],
    },
    {
      ...gesture("signature-b", "attention", [
        track("head", "unusual-robot-index", 1600),
        track("gaze", "unusual-robot-lock", 1600),
        track("body", "unusual-robot-level", 1400, 200),
      ], { cooldownMs: 7000 }),
      id: "signature-b", label: "Two-point inspection",
      description: "Two precise scan stops, followed by a small chassis correction and a return to center.",
      expressions: [...attentive, "check", "inaccuracy", "mistake", "missed"],
    },
  ],
  "living-pawn": [
    {
      ...gesture("signature-a", "body", [
        track("body", "unusual-pawn-ground", 1550),
        track("head", "unusual-pawn-balance", 1450, 100),
      ], { cooldownMs: 6500 }),
      id: "signature-a", label: "Find solid ground",
      description: "A small weight shift through the base, with the head quietly keeping its balance.",
      expressions: [...attentive, "inaccuracy", "mistake", "missed", "losing", "encouraging"],
    },
    {
      ...gesture("signature-b", "body", [
        track("body", "unusual-pawn-resolve", 1650),
        track("head", "unusual-pawn-raise", 1450, 200),
        track("gaze", "unusual-pawn-horizon", 1200, 300),
      ], { cooldownMs: 7000 }),
      id: "signature-b", label: "Stand a little taller",
      description: "The chest lifts from the planted base, then the face rises and settles with quiet resolve.",
      expressions: positive,
    },
  ],
};
