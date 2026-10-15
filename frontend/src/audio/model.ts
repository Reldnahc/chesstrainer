import type { CoachUtterance } from "../dialogue/model";

export const soundCues = [
  "move", "capture", "castle", "promotion", "check", "mate", "correct", "retry",
  "complete",
] as const;
export type SoundCue = typeof soundCues[number];
export const soundPalettes = [
  "tabletop", "soft-objects", "retry-muted-tongue",
] as const;
export type SoundPalette = typeof soundPalettes[number];
export type SoundCategory = "board" | "practice";
export type AudioPreferences = {
  enabled: boolean;
  volume: number;
  board: boolean;
  practice: boolean;
  voice: "off" | "manual" | "automatic";
};
export const defaultAudioPreferences: AudioPreferences = {
  enabled: true, volume: .35, board: true, practice: true, voice: "automatic",
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

/** A practice result's correct/retry/complete cue follows its move by this much. */
export const FEEDBACK_CUE_DELAY_MS = 160;

export type SoundRequest = {
  cue: SoundCue;
  scope: string;
  eventId: string;
  palette?: SoundPalette;
  delayMs?: number;
};

/** The utterance identity and arbitration fields that playback reads; never its text. */
export type SpeechUtterance = Pick<CoachUtterance, "id" | "coachId" | "priority" | "interruptible">;

/** A provider prepares a clip elsewhere; playback does not generate speech or choose text. */
export type PreparedSpeechClip = {
  utterance: SpeechUtterance;
  buffer: AudioBuffer;
  scope: string;
  eventId?: string;
  recordingId?: string;
  /** An explicit Listen command may replace another scope's current narration. */
  interruptCurrent?: boolean;
};

/** Approximate speech activity from a recording, not phonemes or recognized words. */
export type SpeechActivity = {
  elapsedSeconds: number;
  energy: number;
  brightness: number;
};

/** Read-only presentation feed for one actual playback; stopped handles never revive. */
export type SpeechPlayback = {
  readonly scope: string;
  readonly eventId: string;
  readonly coachId: string;
  readonly utteranceId: string;
  readonly recordingId?: string;
  read: () => SpeechActivity | null;
};

/** A bundled recording of an existing utterance; playback never generates speech. */
export type RecordedSpeechClip = Omit<PreparedSpeechClip, "buffer"> & {
  url: string;
  /** Recordings spoken back to back as this one playback (url is the first). */
  sequence?: {urls: readonly string[]; gapSeconds: number};
  delayMs?: number;
};
