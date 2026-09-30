import type { CoachUtterance } from "../dialogue/model";

export const soundCues = [
  "move", "capture", "castle", "promotion", "check", "mate", "correct", "retry",
  "complete",
] as const;
export type SoundCue = typeof soundCues[number];
export const soundPalettes = [
  "recorded-chess", "tabletop", "soft-objects",
  "retry-soft-error", "retry-downturn", "retry-oops",
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
