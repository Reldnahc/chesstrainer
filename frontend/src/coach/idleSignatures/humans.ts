import { gesture, track, type IdleTrack } from "../idleModel";
import type { CoachExpression } from "../model";
import { attentive, concerned, positive, type SignatureCollection, type SignatureGesture } from "./types";

// These poses have no book or hand-to-face/hand-to-hand contact to preserve.
// The whole sleeve and hand rotate together around the shoulder attachment.
const freeHands: readonly CoachExpression[] = [
  "neutral", "idle", "best", "good", "encouraging", "explaining", "draw",
];
const reflective = [...attentive, ...concerned];

function signature(
  id: SignatureGesture["id"], label: string, description: string,
  expressions: readonly CoachExpression[], tracks: readonly IdleTrack[],
): SignatureGesture {
  return {
    ...gesture(id, "attention", tracks, { cooldownMs: 5200, weight: 0.8 }),
    id, label, description, expressions: [...new Set(expressions)],
  };
}

export const humanSignatures = {
  classic: [
    signature("signature-a", "Over the frames", "A supporting palm opens as he dips his head and peers over his settling glasses.", freeHands, [
      track("head", "human-story-peer", 1440), track("glasses", "human-story-frames", 1040, 160),
      track("gaze", "human-story-gaze", 1200, 80), track("leftArm", "human-story-palm", 1280),
    ]),
    signature("signature-b", "A familiar rhythm", "A small shoulder release leads into two warm nods, the second softer than the first.", positive, [
      track("body", "human-story-settle", 1480), track("head", "human-story-nods", 1360, 120),
    ]),
  ],
  "man-host": [
    signature("signature-a", "Room at the table", "His hands lift in turn, followed by a welcoming lean toward the board.", freeHands, [
      track("leftArm", "human-host-left", 1380), track("rightArm", "human-host-right", 1240, 140),
      track("body", "human-host-lean", 1380),
    ]),
    signature("signature-b", "Back with you", "He eases back for a beat, then returns with his eyes arriving before the head.", attentive, [
      track("body", "human-host-return", 1580), track("head", "human-host-head", 1420, 100),
      track("gaze", "human-host-look", 1180, 180),
    ]),
  ],
  "man-expert": [
    signature("signature-a", "Check both ends", "Two deliberate eye stops lead a measured head turn and a final confirming dip.", reflective, [
      track("gaze", "human-expert-compare", 1600), track("head", "human-expert-confirm", 1360, 240),
    ]),
    signature("signature-b", "Precisely settled", "A slight posture correction, quiet brow lift and almost imperceptible chin reset.", reflective, [
      track("body", "human-expert-posture", 1520), track("brows", "human-expert-brows", 960, 200),
      track("head", "human-expert-chin", 1180, 300),
    ]),
  ],
  "man-partner": [
    signature("signature-a", "Another angle", "He tilts one way, sends his eyes the other way, and considers the new angle with a raised brow.", attentive, [
      track("head", "human-partner-angle", 1600), track("gaze", "human-partner-counterlook", 1360, 100),
      track("brows", "human-partner-brow", 1140, 200),
    ]),
    signature("signature-b", "Your move", "An offered palm pauses, then the other hand follows while his posture opens toward the learner.", freeHands, [
      track("rightArm", "human-partner-offer", 1460), track("leftArm", "human-partner-follow", 1120, 240),
      track("body", "human-partner-open", 1480),
    ]),
  ],
  "woman-captain": [
    signature("signature-a", "Square and settle", "Shoulders square with two restrained arm adjustments before she settles back into attention.", freeHands, [
      track("body", "human-captain-square", 1280), track("leftArm", "human-captain-left", 1040, 80),
      track("rightArm", "human-captain-right", 1020, 160),
    ]),
    signature("signature-b", "One clear nod", "The brows anticipate one decisive nod, followed by a controlled, unhurried return.", positive, [
      track("brows", "human-captain-ready", 920), track("head", "human-captain-nod", 1300, 140),
    ]),
  ],
  "woman-analyst": [
    signature("signature-a", "Through the frames", "Her eyes lower first; a tiny glasses adjustment follows a held, thoughtful head dip.", reflective, [
      track("gaze", "human-analyst-read", 1620), track("head", "human-analyst-dip", 1480, 80),
      track("glasses", "human-analyst-frames", 1140, 280),
    ]),
    signature("signature-b", "Turn it over", "A restrained brow question and sideways refocus settle into a quiet breath.", reflective, [
      track("brows", "human-analyst-question", 1240), track("gaze", "human-analyst-refocus", 1460, 100),
      track("body", "human-analyst-release", 1560),
    ]),
  ],
  "woman-spark": [
    signature("signature-a", "A second look", "A quick glance turns into a little double take, with the curls catching up after the head.", attentive, [
      track("gaze", "human-spark-look", 1160), track("head", "human-spark-double", 1380, 100),
      track("hair", "human-spark-curls", 1180, 300),
    ]),
    signature("signature-b", "Lean into the idea", "A tiny backward anticipation turns into an eager lean and bright brow lift, then a soft hair settle.", positive, [
      track("body", "human-spark-lean", 1380), track("brows", "human-spark-brows", 1040, 120),
      track("hair", "human-spark-follow", 1120, 260),
    ]),
  ],
  "woman-blonde": [
    signature("signature-a", "The braid catches up", "A relaxed head turn and following gaze leave the braid swaying a beat behind.", attentive, [
      track("head", "human-braid-turn", 1460), track("gaze", "human-braid-look", 1160, 120),
      track("hair", "human-braid-sway", 1360, 220),
    ]),
    signature("signature-b", "Easy does it", "The shoulders release first, then each hand loosens in turn without losing its connection to the sleeve.", freeHands, [
      track("body", "human-braid-release", 1520), track("leftArm", "human-braid-left", 1140, 120),
      track("rightArm", "human-braid-right", 1120, 280),
    ]),
  ],
  "human-boy": [
    signature("signature-a", "Almost sitting still", "Mateo rocks toward the board, checks the movement, and lets his unruly hair finish the thought.", positive, [
      track("body", "human-milo-rock", 1360), track("head", "human-milo-check", 1120, 160),
      track("hair", "human-milo-hair", 1160, 220),
    ]),
    signature("signature-b", "Hang on, over there", "His eyes dart to a detail, his head follows late, and one hand gives a small answering lift.", freeHands, [
      track("gaze", "human-milo-spot", 1240), track("head", "human-milo-follow", 1280, 160),
      track("leftArm", "human-milo-hand", 1040, 260),
    ]),
  ],
  "human-girl": [
    signature("signature-a", "Follow the clue", "Tala looks across and down, holding an investigative tilt before carefully reversing it.", attentive, [
      track("gaze", "human-cleo-trace", 1520), track("head", "human-cleo-tilt", 1380, 140),
      track("brows", "human-cleo-question", 1120, 180),
    ]),
    signature("signature-b", "There it is", "A quick brow discovery becomes a small upward head beat; the hair answers with two softer movements.", positive, [
      track("brows", "human-cleo-found", 1040), track("head", "human-cleo-lift", 1220, 100),
      track("hair", "human-cleo-bounce", 1120, 300),
    ]),
  ],
} satisfies SignatureCollection;
