/** Shared visual vocabulary; authoring adapters translate their own cue IDs here. */
export type SpeechMouthShape = 'closed' | 'consonant' | 'open' | 'wide' | 'round' | 'pucker' | 'lip-bite' | 'tongue' | 'rest';
export type SpeechMouthTrack = {
  durationSeconds: number;
  cues: readonly { start: number; end: number; shape: SpeechMouthShape }[];
};
export type SpeechMouthPose = { open: number; width: number; round: number; teeth: number; bite: number; tongue: number; press: number; jaw: number };

// Normalized rig targets. Mouth geometry remains the character's responsibility.
export const speechMouthPoses: Readonly<Record<SpeechMouthShape, SpeechMouthPose>> = {
  closed: { open: 0, width: .62, round: 0, teeth: 0, bite: 0, tongue: 0, press: 1, jaw: 0 },
  consonant: { open: .20, width: .90, round: 0, teeth: 1, bite: 0, tongue: 0, press: 0, jaw: .12 },
  open: { open: .58, width: .74, round: .10, teeth: .55, bite: 0, tongue: 0, press: 0, jaw: .55 },
  wide: { open: .94, width: .86, round: .06, teeth: .65, bite: 0, tongue: 0, press: 0, jaw: .96 },
  round: { open: .38, width: .34, round: .86, teeth: .10, bite: 0, tongue: 0, press: 0, jaw: .38 },
  pucker: { open: .30, width: .12, round: 1, teeth: 0, bite: 0, tongue: 0, press: 0, jaw: .22 },
  'lip-bite': { open: .20, width: .66, round: .04, teeth: 1, bite: 1, tongue: 0, press: 0, jaw: .10 },
  tongue: { open: .62, width: .74, round: .08, teeth: .60, bite: 0, tongue: 1, press: 0, jaw: .60 },
  rest: { open: 0, width: .58, round: 0, teeth: 0, bite: 0, tongue: 0, press: 0, jaw: 0 },
};

/** Absolute audio time avoids accumulated drift when rendering pauses or skips frames. */
export function speechMouthAt(track: SpeechMouthTrack, seconds: number): SpeechMouthShape {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= track.durationSeconds) return 'rest';
  let low = 0;
  let high = track.cues.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (track.cues[middle].end <= seconds) low = middle + 1;
    else high = middle;
  }
  const cue = track.cues[low];
  return cue && cue.start <= seconds ? cue.shape : 'rest';
}
