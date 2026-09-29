import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { BLINK_INTERVAL_MS, CHANNEL_COOLDOWN_MS, createIdleCoordinator, IDLE_STAGGER_MS } from "../src/coach/idleCoordinator";
import { IDLE_GAP_MS, type IdleGesture } from "../src/coach/idleModel";
import { expressions, type CoachDefinition, type CoachExpression } from "../src/coach/model";
import type { SignatureGesture } from "../src/coach/idleSignatures/types";

type Repertoire = { expression: CoachExpression; channels: string[]; gestures: IdleGesture[] };
type CastRepertoire = { id: string; signatures: SignatureGesture[]; states: Repertoire[] };

// This is the recorded pre-revamp vocabulary, not the current registry count.
// Renaming or recombining old catalogue entries must not inflate new coverage.
const baselineIds = new Set([
  "blink", "slow-blink", "glance", "breathe", "nod", "glasses", "hair", "ears",
  "tail", "sigh", "twinkle", "head-tilt", "lean-in", "posture-reset", "look-down", "scan",
]);

async function castRepertoires(page: Page): Promise<CastRepertoire[]> {
  await page.goto("/");
  const root = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  return page.evaluate(async (root) => {
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    const { configuredGestures } = await import(`${root}/src/coach/idleGestures.ts`);
    const { allSignatures } = await import(`${root}/src/coach/idleSignatures/index.ts`);
    const { rigChannels } = await import(`${root}/src/coach/idleRig.ts`);
    const { expressions } = await import(`${root}/src/coach/model.ts`);
    return selectableCoaches.map((coach: CoachDefinition) => ({
      id: coach.id,
      signatures: allSignatures[coach.id] ?? [],
      states: expressions.map((expression: CoachExpression) => ({
        expression, channels: rigChannels(coach.id, expression),
        gestures: configuredGestures(coach.animation, expression),
      })),
    }));
  }, root);
}

function fingerprint(gesture: IdleGesture) {
  return JSON.stringify(gesture.tracks.map((track) => ({
    channel: track.channel,
    keyframes: track.keyframes,
    durationMs: track.durationMs,
    delayMs: track.delayMs ?? 0,
  })).sort((a, b) => a.channel.localeCompare(b.channel)));
}

test("the entire registered cast has expanded, distinct and anatomically compatible repertoires", async ({ page }) => {
  test.setTimeout(90_000);
  const cast = await castRepertoires(page);
  expect(cast.length).toBeGreaterThan(0);
  expect(new Set(cast.map((coach) => coach.id)).size).toBe(cast.length);
  const coachCounts = cast.map((coach) => new Set(coach.states.flatMap((state) => state.gestures.map((gesture) => gesture.id))).size);
  const expressionCounts = cast.flatMap((coach) => coach.states.map((state) => state.gestures.length));
  await test.info().attach("repertoire-coverage", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({
      coaches: cast.length, expressions: expressions.length,
      gesturesPerCoach: [Math.min(...coachCounts), Math.max(...coachCounts)],
      choicesPerExpression: [Math.min(...expressionCounts), Math.max(...expressionCounts)],
      configuredSlots: expressionCounts.reduce((sum, count) => sum + count, 0),
    }, null, 2)),
  });
  for (const coach of cast) {
    expect(coach.states.map((state) => state.expression), coach.id).toEqual(expressions);
    const oldPerformances = new Set<string>();
    const additions = new Map<string, IdleGesture>();
    for (const { expression, channels, gestures } of coach.states) {
      const context = `${coach.id}:${expression}`;
      expect(gestures.length, context).toBeGreaterThanOrEqual(8);
      expect(new Set(gestures.map((gesture) => gesture.id)).size, context).toBe(gestures.length);
      expect(new Set(gestures.map((gesture) => gesture.group)).size, context).toBeGreaterThanOrEqual(3);
      expect(new Set(gestures.map(fingerprint)).size, `${context}: relabeled duplicates`).toBe(gestures.length);
      for (const gesture of gestures) {
        expect(gesture.tracks.length, `${context}:${gesture.id}`).toBeGreaterThan(0);
        expect(new Set(gesture.tracks.map((track) => track.channel)).size, context).toBe(gesture.tracks.length);
        expect(gesture.tracks.every((track) => channels.includes(track.channel)), `${context}:${gesture.id}`).toBe(true);
        expect(gesture.durationMs, `${context}:${gesture.id}`).toBe(Math.max(
          ...gesture.tracks.map((track) => track.durationMs + (track.delayMs ?? 0)),
        ));
        expect(gesture.weight, context).toBeGreaterThan(0);
        expect(gesture.cooldownMs, context).toBeGreaterThanOrEqual(0);
        if (gesture.blink) expect(gesture.tracks.some((track) => track.channel === "eyes"), context).toBe(true);
        if (baselineIds.has(gesture.id)) oldPerformances.add(fingerprint(gesture));
        else if (!additions.has(gesture.id)) additions.set(gesture.id, gesture);
      }
    }
    expect(additions.size, coach.id).toBeGreaterThanOrEqual(4);
    const addedFingerprints = [...additions.values()].map(fingerprint);
    expect(new Set(addedFingerprints).size, `${coach.id}: duplicate new performances`).toBe(additions.size);
    expect(addedFingerprints.every((performance) => !oldPerformances.has(performance)), `${coach.id}: renamed baseline`).toBe(true);
    expect([...additions.keys()], coach.id).toEqual(expect.arrayContaining(["signature-a", "signature-b"]));
  }
});

