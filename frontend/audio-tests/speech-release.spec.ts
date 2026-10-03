import {test, expect} from "@playwright/test";
import {findSpeechRelease} from "../src/audio/speech/release";

const RATE = 48000;
function pcm(samples: Float32Array): AudioBuffer {
  return {numberOfChannels: 1, length: samples.length, sampleRate: RATE, duration: samples.length / RATE,
    getChannelData: () => samples} as unknown as AudioBuffer;
}
/** 0.1-0.7 s speaking-level tone, then a final sound 25 dB down until `tailEnd`. */
function line(tailEnd = .8) {
  return Float32Array.from({length: RATE}, (_, index) => {
    const time = index / RATE, wave = Math.sin(index * Math.PI * 2 * 220 / RATE);
    if (time >= .1 && time < .7) return .3 * wave;
    if (time >= .7 && time < tailEnd) return .3 * 10 ** (-25 / 20) * wave;
    return 0;
  });
}

test("the release spans only the final sound's quiet tail", () => {
  expect(findSpeechRelease(pcm(line()))).toEqual({start: .7, end: .8});
});

test("a click after the voice is not mistaken for speech and ends up after the release", () => {
  const samples = line();
  samples.fill(.3, Math.round(.95 * RATE), Math.round(.955 * RATE));
  expect(findSpeechRelease(pcm(samples))).toEqual({start: .7, end: .8});
});

test("the release lasts at least 30 ms and at most 150 ms", () => {
  expect(findSpeechRelease(pcm(line(.7)))).toEqual({start: .67, end: .7});
  expect(findSpeechRelease(pcm(line(.95)))).toEqual({start: .8, end: .95});
});

test("silence has no release", () => {
  expect(findSpeechRelease(pcm(new Float32Array(RATE)))).toBeNull();
});
