import { test, expect } from "../tests/helpers/browserTest";
import { createSpeechEnvelope, readSpeechEnvelope } from "../src/audio/speech/activity";

function pcm(channels: Float32Array[], sampleRate = 10000): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    duration: channels[0].length / sampleRate,
    getChannelData: (index: number) => channels[index],
  } as AudioBuffer;
}
function tone() {
  return Float32Array.from({ length: 10000 }, (_, index) =>
    index < 2000 || index >= 6000 ? 0 : 0.4 * Math.sin((index * Math.PI * 2 * 200) / 10000),
  );
}

test("speech envelope keeps leading, internal and trailing silence closed", () => {
  const samples = tone();
  samples.fill(0, 3500, 4200);
  const envelope = createSpeechEnvelope(pcm([samples]));
  for (const time of [0, 0.1, 0.37, 0.4, 0.7, 0.99]) {
    expect(readSpeechEnvelope(envelope, time)).toEqual({
      elapsedSeconds: time,
      energy: 0,
      brightness: 0,
    });
  }
  expect(readSpeechEnvelope(envelope, 0.3)!.energy).toBeGreaterThan(0.8);
  expect(readSpeechEnvelope(envelope, 0.5)!.energy).toBeGreaterThan(0.8);
  expect(readSpeechEnvelope(envelope, 1)).toBeNull();
  expect(readSpeechEnvelope(envelope, -0.1)).toBeNull();
  expect(readSpeechEnvelope(envelope, Number.NaN)).toBeNull();
});
