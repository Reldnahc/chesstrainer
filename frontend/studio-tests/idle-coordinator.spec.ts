import { expect, test } from "../tests/helpers/browserTest";
import { createIdleCoordinator, BLINK_INTERVAL_MS } from "../src/coach/idleCoordinator";
import { IDLE_GAP_MS, type IdleGesture, type IdleChannel } from "../src/coach/idleModel";

function gesture(
  id: string,
  channel: IdleChannel,
  options: Partial<IdleGesture> = {},
): IdleGesture {
  const durationMs = options.durationMs ?? 1200;
  return {
    id,
    group: "body",
    tracks: [{ channel, keyframes: `test-${id}`, durationMs }],
    durationMs,
    cooldownMs: 0,
    weight: 1,
    intensity: "noticeable",
    ...options,
  };
}
const blink = gesture("blink", "eyes", {
  group: "eyes",
  blink: true,
  intensity: "quiet",
  durationMs: 260,
  cooldownMs: 1000,
});
const breath = gesture("breath", "body", { intensity: "quiet" });
const head = gesture("head", "head");
const tail = gesture("tail", "tail");

test("baseline blinking does not depend on winning the optional random draw", () => {
  const coordinator = createIdleCoordinator([blink, breath, head, tail], { random: () => 0 });
  let frame = coordinator.snapshot();
  const closures: number[] = [];
  for (let events = 0; events < 100; events++) {
    expect(frame.nextAt).not.toBeNull();
    const deadline = frame.nextAt!;
    frame = coordinator.advance(deadline);
    for (const entry of frame.started) if (entry.gesture.blink) closures.push(entry.startedAt);
    expect(frame.nextAt).toBeGreaterThan(deadline);
  }
  expect(closures.length).toBeGreaterThan(5);
  expect(closures[0]).toBeLessThanOrEqual(BLINK_INTERVAL_MS[0] + 1200 + IDLE_GAP_MS[1]);
  for (let index = 1; index < closures.length; index++) {
    expect(closures[index] - closures[index - 1]).toBeGreaterThanOrEqual(
      260 + BLINK_INTERVAL_MS[0],
    );
    expect(closures[index] - closures[index - 1]).toBeLessThanOrEqual(
      260 + BLINK_INTERVAL_MS[0] + 1200 + IDLE_GAP_MS[1],
    );
  }
});

test("a due blink cannot be indefinitely deferred by optional eye actions", () => {
  const eyeGesture = gesture("look", "eyes", { durationMs: 3500 });
  const coordinator = createIdleCoordinator([eyeGesture, blink, breath], { random: () => 0 });
  expect(coordinator.advance(500).started[0].gesture.id).toBe("look");
  coordinator.advance(680);
  let frame = coordinator.advance(3000);
  expect(frame.started).toHaveLength(0);
  expect(frame.diagnostics!.rejected).toContainEqual({ id: "look", reason: "noticeable limit" });
  frame = coordinator.advance(4000);
  expect(frame.nextAt).toBe(4500);
  expect(coordinator.advance(4500).started[0].gesture.id).toBe("blink");
});

test("suspension aborts tracks, preserves history and freezes cooldowns without blink debt", () => {
  const coordinator = createIdleCoordinator([head, blink, breath], { random: () => 0 });
  coordinator.advance(500);
  coordinator.suspend(600);
  expect(coordinator.snapshot().active).toHaveLength(0);
  expect(coordinator.snapshot().nextAt).toBeNull();
  expect(coordinator.advance(60000).started).toHaveLength(0);
  const resumed = coordinator.resume(100600);
  expect(resumed.diagnostics!.recent).toEqual(["head"]);
  expect(resumed.diagnostics!.blinkDueAt).toBe(103000);
  expect(resumed.nextAt).toBe(101100);
  expect(resumed.diagnostics!.cooldowns.find(entry => entry.id === "head")!.readyAt).toBe(101700);
  expect(coordinator.advance(101099).started).toHaveLength(0);
  expect(coordinator.advance(101100).started[0].gesture.id).toBe("breath");
});

test("late wakeups finish existing work and schedule a fresh gap without catch-up", () => {
  const coordinator = createIdleCoordinator([breath, head, blink], { random: () => 0 });
  coordinator.advance(500);
  const delayed = coordinator.advance(60000);
  expect(delayed.active).toHaveLength(0);
  expect(delayed.started).toHaveLength(0);
  expect(delayed.nextAt).toBe(60500);
  const resumed = coordinator.advance(60500);
  expect(resumed.started).toHaveLength(1);
  expect(resumed.started[0].gesture.id).toBe("blink");
});

test("seeded extended playback stays live, bounded and repeatable", () => {
  function trace() {
    let seed = 9127;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const coordinator = createIdleCoordinator(
      [blink, breath, head, tail, gesture("hair", "hair")],
      { random },
    );
    let frame = coordinator.snapshot();
    let quietSince = 0;
    const events: [number, string][] = [];
    for (let count = 0; count < 600; count++) {
      const next = frame.nextAt!;
      expect(Number.isFinite(next)).toBe(true);
      const wasActive = frame.active.length > 0;
      frame = coordinator.advance(next);
      if (wasActive && !frame.active.length) quietSince = next;
      if (!wasActive && frame.started.length) {
        expect(next - quietSince).toBeGreaterThanOrEqual(IDLE_GAP_MS[0]);
        expect(next - quietSince).toBeLessThanOrEqual(IDLE_GAP_MS[1]);
      }
      expect(frame.nextAt).toBeGreaterThan(next);
      expect(frame.active.length).toBeLessThanOrEqual(2);
      expect(new Set(frame.active.map(entry => entry.gesture.intensity)).size).toBe(
        frame.active.length,
      );
      const channels = frame.active.flatMap(entry =>
        entry.gesture.tracks.map(track => track.channel),
      );
      expect(new Set(channels).size).toBe(channels.length);
      frame.started.forEach(entry => events.push([entry.startedAt, entry.gesture.id]));
      expect(frame.diagnostics!.issues).toEqual([]);
    }
    return events;
  }
  expect(trace()).toEqual(trace());
});
