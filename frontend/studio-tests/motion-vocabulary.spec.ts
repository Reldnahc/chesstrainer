import { expect, test } from "@playwright/test";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import { classicPerformance } from "../src/coach/classic/performance";
import { IDLE_GAP_MS } from "../src/coach/idleModel";
import { configuredGestures } from "../src/coach/idleGestures";
import { sharedIdleGestures } from "../src/coach/idleShared";
import { expressions, microLabels } from "../src/coach/model";
import { coachPerformance, motionDirections } from "../src/coach/motionVocabulary";

test("every character has distinct expression-safe idles without changing entrance timing", async ({ page }) => {
  await page.goto("/");
  const root = viteFsPath(path.resolve("."));
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
    const repertoire = new Set<string>();
    for (const state of expressions) {
      const pool = animation.idleGestures[state]!;
      const resolved = configuredGestures(animation, state);
      expect(resolved.length, `${id}:${state}`).toBeGreaterThanOrEqual(8);
      expect(new Set(resolved.map((gesture) => gesture.group)).size, `${id}:${state}`)
        .toBeGreaterThanOrEqual(3);
      resolved.forEach((gesture) => repertoire.add(gesture.id));
      expect(new Set(pool).size, `${id}:${state}`).toBe(pool.length);
      expect(pool, `${id}:${state}`).toEqual(expect.arrayContaining(["blink", "breathe"]));
      for (const gesture of pool) expect(Object.keys(microLabels)).toContain(gesture);
      if (["blunder", "mistake", "losing", "missed", "thinking"].includes(state)) {
        expect(pool).not.toContain("twinkle");
        expect(pool).not.toContain("tail");
        expect(pool).not.toContain("nod-twice");
      }
      if (["blunder", "mistake", "losing", "missed"].includes(state)) {
        expect(pool).not.toContain("look-up");
      }
    }
    expect([...repertoire].filter((gesture) => Object.hasOwn(sharedIdleGestures, gesture)).length, id)
      .toBeGreaterThanOrEqual(4);
  }
});

test("new shared gestures have complete distinct tracks and controlled rhythms", () => {
  const gestures = Object.values(sharedIdleGestures);
  expect(gestures).toHaveLength(6);
  expect(new Set(gestures.map((gesture) => gesture.id)).size).toBe(gestures.length);
  for (const gesture of gestures) {
    expect(gesture.durationMs).toBe(Math.max(...gesture.tracks.map((track) => track.durationMs + (track.delayMs ?? 0))));
    expect(gesture.tracks.every((track) => track.durationMs > 0)).toBe(true);
    expect(new Set(gesture.tracks.map((track) => track.channel)).size).toBe(gesture.tracks.length);
  }
  expect(sharedIdleGestures["double-blink"]).toMatchObject({ blink: true, group: "eyes", intensity: "quiet", durationMs: 640 });
  expect(sharedIdleGestures["weight-shift"]).toMatchObject({ group: "body", intensity: "quiet", durationMs: 1450 });
  expect(sharedIdleGestures["nod-twice"].cooldownMs).toBeGreaterThan(sharedIdleGestures["glance-right"].cooldownMs);
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
