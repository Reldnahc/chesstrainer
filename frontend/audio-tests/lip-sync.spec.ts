import { expect, test } from "../tests/helpers/browserTest";
import { speechMouthAt, type SpeechMouthTrack } from "../src/coach/speechMouth";

const track: SpeechMouthTrack = {
  durationSeconds: 1,
  cues: [
    { start: 0.1, end: 0.2, shape: "closed" },
    { start: 0.2, end: 0.4, shape: "round" },
    { start: 0.6, end: 0.8, shape: "tongue" },
  ],
};

test("mouth timing uses half-open cue boundaries and rests in gaps or outside the recording", () => {
  const cases = [
    [0, "rest"],
    [0.1, "closed"],
    [0.199, "closed"],
    [0.2, "round"],
    [0.399, "round"],
    [0.4, "rest"],
    [0.599, "rest"],
    [0.6, "tongue"],
    [0.8, "rest"],
    [0.999, "rest"],
    [1, "rest"],
    [2, "rest"],
    [-1, "rest"],
    [NaN, "rest"],
    [Infinity, "rest"],
  ] as const;
  for (const [seconds, shape] of cases) expect(speechMouthAt(track, seconds)).toBe(shape);
  expect(speechMouthAt({ durationSeconds: 1, cues: [] }, 0.5)).toBe("rest");
});
