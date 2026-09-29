import { expect, test } from "@playwright/test";
import { createIdleCoordinator, BLINK_INTERVAL_MS, CHANNEL_COOLDOWN_MS, IDLE_STAGGER_MS } from "../src/coach/idleCoordinator";
import { IDLE_GAP_MS, type IdleGesture, type IdleChannel } from "../src/coach/idleModel";

function gesture(id: string, channel: IdleChannel, options: Partial<IdleGesture> = {}): IdleGesture {
  const durationMs = options.durationMs ?? 1200;
  return {
    id, group: "body", tracks: [{ channel, keyframes: `test-${id}`, durationMs }],
    durationMs, cooldownMs: 0, weight: 1, intensity: "noticeable", ...options,
  };
}
const blink = gesture("blink", "eyes", { group: "eyes", blink: true, intensity: "quiet", durationMs: 260, cooldownMs: 1000 });
const breath = gesture("breath", "body", { intensity: "quiet" });
const head = gesture("head", "head");
const tail = gesture("tail", "tail");
const middle = () => 0.5;

test("true authored duration determines release and the next quiet gap", () => {
  const coordinator = createIdleCoordinator([gesture("small", "body", { durationMs: 260, intensity: "quiet" })], { random: middle });
  expect(coordinator.snapshot().nextAt).toBe(750);
  expect(coordinator.advance(749).active).toHaveLength(0);
  expect(coordinator.advance(750).started[0].endsAt).toBe(1010);
  expect(coordinator.advance(1009).active).toHaveLength(1);
  const finished = coordinator.advance(1010);
  expect(finished.active).toHaveLength(0);
  expect(finished.nextAt).toBe(1760);
  expect(coordinator.advance(1760).started).toHaveLength(1);
});

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
    expect(closures[index] - closures[index - 1]).toBeGreaterThanOrEqual(260 + BLINK_INTERVAL_MS[0]);
    expect(closures[index] - closures[index - 1]).toBeLessThanOrEqual(260 + BLINK_INTERVAL_MS[0] + 1200 + IDLE_GAP_MS[1]);
  }
});

test("compatible channels overlap with a stagger and one gesture of each intensity", () => {
  const coordinator = createIdleCoordinator([head, breath, tail], { random: () => 0 });
  let frame = coordinator.advance(500);
  expect(frame.started.map((entry) => entry.gesture.id)).toEqual(["head"]);
  expect(frame.nextAt).toBe(500 + IDLE_STAGGER_MS);
  frame = coordinator.advance(frame.nextAt!);
  expect(frame.started.map((entry) => entry.gesture.id)).toEqual(["breath"]);
  expect(frame.active).toHaveLength(2);
  expect(frame.nextAt).toBe(1700);
  expect(coordinator.advance(1000).started).toHaveLength(0);
});

test("compound reservations are atomic and channel release has a cooldown", () => {
  const scan = gesture("scan", "head", {
    durationMs: 1000,
    tracks: [
      { channel: "head", keyframes: "head", durationMs: 1000 },
      { channel: "gaze", keyframes: "gaze", durationMs: 700, delayMs: 300 },
    ],
  });
  const glance = gesture("glance", "gaze", { intensity: "quiet" });
  const coordinator = createIdleCoordinator([scan, glance], { random: () => 0 });
  const started = coordinator.advance(500);
  expect(started.diagnostics.rejected).toContainEqual({ id: "glance", reason: "channel occupied" });
  expect(coordinator.advance(900).started).toHaveLength(0);
  expect(coordinator.advance(1500).nextAt).toBe(2000);
  expect(CHANNEL_COOLDOWN_MS).toBeLessThanOrEqual(IDLE_GAP_MS[0]);
});

test("a due blink cannot be indefinitely deferred by optional eye actions", () => {
  const eyeGesture = gesture("look", "eyes", { durationMs: 3500 });
  const coordinator = createIdleCoordinator([eyeGesture, blink, breath], { random: () => 0 });
  expect(coordinator.advance(500).started[0].gesture.id).toBe("look");
  coordinator.advance(680);
  let frame = coordinator.advance(3000);
  expect(frame.started).toHaveLength(0);
  expect(frame.diagnostics.rejected).toContainEqual({ id: "look", reason: "noticeable limit" });
  frame = coordinator.advance(4000);
  expect(frame.nextAt).toBe(4500);
  expect(coordinator.advance(4500).started[0].gesture.id).toBe("blink");
});

