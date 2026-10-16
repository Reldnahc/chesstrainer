import { track } from "../idleModel";
import { signature } from "./signature";
import { attentive, positive, type SignatureCollection } from "./types";

export const scifiSignatures = {
  alien: [
    signature(
      "signature-a",
      "detail",
      "Human behavior detected",
      "One brow asks the question; the wide eyes narrow and refocus a beat later.",
      attentive,
      [
        track("brows", "unusual-alien-question", 1450),
        track("eyes", "unusual-alien-refocus", 1350, 100),
        track("gaze", "unusual-alien-inspect", 1200, 250),
      ],
      { cooldownMs: 6500 },
    ),
    signature(
      "signature-b",
      "attention",
      "A second look",
      "The eyes discover something off to the side before the head slowly catches up.",
      [...attentive, "good", "best", "encouraging", "recovered"],
      [
        track("gaze", "unusual-alien-discover", 1550),
        track("head", "unusual-alien-follow", 1250, 300),
      ],
      { cooldownMs: 6500 },
    ),
  ],
  robot: [
    signature(
      "signature-a",
      "detail",
      "Focus calibration",
      "The lens rings close and reopen while the antenna gives one springy correction.",
      [...attentive, "best", "good", "encouraging", "recovered"],
      [
        track("lens", "unusual-robot-aperture", 1400),
        track("antenna", "unusual-robot-aerial", 1200, 200),
      ],
      { cooldownMs: 6500 },
    ),
    signature(
      "signature-b",
      "attention",
      "Two-point inspection",
      "Two precise scan stops, followed by a small chassis correction and a return to center.",
      [...attentive, "check", "inaccuracy", "mistake", "missed"],
      [
        track("head", "unusual-robot-index", 1600),
        track("gaze", "unusual-robot-lock", 1600),
        track("body", "unusual-robot-level", 1400, 200),
      ],
      { cooldownMs: 7000 },
    ),
  ],
  "living-pawn": [
    signature(
      "signature-a",
      "body",
      "Find solid ground",
      "A small weight shift through the base, with the head quietly keeping its balance.",
      [...attentive, "inaccuracy", "mistake", "missed", "losing", "encouraging"],
      [
        track("body", "unusual-pawn-ground", 1550),
        track("head", "unusual-pawn-balance", 1450, 100),
      ],
      { cooldownMs: 6500 },
    ),
    signature(
      "signature-b",
      "body",
      "Stand a little taller",
      "The chest lifts from the planted base, then the face rises and settles with quiet resolve.",
      positive,
      [
        track("body", "unusual-pawn-resolve", 1650),
        track("head", "unusual-pawn-raise", 1450, 200),
        track("gaze", "unusual-pawn-horizon", 1200, 300),
      ],
      { cooldownMs: 7000 },
    ),
  ],
} satisfies SignatureCollection;
