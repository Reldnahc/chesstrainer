import { test, type Page } from "../tests/helpers/browserTest";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import {
  BLINK_INTERVAL_MS,
  CHANNEL_COOLDOWN_MS,
  createIdleCoordinator,
  IDLE_STAGGER_MS,
} from "../src/coach/idleCoordinator";
import { IDLE_GAP_MS, type IdleGesture } from "../src/coach/idleModel";
import type { CoachDefinition, CoachExpression } from "../src/coach/model";

type Repertoire = { expression: CoachExpression; gestures: IdleGesture[] };
type CastRepertoire = { id: string; states: Repertoire[] };

async function castRepertoires(page: Page): Promise<CastRepertoire[]> {
  await page.goto("/");
  const root = viteFsPath(path.resolve("."));
  return page.evaluate(async root => {
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    const { configuredGestures } = await import(`${root}/src/coach/idleGestures.ts`);
    const { expressions } = await import(`${root}/src/coach/model.ts`);
    return selectableCoaches.map((coach: CoachDefinition) => ({
      id: coach.id,
      states: expressions.map((expression: CoachExpression) => ({
        expression,
        gestures: configuredGestures(coach.animation, expression),
      })),
    }));
  }, root);
}

function seeded(seed: number) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}
function requireInvariant(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function traceRepertoire(gestures: IdleGesture[], context: string, seed: number) {
  const coordinator = createIdleCoordinator(gestures, { random: seeded(seed) });
  const maximumDuration = Math.max(...gestures.map(gesture => gesture.durationMs));
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
    requireInvariant(
      at !== null && Number.isFinite(at) && at > now,
      `${context}: timer failed to advance at ${now}`,
    );
    now = at!;
    const previous = frame;
    const finished = previous.active.filter(playing => playing.endsAt <= now);
    for (const playing of finished) {
      if (playing.gesture.blink) {
        latestClosure = playing.endsAt;
        completedClosures++;
      }
    }
    frame = coordinator.advance(now);
    requireInvariant(
      frame.diagnostics!.issues.length === 0,
      `${context}: ${frame.diagnostics!.issues.join("; ")}`,
    );
    if (previous.active.length && !frame.active.length) quietSince = now;
    if (!previous.active.length && frame.started.length) {
      const gap = now - quietSince;
      requireInvariant(
        gap >= IDLE_GAP_MS[0] && gap <= IDLE_GAP_MS[1],
        `${context}: quiet gap ${gap}`,
      );
    }
    requireInvariant(frame.active.length <= 2, `${context}: too many simultaneous idles`);
    requireInvariant(
      new Set(frame.active.map(playing => playing.gesture.intensity)).size === frame.active.length,
      `${context}: competing gesture intensity`,
    );
    const channels = frame.active.flatMap(playing =>
      playing.gesture.tracks.map(track => track.channel),
    );
    requireInvariant(
      new Set(channels).size === channels.length,
      `${context}: overlapping channel ownership`,
    );
    for (const playing of frame.started) {
      const { gesture } = playing;
      requireInvariant(
        now >= (ready.get(gesture.id) ?? 0),
        `${context}: ${gesture.id} bypassed its cooldown`,
      );
      requireInvariant(now - previousStart >= IDLE_STAGGER_MS, `${context}: simultaneous starts`);
      requireInvariant(
        gesture.tracks.every(track => now >= (channelsReady.get(track.channel) ?? 0)),
        `${context}: ${gesture.id} bypassed a part cooldown`,
      );
      ready.set(gesture.id, playing.endsAt + gesture.cooldownMs);
      gesture.tracks.forEach(track =>
        channelsReady.set(track.channel, playing.endsAt + CHANNEL_COOLDOWN_MS),
      );
      previousStart = now;
      seen.add(gesture.id);
    }
    // A due baseline blink may wait for one current reservation and a quiet gap.
    // Including its own duration checks completed, visible closure/reopening.
    const closureLimit = BLINK_INTERVAL_MS[1] + maximumDuration * 2 + IDLE_GAP_MS[1];
    requireInvariant(
      now - latestClosure <= closureLimit,
      `${context}: eye activity starved for ${now - latestClosure} ms`,
    );
  }
  requireInvariant(completedClosures > 5, `${context}: baseline eye activity did not repeat`);
  const omitted = gestures.filter(gesture => !seen.has(gesture.id)).map(gesture => gesture.id);
  requireInvariant(
    omitted.length === 0,
    `${context}: idle choices never scheduled: ${omitted.join(", ")}`,
  );
}

test("all resolved repertoires remain live, safe and reachable through extended seeded playback", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const cast = await castRepertoires(page);
  for (const coach of cast) {
    for (const { expression, gestures } of coach.states) {
      for (const seed of [17, 9127])
        traceRepertoire(gestures, `${coach.id}:${expression}:seed-${seed}`, seed);
    }
  }
});