test("a completed compound blink resets the shared eye deadline", () => {
  const sigh = gesture("sigh", "body", { blink: true, tracks: [
    { channel: "body", keyframes: "sigh", durationMs: 1200 },
    { channel: "eyes", keyframes: "close", durationMs: 1000 },
  ] });
  const coordinator = createIdleCoordinator([sigh, blink], { random: () => 0 });
  expect(coordinator.advance(500).started[0].gesture.id).toBe("sigh");
  const finished = coordinator.advance(1700);
  expect(finished.diagnostics.blinkDueAt).toBe(4700);
  expect(finished.active).toHaveLength(0);
  expect(finished.started).toHaveLength(0);
});

test("history prevents immediate repetition and A/B/A/B while alternatives are legal", () => {
  const coordinator = createIdleCoordinator([head, tail, gesture("lean", "body")], { random: () => 0 });
  let frame = coordinator.snapshot();
  const played: string[] = [];
  for (let event = 0; event < 30; event++) {
    frame = coordinator.advance(frame.nextAt!);
    played.push(...frame.started.map((entry) => entry.gesture.id));
  }
  expect(played.length).toBeGreaterThan(10);
  for (let index = 1; index < played.length; index++) expect(played[index]).not.toBe(played[index - 1]);
  for (let index = 3; index < played.length; index++) {
    expect(played[index] === played[index - 2] && played[index - 1] === played[index - 3]).toBe(false);
  }
});

test("low-weight legal gestures still receive a turn with an unlucky random stream", () => {
  const repertoire = Array.from({ length: 8 }, (_, index) => gesture(`choice-${index}`, "body", { weight: index === 7 ? 0.00001 : 100 }));
  const coordinator = createIdleCoordinator(repertoire, { random: () => 0 });
  let frame = coordinator.snapshot();
  const played = new Set<string>();
  for (let event = 0; event < 160; event++) {
    frame = coordinator.advance(frame.nextAt!);
    frame.started.forEach((entry) => played.add(entry.gesture.id));
  }
  expect(played).toEqual(new Set(repertoire.map((entry) => entry.id)));
});

test("gesture cooldowns remain binding even when they make the catalogue infeasible", () => {
  const coordinator = createIdleCoordinator([gesture("rare", "body", { cooldownMs: 5000, intensity: "quiet" })], { random: () => 0 });
  coordinator.advance(500);
  const waiting = coordinator.advance(1700);
  expect(waiting.active).toHaveLength(0);
  expect(waiting.diagnostics.issues).toContain("Resting repertoire cannot supply a legal idle within the maximum quiet gap.");
  expect(waiting.nextAt).toBe(6700);
  expect(coordinator.advance(6700).started).toHaveLength(1);
});

test("suspension aborts tracks, preserves history and freezes cooldowns without blink debt", () => {
  const coordinator = createIdleCoordinator([head, blink, breath], { random: () => 0 });
  coordinator.advance(500);
  coordinator.suspend(600);
  expect(coordinator.snapshot().active).toHaveLength(0);
  expect(coordinator.snapshot().nextAt).toBeNull();
  expect(coordinator.advance(60000).started).toHaveLength(0);
  const resumed = coordinator.resume(100600);
  expect(resumed.diagnostics.recent).toEqual(["head"]);
  expect(resumed.diagnostics.blinkDueAt).toBe(103000);
  expect(resumed.nextAt).toBe(101100);
  expect(resumed.diagnostics.cooldowns.find((entry) => entry.id === "head")!.readyAt).toBe(101700);
  expect(coordinator.advance(101099).started).toHaveLength(0);
  expect(coordinator.advance(101100).started[0].gesture.id).toBe("breath");
});

