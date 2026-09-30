import type { SoundCue } from "../model";

export type AuditionScenario = {
  id: string;
  label: string;
  description: string;
  steps: readonly { cue: SoundCue; delayMs: number }[];
  skipAfterMs?: number;
};

export const auditionScenarios: readonly AuditionScenario[] = [
  { id: "capture-check", label: "Capture, then check", description: "Two moves: a capture, then a checking move.",
    steps: [{ cue: "capture", delayMs: 0 }, { cue: "check", delayMs: 900 }] },
  { id: "correct-practice", label: "Correct practice", description: "The move lands, then a restrained confirmation.",
    steps: [{ cue: "move", delayMs: 0 }, { cue: "correct", delayMs: 260 }] },
  { id: "retry", label: "Try again", description: "Gentle feedback while the learner keeps thinking.",
    steps: [{ cue: "retry", delayMs: 0 }] },
  { id: "game-finish", label: "Game finish", description: "Checkmate lands, followed by a completion cue.",
    steps: [{ cue: "mate", delayMs: 0 }, { cue: "complete", delayMs: 1400 }] },
  { id: "review-navigation", label: "Review navigation", description: "Five quick moves through a game. Listen for fatigue.",
    steps: [0, 180, 360, 540, 720].map(delayMs => ({ cue: "move", delayMs })) },
  { id: "skipped-playback", label: "Skipped playback", description: "Jump ahead before check and completion arrive. Old feedback is cancelled.",
    steps: [{ cue: "move", delayMs: 0 }, { cue: "check", delayMs: 700 }, { cue: "complete", delayMs: 1100 }],
    skipAfterMs: 180 },
];
