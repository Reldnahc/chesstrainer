import { expect, test } from '@playwright/test';
import { speechMouthAt, type SpeechMouthTrack } from '../src/coach/speechMouth';
import { mouthCueTrack, walterAlignment, walterAlignmentPreviews, walterOriginalAlignment } from '../src/audio/speech/alignment/previewTracks';

const track: SpeechMouthTrack = { durationSeconds: 1, cues: [
  { start: .1, end: .2, shape: 'closed' },
  { start: .2, end: .4, shape: 'round' },
  { start: .6, end: .8, shape: 'tongue' },
] };

test('mouth timing uses half-open cue boundaries and rests in gaps or outside the recording', () => {
  const cases = [
    [0, 'rest'], [.1, 'closed'], [.199, 'closed'], [.2, 'round'], [.399, 'round'],
    [.4, 'rest'], [.599, 'rest'], [.6, 'tongue'], [.8, 'rest'], [.999, 'rest'],
    [1, 'rest'], [2, 'rest'], [-1, 'rest'], [NaN, 'rest'], [Infinity, 'rest'],
  ] as const;
  for (const [seconds, shape] of cases) expect(speechMouthAt(track, seconds)).toBe(shape);
  expect(speechMouthAt({ durationSeconds: 1, cues: [] }, .5)).toBe('rest');
});

test('mouth timing is independent of previous samples after a seek or skipped frames', () => {
  for (const seconds of [.7, .15, .45, .25, 1, .25, .7, 0, .15]) {
    const expected = track.cues.find(cue => cue.start <= seconds && seconds < cue.end)?.shape ?? 'rest';
    expect(speechMouthAt(track, seconds)).toBe(expected);
  }
});

test('the alignment adapter translates all raw cue IDs and rejects malformed timing or unknown shapes', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
  const input = { metadata: { duration: 9 }, mouthCues: ids.map((value, index) => ({ start: index, end: index + 1, value })) };
  expect(mouthCueTrack(input)?.cues.map(cue => cue.shape))
    .toEqual(['closed', 'consonant', 'open', 'wide', 'round', 'pucker', 'lip-bite', 'tongue', 'rest']);
  for (const duration of [0, -1, NaN, Infinity]) {
    expect(mouthCueTrack({ ...input, metadata: { duration } })).toBeNull();
  }
  for (const cue of [
    { start: -1, end: 1, value: 'A' }, { start: 0, end: 0, value: 'A' },
    { start: 1, end: .5, value: 'A' }, { start: 0, end: 10, value: 'A' },
    { start: NaN, end: 1, value: 'A' }, { start: 0, end: Infinity, value: 'A' },
    { start: 0, end: 1, value: 'unknown' }, { start: 0, end: 1, value: 'constructor' },
  ]) expect(mouthCueTrack({ ...input, mouthCues: [cue] }), JSON.stringify(cue)).toBeNull();
  expect(mouthCueTrack({ ...input, mouthCues: [] })).toBeNull();
  expect(mouthCueTrack({ ...input, mouthCues: [
    { start: 0, end: 2, value: 'A' }, { start: 1, end: 3, value: 'B' },
  ] })).toBeNull();
});

test('comparison tracks are available only for their exact recording identities', () => {
  expect(walterAlignmentPreviews.map(item => item.scriptId).sort())
    .toEqual(['contrast-allowed-mate', 'contrast-sound-sacrifice']);
  for (const preview of walterAlignmentPreviews) {
    expect(preview.track).not.toBeNull();
    expect(preview.originalTrack).not.toBeNull();
    expect(preview.track!.cues).not.toEqual(preview.originalTrack!.cues);
    expect(walterAlignment(preview.voiceId, preview.scriptId)).toBe(preview.track);
    expect(walterOriginalAlignment(preview.voiceId, preview.scriptId)).toBe(preview.originalTrack);
    expect(walterAlignment('other-voice', preview.scriptId)).toBeUndefined();
    expect(walterOriginalAlignment('other-voice', preview.scriptId)).toBeUndefined();
  }
  expect(walterAlignment('walter', 'contrast-recovery')).toBeUndefined();
});
