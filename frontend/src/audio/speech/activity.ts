import type { SpeechActivity } from "../model";

export type SpeechEnvelope = {
  readonly duration: number;
  readonly stepSeconds: number;
  readonly energy: Float32Array;
  readonly brightness: Float32Array;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Small PCM summary, shared by replays. Stereo energy never cancels opposite phases. */
export function createSpeechEnvelope(buffer: AudioBuffer): SpeechEnvelope {
  const step = Math.max(1, Math.round(buffer.sampleRate * .01));
  const count = Math.ceil(buffer.length / step);
  const energy = new Float32Array(count);
  const brightness = new Float32Array(count);
  const channels = Array.from({length: buffer.numberOfChannels}, (_, index) => buffer.getChannelData(index));
  for (let frame = 0; frame < count; frame++) {
    const start = frame * step;
    const end = Math.min(buffer.length, start + step);
    let strongest = 0;
    let crossings = 0;
    for (const samples of channels) {
      let squares = 0;
      let changes = 0;
      for (let index = start; index < end; index++) {
        const sample = samples[index];
        squares += sample * sample;
        if (index > 0 && (sample >= 0) !== (samples[index - 1] >= 0)) changes++;
      }
      if (squares > strongest) { strongest = squares; crossings = changes; }
    }
    energy[frame] = Math.sqrt(strongest / Math.max(1, end - start));
    // Zero crossings are only a gentle roughness/brightness hint, never a viseme.
    brightness[frame] = clamp(crossings * buffer.sampleRate / Math.max(1, end - start) / 6000);
  }

  const voiced = Array.from(energy).filter(value => value > .0012).sort((a, b) => a - b);
  const reference = voiced[Math.floor(Math.max(0, voiced.length - 1) * .95)] ?? 0;
  const floor = Math.max(.0012, reference * .055);
  let previousEnergy = 0;
  let previousBrightness = 0;
  for (let frame = 0; frame < count; frame++) {
    const raw = energy[frame];
    if (raw <= floor || reference <= floor) {
      // Genuine pauses close the mouth; smoothing must not smear them into speech.
      energy[frame] = brightness[frame] = previousEnergy = previousBrightness = 0;
      continue;
    }
    const target = Math.sqrt(clamp((raw - floor) / (reference - floor)));
    previousEnergy += (target - previousEnergy) * (target > previousEnergy ? .65 : .4);
    previousBrightness += (brightness[frame] - previousBrightness) * .45;
    energy[frame] = previousEnergy;
    brightness[frame] = previousBrightness;
  }
  return {duration: buffer.duration, stepSeconds: step / buffer.sampleRate, energy, brightness};
}

/** The caller supplies source time, so throttled rendering never accumulates drift. */
export function readSpeechEnvelope(envelope: SpeechEnvelope, elapsedSeconds: number): SpeechActivity | null {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds >= envelope.duration) return null;
  const frame = elapsedSeconds / envelope.stepSeconds;
  const index = Math.floor(frame);
  const mix = frame - index;
  const interpolate = (values: Float32Array) => {
    const current = values[index] ?? 0;
    return current + ((values[index + 1] ?? current) - current) * mix;
  };
  return {elapsedSeconds, energy: interpolate(envelope.energy), brightness: interpolate(envelope.brightness)};
}