test("every coach's two signatures retain full authored tracks and occur only in their eligible expressions", async ({ page }) => {
  for (const coach of await castRepertoires(page)) {
    expect(coach.signatures.map((signature) => signature.id).sort(), coach.id).toEqual(["signature-a", "signature-b"]);
    expect(new Set(coach.signatures.map((signature) => signature.label)).size, coach.id).toBe(2);
    for (const signature of coach.signatures) {
      const context = `${coach.id}:${signature.id}`;
      expect(signature.label.trim().length, context).toBeGreaterThan(0);
      expect(signature.description.trim().length, context).toBeGreaterThan(0);
      expect(signature.expressions.length, context).toBeGreaterThan(0);
      expect(new Set(signature.expressions).size, context).toBe(signature.expressions.length);
      const reachable: CoachExpression[] = [];
      for (const state of coach.states) {
        const resolved = state.gestures.find((gesture) => gesture.id === signature.id);
        if (!signature.expressions.includes(state.expression)) {
          expect(resolved, `${context}:${state.expression}`).toBeUndefined();
          continue;
        }
        expect(resolved, `${context}:${state.expression}`).toBeDefined();
        // Compound signatures cannot silently lose a hand, prop-following track,
        // or their secondary motion when the pose lacks that anatomy.
        expect(resolved!.tracks, `${context}:${state.expression}`).toEqual(signature.tracks);
        expect(resolved!.durationMs, context).toBe(signature.durationMs);
        expect(signature.tracks.every((track) => state.channels.includes(track.channel)), `${context}:${state.expression}`).toBe(true);
        reachable.push(state.expression);
      }
      expect(reachable.sort(), context).toEqual([...signature.expressions].sort());
    }
  }
});

function seeded(seed: number) {
  return () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);
}
function requireInvariant(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function traceRepertoire(gestures: IdleGesture[], context: string, seed: number) {
  const coordinator = createIdleCoordinator(gestures, { random: seeded(seed) });
  const maximumDuration = Math.max(...gestures.map((gesture) => gesture.durationMs));
  const ready = new Map<string, number>();
  const channelsReady = new Map<string, number>();
  const seen = new Set<string>();
  let frame = coordinator.snapshot();
  let now = 0;
  let quietSince = 0;
  let previousStart = -Infinity;
  let latestClosure = 0;
  let completedClosures = 0;
  for (let event = 0; event < 400; event++) {
    const at = frame.nextAt;
    requireInvariant(at !== null && Number.isFinite(at) && at > now, `${context}: timer failed to advance at ${now}`);
    now = at!;
    const previous = frame;
    const finished = previous.active.filter((playing) => playing.endsAt <= now);
    for (const playing of finished) {
      if (playing.gesture.blink) {
        latestClosure = playing.endsAt;
        completedClosures++;
      }
    }
    frame = coordinator.advance(now);
    requireInvariant(frame.diagnostics.issues.length === 0, `${context}: ${frame.diagnostics.issues.join("; ")}`);
    if (previous.active.length && !frame.active.length) quietSince = now;
    if (!previous.active.length && frame.started.length) {
      const gap = now - quietSince;
      requireInvariant(gap >= IDLE_GAP_MS[0] && gap <= IDLE_GAP_MS[1], `${context}: quiet gap ${gap}`);
    }
    requireInvariant(frame.active.length <= 2, `${context}: too many simultaneous idles`);
    requireInvariant(new Set(frame.active.map((playing) => playing.gesture.intensity)).size === frame.active.length, `${context}: competing gesture intensity`);
    const channels = frame.active.flatMap((playing) => playing.gesture.tracks.map((track) => track.channel));
    requireInvariant(new Set(channels).size === channels.length, `${context}: overlapping channel ownership`);
    for (const playing of frame.started) {
      const { gesture } = playing;
      requireInvariant(now >= (ready.get(gesture.id) ?? 0), `${context}: ${gesture.id} bypassed its cooldown`);
      requireInvariant(now - previousStart >= IDLE_STAGGER_MS, `${context}: simultaneous starts`);
      requireInvariant(gesture.tracks.every((track) => now >= (channelsReady.get(track.channel) ?? 0)), `${context}: ${gesture.id} bypassed a part cooldown`);
      ready.set(gesture.id, playing.endsAt + gesture.cooldownMs);
      gesture.tracks.forEach((track) => channelsReady.set(track.channel, playing.endsAt + CHANNEL_COOLDOWN_MS));
      previousStart = now;
      seen.add(gesture.id);
    }
    // A due baseline blink may wait for one current reservation and a quiet gap.
    // Including its own duration checks completed, visible closure/reopening.
    const closureLimit = BLINK_INTERVAL_MS[1] + maximumDuration * 2 + IDLE_GAP_MS[1];
    requireInvariant(now - latestClosure <= closureLimit, `${context}: eye activity starved for ${now - latestClosure} ms`);
  }
  requireInvariant(completedClosures > 5, `${context}: baseline eye activity did not repeat`);
  const omitted = gestures.filter((gesture) => !seen.has(gesture.id)).map((gesture) => gesture.id);
  requireInvariant(omitted.length === 0, `${context}: idle choices never scheduled: ${omitted.join(", ")}`);
}

test("all resolved repertoires remain live, safe and reachable through extended seeded playback", async ({ page }) => {
  test.setTimeout(90_000);
  const cast = await castRepertoires(page);
  for (const coach of cast) {
    for (const { expression, gestures } of coach.states) {
      for (const seed of [17, 9127]) traceRepertoire(gestures, `${coach.id}:${expression}:seed-${seed}`, seed);
    }
  }
});
