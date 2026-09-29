import { expect, test } from "@playwright/test";
import path from "node:path";
import { classicPerformance } from "../src/coach/classic/performance";
import { IDLE_GAP_MS } from "../src/coach/idleModel";
import { expressions, microLabels } from "../src/coach/model";
import { coachPerformance, motionDirections } from "../src/coach/motionVocabulary";

test("every character has distinct expression-safe idles without changing entrance timing", async ({ page }) => {
  await page.goto("/");
  const root = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  const ids = await page.evaluate(async (root) => {
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    return selectableCoaches.map((coach: { id: string }) => coach.id) as string[];
  }, root);
  expect(Object.keys(motionDirections).sort()).toEqual(ids.sort());
  expect(IDLE_GAP_MS).toEqual([500, 1000]);
  for (const id of Object.keys(motionDirections)) {
    const animation = coachPerformance(id, classicPerformance);
    expect(animation.defaultReactionMs).toBe(classicPerformance.defaultReactionMs);
    expect(animation.reactionMs).toBe(classicPerformance.reactionMs);
    expect(animation.motionProfile?.id).toBe(id);
    for (const state of expressions) {
      const pool = animation.idleGestures[state]!;
      expect(pool.length, `${id}:${state}`).toBeGreaterThanOrEqual(4);
      expect(new Set(pool).size, `${id}:${state}`).toBe(pool.length);
      expect(pool, `${id}:${state}`).toEqual(expect.arrayContaining(["blink", "breathe"]));
      for (const gesture of pool) expect(Object.keys(microLabels)).toContain(gesture);
      if (["blunder", "mistake", "losing", "missed", "thinking"].includes(state)) {
        expect(pool).not.toContain("twinkle");
        expect(pool).not.toContain("tail");
      }
      if (["good", "mistake", "winning", "recovered"].includes(state)) {
        expect(pool).not.toContain("glance");
      }
    }
  }
});

test("motion vocabulary reflects anatomy and temperament rather than changing cadence", () => {
  const profile = (id: string) => coachPerformance(id, classicPerformance);
  expect(profile("cat-tuxedo").idleGestures.neutral).toEqual(expect.arrayContaining([
    "slow-blink", "glance", "head-tilt", "tail",
  ]));
  expect(profile("dog-corgi").idleGestures.neutral).toEqual(expect.arrayContaining([
    "ears", "posture-reset", "nod", "glance",
  ]));
  expect(profile("woman-analyst").idleGestures.thinking).toContain("glasses");
  expect(profile("woman-spark").idleGestures.neutral).toContain("hair");
  expect(profile("robot").idleGestures.blunder).toEqual(expect.arrayContaining([
    "scan", "look-down", "head-tilt", "posture-reset",
  ]));
  expect(profile("frog").motionProfile!.amplitude)
    .toBeLessThan(profile("dog-corgi").motionProfile!.amplitude);
  expect(profile("alien").motionProfile!.gaze)
    .toBeGreaterThan(profile("woman-analyst").motionProfile!.gaze);
  expect(profile("future-rig").defaultIdle).toEqual(expect.arrayContaining([
    "slow-blink", "glance", "breathe", "head-tilt",
  ]));
});
