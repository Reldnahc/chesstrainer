import type { SoundCue } from "../model";

export type AuditionScenario = {
  id: string;
  label: string;
  description: string;
  steps: readonly { cue: SoundCue; delayMs: number }[];
  skipAfterMs?: number;
};

export const auditionScenarios: readonly AuditionScenario[] = [
  { id: "capture-check", label: "Capture + check", description: "A capture lands, followed by a clear check cue.",
    steps: [{ cue: "capture", delayMs: 0 }, { cue: "check", delayMs: 260 }] },
  { id: "correct-practice", label: "Correct practice", description: "The move lands, then a restrained confirmation.",
    steps: [{ cue: "move", delayMs: 0 }, { cue: "correct", delayMs: 260 }] },
  { id: "retry", label: "Try again", description: "Gentle feedback while the learner keeps thinking.",
    steps: [{ cue: "retry", delayMs: 0 }] },
  { id: "brilliant-blunder", label: "Brilliant & blunder", description: "Compare the emotional range, with room between reactions.",
    steps: [{ cue: "brilliant", delayMs: 0 }, { cue: "blunder", delayMs: 1400 }] },
  { id: "review-navigation", label: "Review navigation", description: "Five quick moves through a game. Listen for fatigue.",
    steps: [0, 180, 360, 540, 720].map(delayMs => ({ cue: "move", delayMs })) },
  { id: "skipped-playback", label: "Skipped playback", description: "Jump ahead before check and praise arrive. Old feedback is cancelled.",
    steps: [{ cue: "move", delayMs: 0 }, { cue: "check", delayMs: 700 }, { cue: "brilliant", delayMs: 1100 }],
    skipAfterMs: 180 },
];
