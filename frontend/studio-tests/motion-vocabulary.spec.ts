import { expect, test } from "@playwright/test";
import { classicPerformance } from "../src/coach/classic/performance";
import { IDLE_GAP_MS, IDLE_GESTURE_MS, nextIdle } from "../src/coach/idle";
import { expressions, microLabels } from "../src/coach/model";
import { coachPerformance, motionDirections } from "../src/coach/motionVocabulary";

test("every character has four distinct expression-safe idles without changing entrance timing", () => {
  expect(Object.keys(motionDirections)).toHaveLength(30);
  expect(IDLE_GAP_MS).toEqual([500, 1000]);
  expect(IDLE_GESTURE_MS).toBe(1200);
  for (const id of Object.keys(motionDirections)) {
    const animation = coachPerformance(id, classicPerformance);
    expect(animation.defaultReactionMs).toBe(classicPerformance.defaultReactionMs);
    expect(animation.reactionMs).toBe(classicPerformance.reactionMs);
    expect(animation.motionProfile?.id).toBe(id);
    for (const state of expressions) {
      const pool = animation.idleGestures[state]!;
      expect(pool, `${id}:${state}`).toHaveLength(4);
      expect(new Set(pool).size, `${id}:${state}`).toBe(4);
      for (const gesture of pool) expect(Object.keys(microLabels)).toContain(gesture);
      if (["blunder", "mistake", "losing", "missed", "thinking"].includes(state)) {
        expect(pool).not.toContain("twinkle");
        expect(pool).not.toContain("tail");
      }
      if (["good", "mistake", "winning", "recovered"].includes(state)) {
        expect(pool).not.toContain("glance");
      }
      for (const previous of pool) {
        for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
          const next = nextIdle(animation, state, previous, random);
          expect(pool).toContain(next);
          expect(next).not.toBe(previous);
        }
      }
    }
  }
});

test("motion vocabulary reflects anatomy and temperament rather than changing cadence", () => {
  const profile = (id: string) => coachPerformance(id, classicPerformance);
  expect(profile("cat-tuxedo").idleGestures.neutral).toEqual([
    "slow-blink", "glance", "head-tilt", "tail",
  ]);
  expect(profile("dog-corgi").idleGestures.neutral).toEqual([
    "ears", "posture-reset", "nod", "glance",
  ]);
  expect(profile("woman-analyst").idleGestures.thinking).toContain("glasses");
  expect(profile("woman-spark").idleGestures.neutral).toContain("hair");
  expect(profile("robot").idleGestures.blunder).toEqual([
    "scan", "look-down", "head-tilt", "posture-reset",
  ]);
  expect(profile("frog").motionProfile!.amplitude)
    .toBeLessThan(profile("dog-corgi").motionProfile!.amplitude);
  expect(profile("alien").motionProfile!.gaze)
    .toBeGreaterThan(profile("woman-analyst").motionProfile!.gaze);
  expect(profile("future-rig").defaultIdle).toEqual([
    "slow-blink", "glance", "breathe", "head-tilt",
  ]);
});
