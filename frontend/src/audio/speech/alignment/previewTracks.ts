import sacrifice from './sound-sacrifice.json' with { type: 'json' };
import mate from './allowed-mate.json' with { type: 'json' };
import sacrificeForced from './sound-sacrifice-forced.json' with { type: 'json' };
import mateForced from './allowed-mate-forced.json' with { type: 'json' };
import type { SpeechMouthShape, SpeechMouthTrack } from '../../../coach/speechMouth';

const shapes: Readonly<Record<string, SpeechMouthShape>> = {
  A: 'closed', B: 'consonant', C: 'open', D: 'wide', E: 'round',
  F: 'pucker', G: 'lip-bite', H: 'tongue', X: 'rest',
};

/** Both offline generators use the same cue alphabet, outside the shared rig. */
export function mouthCueTrack(input: { metadata: { duration: number }; mouthCues: { start: number; end: number; value: string }[] }): SpeechMouthTrack | null {
  if (!Number.isFinite(input.metadata.duration) || input.metadata.duration <= 0) return null;
  let previous = 0;
  const cues: SpeechMouthTrack['cues'][number][] = [];
  for (const cue of input.mouthCues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < previous
      || cue.end <= cue.start || cue.end > input.metadata.duration || !Object.hasOwn(shapes, cue.value)) return null;
    cues.push({ start: cue.start, end: cue.end, shape: shapes[cue.value] });
    previous = cue.end;
  }
  return cues.length ? { durationSeconds: input.metadata.duration, cues } : null;
}

// Development-only imports: generated cue files never enter the application bundle.
const originalTracks = [sacrifice, mate];
export const walterAlignmentPreviews = [sacrificeForced, mateForced].map(record => {
  const original = originalTracks.find(candidate => candidate.scriptId === record.scriptId && candidate.voiceId === record.voiceId);
  return { scriptId: record.scriptId, voiceId: record.voiceId, track: mouthCueTrack(record),
    originalTrack: original ? mouthCueTrack(original) : null };
});
export function walterAlignment(voiceId: string, scriptId: string) {
  return walterAlignmentPreviews.find(record => record.voiceId === voiceId && record.scriptId === scriptId)?.track ?? undefined;
}
export function walterOriginalAlignment(voiceId: string, scriptId: string) {
  return walterAlignmentPreviews.find(record => record.voiceId === voiceId && record.scriptId === scriptId)?.originalTrack ?? undefined;
}
