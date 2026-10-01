import {test, expect} from "@playwright/test";
import {createSpeechEnvelope, readSpeechEnvelope} from "../src/audio/speech/activity";

function pcm(channels: Float32Array[], sampleRate = 10000): AudioBuffer {
  return {numberOfChannels: channels.length, length: channels[0].length, sampleRate,
    duration: channels[0].length / sampleRate, getChannelData: (index: number) => channels[index]} as AudioBuffer;
}
function tone(amplitude = .4, frequency = 200) {
  return Float32Array.from({length: 10000}, (_, index) =>
    index < 2000 || index >= 6000 ? 0 : amplitude * Math.sin(index * Math.PI * 2 * frequency / 10000));
}

test("speech envelope keeps leading, internal and trailing silence closed", () => {
  const samples = tone();
  samples.fill(0, 3500, 4200);
  const envelope = createSpeechEnvelope(pcm([samples]));
  for (const time of [0, .1, .37, .4, .7, .99]) {
    expect(readSpeechEnvelope(envelope, time)).toEqual({elapsedSeconds: time, energy: 0, brightness: 0});
  }
  expect(readSpeechEnvelope(envelope, .3)!.energy).toBeGreaterThan(.8);
  expect(readSpeechEnvelope(envelope, .5)!.energy).toBeGreaterThan(.8);
  expect(readSpeechEnvelope(envelope, 1)).toBeNull();
  expect(readSpeechEnvelope(envelope, -.1)).toBeNull();
  expect(readSpeechEnvelope(envelope, Number.NaN)).toBeNull();
});

test("speech envelope normalizes useful recording levels without amplifying silence or noise", () => {
  const quiet = createSpeechEnvelope(pcm([tone(.04)]));
  const loud = createSpeechEnvelope(pcm([tone(.8)]));
  expect(readSpeechEnvelope(quiet, .3)!.energy).toBeCloseTo(readSpeechEnvelope(loud, .3)!.energy, 4);
  for (const amplitude of [0, .0005]) {
    const noise = createSpeechEnvelope(pcm([tone(amplitude)]));
    expect([...noise.energy]).toEqual(Array(noise.energy.length).fill(0));
    expect([...noise.brightness]).toEqual(Array(noise.brightness.length).fill(0));
  }
});

test("stereo opposite phases and a silent channel retain the voiced channel's energy", () => {
  const samples = tone();
  const single = createSpeechEnvelope(pcm([samples]));
  for (const other of [samples.map(value => -value), new Float32Array(samples.length)]) {
    const stereo = createSpeechEnvelope(pcm([other, samples]));
    expect([...stereo.energy]).toEqual([...single.energy]);
  }
});

test("energy follows syllable strength and brightness distinguishes rougher audio without inventing phonemes", () => {
  const samples = tone();
  for (let index = 4000; index < 6000; index++) samples[index] *= .2;
  const envelope = createSpeechEnvelope(pcm([samples]));
  expect(readSpeechEnvelope(envelope, .3)!.energy).toBeGreaterThan(readSpeechEnvelope(envelope, .5)!.energy);
  const low = readSpeechEnvelope(createSpeechEnvelope(pcm([tone(.4, 100)])), .3)!;
  const high = readSpeechEnvelope(createSpeechEnvelope(pcm([tone(.4, 1500)])), .3)!;
  expect(high.brightness).toBeGreaterThan(low.brightness + .3);
  for (const values of [envelope.energy, envelope.brightness]) {
    expect([...values].every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  }
});

test("sampling uses absolute source time and interpolates without frame-history drift", () => {
  const envelope = createSpeechEnvelope(pcm([tone()], 11025));
  const target = readSpeechEnvelope(envelope, .27);
  for (const elapsed of [.03, .4, .14, .7, .02]) readSpeechEnvelope(envelope, elapsed);
  expect(readSpeechEnvelope(envelope, .27)).toEqual(target);
  const left = readSpeechEnvelope(envelope, envelope.stepSeconds * 22)!;
  const right = readSpeechEnvelope(envelope, envelope.stepSeconds * 23)!;
  const middle = readSpeechEnvelope(envelope, envelope.stepSeconds * 22.5)!;
  expect(middle.energy).toBeCloseTo((left.energy + right.energy) / 2, 5);
});
