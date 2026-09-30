import type { CoachUtterance } from "../dialogue/model";

export const soundCues = [
  "move", "capture", "castle", "promotion", "check", "mate", "correct", "retry",
  "complete",
] as const;
export type SoundCue = typeof soundCues[number];
export const soundPalettes = [
  "recorded-chess", "tabletop", "soft-objects",
  "retry-wood-stop", "retry-muted-block", "retry-gentle-knocks",
  "retry-wood-check", "retry-soft-resistance", "retry-lock-stop",
  "retry-latch-catch", "retry-case-click", "retry-pedal-release",
  "retry-latch-back", "retry-cup-tap", "retry-ceramic-pair",
  "retry-muted-tongue", "retry-metal-stop", "retry-glass-contact",
  "retry-bass-stop", "retry-cello-question", "retry-fret-catch",
  "retry-unsettled-chord", "retry-cello-step", "retry-piano-slip",
  "retry-soft-vibes", "retry-low-marimba", "retry-high-marimba",
  "retry-prepared-keys", "retry-wood-and-vibes", "retry-ceramic-and-bass",
  "retry-board-and-cello", "retry-wood-and-strings", "retry-glass-and-box",
] as const;
export type SoundPalette = typeof soundPalettes[number];
export type SoundCategory = "board" | "practice";
export type AudioPreferences = {
  enabled: boolean;
  volume: number;
  board: boolean;
  practice: boolean;
};
export const defaultAudioPreferences: AudioPreferences = {
  enabled: true, volume: .35, board: true, practice: true,
};

/** Only pass server-supplied SAN for an accepted/displayed move. No board inference. */
export function cueForMove(san: string | null | undefined): SoundCue | null {
  if (!san?.trim()) return null;
  if (san.includes("#")) return "mate";
  if (san.includes("+")) return "check";
  if (san.includes("=")) return "promotion";
  if (/^(?:O-O|0-0)/.test(san.trim())) return "castle";
  if (san.includes("x")) return "capture";
  return "move";
}

export type SoundRequest = {
  cue: SoundCue;
  scope: string;
  eventId: string;
  palette?: SoundPalette;
  delayMs?: number;
};

/** A provider prepares a clip elsewhere; playback does not generate speech or choose text. */
export type PreparedSpeechClip = {
  utterance: CoachUtterance;
  buffer: AudioBuffer;
  scope: string;
  eventId?: string;
};
