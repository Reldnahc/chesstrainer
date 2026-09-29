export const IDLE_GAP_MS = [500, 1000] as const;

// Channels name animated SVG wrappers, not conceptual body parts. Nested head
// and gaze transforms compose; two writers of the same channel never do.
export const idleChannels = [
  "eyes", "gaze", "head", "body", "glasses", "hair", "leftEar", "rightEar",
  "whiskers", "tail", "stars", "glint", "scanline", "lens", "throat",
] as const;
export type IdleChannel = (typeof idleChannels)[number];
export type IdleTrack = {
  channel: IdleChannel;
  keyframes: string;
  durationMs: number;
  delayMs?: number;
};
export type IdleGesture = {
  id: string;
  group: "eyes" | "attention" | "body" | "detail";
  tracks: readonly IdleTrack[];
  durationMs: number;
  cooldownMs: number;
  weight: number;
  intensity: "quiet" | "noticeable";
  blink?: boolean;
};

export function gesture(
  id: string,
  group: IdleGesture["group"],
  tracks: readonly IdleTrack[],
  options: Partial<Pick<IdleGesture, "cooldownMs" | "weight" | "intensity" | "blink">> = {},
): IdleGesture {
  return {
    id, group, tracks,
    durationMs: Math.max(...tracks.map((track) => track.durationMs + (track.delayMs ?? 0))),
    cooldownMs: 1800, weight: 1, intensity: "noticeable", ...options,
  };
}

export function track(
  channel: IdleChannel, keyframes: string, durationMs: number, delayMs = 0,
): IdleTrack {
  return { channel, keyframes: `coach-idle-${keyframes}`, durationMs, delayMs };
}