test("repeated resume and ordinary snapshots do not reset deadlines or history", () => {
  const coordinator = createIdleCoordinator([breath, head], { random: middle });
  coordinator.advance(750);
  expect(coordinator.resume(800).active[0].startedAt).toBe(750);
  const first = coordinator.snapshot();
  const second = coordinator.snapshot();
  expect(second).toEqual(first);
});

test("a blink due behind an interrupted action resumes after one fresh gap", () => {
  const look = gesture("look", "eyes", { durationMs: 3500, cooldownMs: 5000 });
  const coordinator = createIdleCoordinator([look, blink, breath], { random: () => 0 });
  coordinator.advance(500);
  coordinator.advance(680);
  coordinator.advance(3000);
  coordinator.suspend(3100);
  const resumed = coordinator.resume(103100);
  expect(resumed.active).toHaveLength(0);
  expect(resumed.nextAt).toBe(103600);
  expect(coordinator.advance(103599).started).toHaveLength(0);
  const first = coordinator.advance(103600);
  expect(first.started.map((entry) => entry.gesture.id)).toEqual(["blink"]);
  expect(first.nextAt).toBeGreaterThan(103600);
});

test("a signature's long cooldown never delays the independent baseline blink", () => {
  const signature = gesture("signature", "body", { blink: true, cooldownMs: 15000, tracks: [
    { channel: "body", keyframes: "settle", durationMs: 1200 },
    { channel: "eyes", keyframes: "blink", durationMs: 260, delayMs: 500 },
  ] });
  const coordinator = createIdleCoordinator([signature, blink, breath], { random: () => 0 });
  let frame = coordinator.advance(500);
  expect(frame.started[0].gesture.id).toBe("signature");
  const deadline = 1700 + BLINK_INTERVAL_MS[0];
  while (frame.nextAt! <= deadline + 1200 + IDLE_GAP_MS[1]) {
    frame = coordinator.advance(frame.nextAt!);
    if (frame.started.some((entry) => entry.gesture.id === "blink")) break;
  }
  const baseline = frame.started.find((entry) => entry.gesture.id === "blink");
  expect(baseline).toBeDefined();
  expect(baseline!.startedAt).toBeGreaterThanOrEqual(deadline);
  expect(baseline!.startedAt).toBeLessThanOrEqual(deadline + 1200 + IDLE_GAP_MS[1]);
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

test("empty, malformed and duplicate definitions are safe and diagnosed", () => {
  expect(createIdleCoordinator([]).advance(1000).nextAt).toBeNull();
  const malformed = [
    undefined as unknown as IdleGesture,
    gesture("negative", "body", { durationMs: -5 }),
    gesture("bad-weight", "head", { weight: NaN }),
    gesture("late-track", "head", { tracks: [{ channel: "head", keyframes: "late", durationMs: 1200, delayMs: 1 }] }),
    gesture("duplicate-channel", "head", { tracks: [{ channel: "head", keyframes: "a", durationMs: 200 }, { channel: "head", keyframes: "b", durationMs: 200 }] }),
  ];
  const invalid = createIdleCoordinator(malformed).advance(1000);
  expect(invalid.nextAt).toBeNull();
  expect(invalid.diagnostics.issues).toHaveLength(5);
  const duplicated = createIdleCoordinator([breath, breath], { random: middle }).advance(750);
  expect(duplicated.started).toHaveLength(1);
  expect(duplicated.diagnostics.issues).toContain("Invalid or duplicate idle gesture: breath");
});

test("seeded extended playback stays live, bounded and repeatable", () => {
  function trace() {
    let seed = 9127;
    const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);
    const coordinator = createIdleCoordinator([blink, breath, head, tail, gesture("hair", "hair")], { random });
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
      expect(new Set(frame.active.map((entry) => entry.gesture.intensity)).size).toBe(frame.active.length);
      const channels = frame.active.flatMap((entry) => entry.gesture.tracks.map((track) => track.channel));
      expect(new Set(channels).size).toBe(channels.length);
      frame.started.forEach((entry) => events.push([entry.startedAt, entry.gesture.id]));
      expect(frame.diagnostics.issues).toEqual([]);
    }
    return events;
  }
  expect(trace()).toEqual(trace());
});
