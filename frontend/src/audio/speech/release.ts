/**
 * Where a recorded line's final sound should be faded out.
 *
 * Provider voices often stop their last sound abruptly (a step from about 25 dB
 * under speaking level to silence), which is heard as a thump; a few also end on
 * a click after the voice. The release starts where the final sound has already
 * fallen 20 dB under the line's speaking level and ends where it falls 45 dB
 * under it. Playback fades over that span and stays silent afterwards, so the
 * words themselves are never shortened and nothing after the voice is heard.
 */
export type SpeechRelease = {readonly start: number; readonly end: number};

const FRAME_SECONDS = .005;
const BODY_DB = 20;
const VOICE_DB = 45;
// A loud run shorter than this after the voice is a click, not speech.
const VOICE_RUN_FRAMES = 3;
const MIN_SECONDS = .03;
const MAX_SECONDS = .15;
// Frames quieter than this are silence whatever the line's level.
const SILENCE_DB = -80;

export function findSpeechRelease(buffer: AudioBuffer): SpeechRelease | null {
  const step = Math.max(1, Math.round(buffer.sampleRate * FRAME_SECONDS));
  const count = Math.floor(buffer.length / step);
  if (count < VOICE_RUN_FRAMES) return null;
  const channels = Array.from({length: buffer.numberOfChannels}, (_, index) => buffer.getChannelData(index));
  const levels = new Float64Array(count);
  for (let frame = 0; frame < count; frame++) {
    let strongest = 0;
    for (const samples of channels) {
      let squares = 0;
      for (let index = frame * step; index < (frame + 1) * step; index++) squares += samples[index] * samples[index];
      strongest = Math.max(strongest, squares / step);
    }
    levels[frame] = 10 * Math.log10(strongest + 1e-12);
  }
  const speaking = Float64Array.from(levels).sort()[Math.floor((count - 1) * .9)];
  let endFrame = -1;
  for (let frame = count - 1, run = 0; frame >= 0 && endFrame < 0; frame--) {
    run = levels[frame] > Math.max(speaking - VOICE_DB, SILENCE_DB) ? run + 1 : 0;
    if (run >= VOICE_RUN_FRAMES) endFrame = frame + run;
  }
  // Any louder frame inside the voice, even a short final consonant, keeps its full level.
  let bodyFrame = endFrame;
  while (bodyFrame > 0 && levels[bodyFrame - 1] <= speaking - BODY_DB) bodyFrame--;
  if (endFrame < 0 || bodyFrame <= 0) return null;
  const end = endFrame * step, body = bodyFrame * step;
  const start = Math.round(Math.max(0, Math.min(body, end - MIN_SECONDS * buffer.sampleRate), end - MAX_SECONDS * buffer.sampleRate));
  return {start: start / buffer.sampleRate, end: end / buffer.sampleRate};
}
