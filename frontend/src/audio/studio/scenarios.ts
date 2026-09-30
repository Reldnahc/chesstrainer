import type { SoundCue } from "../model";

export type AuditionScenario = {
  id: string;
  label: string;
  description: string;
  steps: readonly { cue: SoundCue; delayMs: number }[];
  skipAfterMs?: number;
};

export type CandidateContextId = "single" | "repeated" | "full-mix";
type CandidateContext = AuditionScenario & { id: CandidateContextId; durationSeconds: number };

export const candidateContexts: readonly CandidateContext[] = [
  { id: "single", label: "One retry", durationSeconds: 3,
    description: "Move → try again → another move → correct. Compare the feedback with your usual move and success sounds.",
    steps: [{ cue: "move", delayMs: 0 }, { cue: "retry", delayMs: 160 },
      { cue: "move", delayMs: 1350 }, { cue: "correct", delayMs: 1510 }] },
  { id: "repeated", label: "Repeated attempts", durationSeconds: 10,
    description: "Three attempts with try-again feedback, then a correct move and completion. Listen for whether repetition becomes tiring.",
    steps: [{ cue: "move", delayMs: 0 }, { cue: "retry", delayMs: 160 },
      { cue: "move", delayMs: 1900 }, { cue: "retry", delayMs: 2060 },
      { cue: "move", delayMs: 3800 }, { cue: "retry", delayMs: 3960 },
      { cue: "move", delayMs: 5900 }, { cue: "correct", delayMs: 6060 },
      { cue: "complete", delayMs: 7600 }] },
  { id: "full-mix", label: "Full sound mix", durationSeconds: 10,
    description: "Move → capture → check → an attempt and retry → a correct move → completion. Compare texture and volume across the set.",
    steps: [{ cue: "move", delayMs: 0 }, { cue: "capture", delayMs: 1000 },
      { cue: "check", delayMs: 2000 }, { cue: "move", delayMs: 3500 },
      { cue: "retry", delayMs: 3660 }, { cue: "move", delayMs: 5200 },
      { cue: "correct", delayMs: 5360 }, { cue: "complete", delayMs: 7500 }] },
];

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
