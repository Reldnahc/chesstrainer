/** Shared visual vocabulary; authoring adapters translate their own cue IDs here. */
export type SpeechMouthShape =
  "closed" | "consonant" | "open" | "wide" | "round" | "pucker" | "lip-bite" | "tongue" | "rest";
export type SpeechMouthTrack = {
  durationSeconds: number;
  cues: readonly { start: number; end: number; shape: SpeechMouthShape }[];
};
export type SpeechMouthPose = {
  open: number;
  width: number;
  round: number;
  teeth: number;
  bite: number;
  tongue: number;
  press: number;
  jaw: number;
};

// Normalized rig targets. Mouth geometry remains the character's responsibility.
export const speechMouthPoses: Readonly<Record<SpeechMouthShape, SpeechMouthPose>> = {
  closed: { open: 0, width: 0.62, round: 0, teeth: 0, bite: 0, tongue: 0, press: 1, jaw: 0 },
  consonant: { open: 0.2, width: 0.9, round: 0, teeth: 1, bite: 0, tongue: 0, press: 0, jaw: 0.12 },
  open: {
    open: 0.58,
    width: 0.74,
    round: 0.1,
    teeth: 0.55,
    bite: 0,
    tongue: 0,
    press: 0,
    jaw: 0.55,
  },
  wide: {
    open: 0.94,
    width: 0.86,
    round: 0.06,
    teeth: 0.65,
    bite: 0,
    tongue: 0,
    press: 0,
    jaw: 0.96,
  },
  round: {
    open: 0.38,
    width: 0.34,
    round: 0.86,
    teeth: 0.1,
    bite: 0,
    tongue: 0,
    press: 0,
    jaw: 0.38,
  },
  pucker: { open: 0.3, width: 0.12, round: 1, teeth: 0, bite: 0, tongue: 0, press: 0, jaw: 0.22 },
  "lip-bite": {
    open: 0.2,
    width: 0.66,
    round: 0.04,
    teeth: 1,
    bite: 1,
    tongue: 0,
    press: 0,
    jaw: 0.1,
  },
  tongue: {
    open: 0.62,
    width: 0.74,
    round: 0.08,
    teeth: 0.6,
    bite: 0,
    tongue: 1,
    press: 0,
    jaw: 0.6,
  },
  rest: { open: 0, width: 0.58, round: 0, teeth: 0, bite: 0, tongue: 0, press: 0, jaw: 0 },
};

/** Absolute audio time avoids accumulated drift when rendering pauses or skips frames. */
export function speechMouthAt(track: SpeechMouthTrack, seconds: number): SpeechMouthShape {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= track.durationSeconds) return "rest";
  let low = 0;
  let high = track.cues.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (track.cues[middle].end <= seconds) low = middle + 1;
    else high = middle;
  }
  const cue = track.cues[low];
  return cue && cue.start <= seconds ? cue.shape : "rest";
}
