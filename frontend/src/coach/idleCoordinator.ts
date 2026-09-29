import { IDLE_GAP_MS, idleChannels, type IdleChannel, type IdleGesture } from "./idleModel";

export const BLINK_INTERVAL_MS = [3000, 5000] as const;
export const CHANNEL_COOLDOWN_MS = 180;
export const IDLE_STAGGER_MS = 180;

export type ActiveIdle = {
  gesture: IdleGesture;
  startedAt: number;
  endsAt: number;
  sequence: number;
};
export type IdleFrame = {
  at: number;
  active: readonly ActiveIdle[];
  started: readonly ActiveIdle[];
  nextAt: number | null;
  diagnostics: {
    recent: readonly string[];
    blinkDueAt: number | null;
    cooldowns: readonly { id: string; readyAt: number }[];
    rejected: readonly { id: string; reason: string }[];
    issues: readonly string[];
  };
};

function validGesture(value: IdleGesture): boolean {
  return !!value && typeof value.id === "string" && !!value.id
    && ["eyes", "attention", "body", "detail"].includes(value.group)
    && ["quiet", "noticeable"].includes(value.intensity)
    && Array.isArray(value.tracks) && value.tracks.length > 0
    && Number.isFinite(value.durationMs) && value.durationMs > 0
    && Number.isFinite(value.cooldownMs) && value.cooldownMs >= 0
    && Number.isFinite(value.weight) && value.weight > 0
    && value.tracks.every((track) => !!track && idleChannels.includes(track.channel)
      && typeof track.keyframes === "string" && !!track.keyframes
      && Number.isFinite(track.durationMs) && track.durationMs > 0
      && Number.isFinite(track.delayMs ?? 0) && (track.delayMs ?? 0) >= 0
      && track.durationMs + (track.delayMs ?? 0) <= value.durationMs)
    && new Set(value.tracks.map((track) => track.channel)).size === value.tracks.length;
}

/** One event-driven clock per portrait. CSS owns frames; this owns reservations. */
export function createIdleCoordinator(
  catalogue: readonly IdleGesture[],
  { random = Math.random, now = 0 }: { random?: () => number; now?: number } = {},
) {
  const issues = new Set<string>();
  const ids = new Set<string>();
  const gestures = catalogue.filter((entry) => {
    if (!validGesture(entry) || ids.has(entry.id)) {
      issues.add(`Invalid or duplicate idle gesture: ${entry?.id ?? "(missing id)"}`);
      return false;
    }
    ids.add(entry.id);
    return true;
  });
  const blinks = gestures.filter((entry) => entry.blink);
  const baseline = (entry: IdleGesture) => entry.group === "eyes" && !!entry.blink;
  if (gestures.length && !gestures.some((entry) => !baseline(entry) && entry.intensity === "quiet")) {
    issues.add("Resting repertoire has no optional quiet fallback.");
  }
  const draw = () => {
    const value = random();
    return Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0.5;
  };
  const between = ([min, max]: readonly [number, number]) => min + draw() * (max - min);
  let time = Number.isFinite(now) ? now : 0;
  let quietSince = time;
  let quietAt = time + between(IDLE_GAP_MS);
  let blinkDueAt = blinks.length ? time + between(BLINK_INTERVAL_MS) : null;
  let pausedAt: number | null = null;
  let active: ActiveIdle[] = [];
  let sequence = 0;
  let lastStart = -Infinity;
  const recent: string[] = [];
  const usedAt = new Map<string, number>();
  const gestureReady = new Map<string, number>();
  const channelReady = new Map<IdleChannel, number>();

  function tick(value: number) {
    if (Number.isFinite(value)) time = Math.max(time, value);
  }

  function expire() {
    const finished = active.filter((entry) => entry.endsAt <= time);
    if (!finished.length) return;
    active = active.filter((entry) => entry.endsAt > time);
    if (finished.some((entry) => entry.gesture.blink)) blinkDueAt = time + between(BLINK_INTERVAL_MS);
    if (!active.length) {
      // Late browser callbacks get a fresh gap, never a burst of missed gestures.
      quietSince = time;
      quietAt = time + between(IDLE_GAP_MS);
    }
  }

  function conflict(entry: IdleGesture): string | null {
    if (active.some((playing) => playing.gesture.intensity === entry.intensity)) return `${entry.intensity} limit`;
    if (active.some((playing) => playing.gesture.tracks.some((track) =>
      entry.tracks.some((candidate) => candidate.channel === track.channel)))) return "channel occupied";
    return null;
  }

  function readyAt(entry: IdleGesture): number {
    return Math.max(
      gestureReady.get(entry.id) ?? -Infinity,
      ...entry.tracks.map((track) => channelReady.get(track.channel) ?? -Infinity),
      active.length ? lastStart + IDLE_STAGGER_MS : quietAt,
      baseline(entry) ? blinkDueAt ?? Infinity : -Infinity,
    );
  }

  function candidates() {
    const due = blinkDueAt !== null && blinkDueAt <= time;
    return gestures.filter((entry) => (!due || entry.blink) && !conflict(entry));
  }

  function choose(available: IdleGesture[]): IdleGesture | undefined {
    if (!available.length) return undefined;
    // A plain eye gesture is the least intrusive way to meet an overdue blink.
    if (blinkDueAt !== null && blinkDueAt <= time && available.some(baseline)) {
      available = available.filter(baseline);
    }
    const different = available.filter((entry) => entry.id !== recent.at(-1));
    if (different.length) available = different;
    if (recent.length >= 3 && recent.at(-1) === recent.at(-3)) {
      const notAlternating = available.filter((entry) => entry.id !== recent.at(-2));
      if (notAlternating.length) available = notAlternating;
    }
    // Age provides a deterministic backstop even for a very unlucky random stream.
    const oldest = [...available].sort((a, b) => (usedAt.get(a.id) ?? 0) - (usedAt.get(b.id) ?? 0))[0];
    if (sequence - (usedAt.get(oldest.id) ?? 0) >= gestures.length * 2) return oldest;
    const weighted = available.map((entry) => ({
      entry,
      weight: entry.weight / (1 + recent.filter((id) => id === entry.id).length * 2),
    }));
    let choice = draw() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
    for (const item of weighted) {
      choice -= item.weight;
      if (choice < 0) return item.entry;
    }
    return weighted.at(-1)!.entry;
  }

  function nextAt(): number | null {
    if (pausedAt !== null || !gestures.length) return null;
    const deadlines = active.map((entry) => entry.endsAt);
    for (const entry of candidates()) deadlines.push(readyAt(entry));
    if (blinkDueAt !== null && blinkDueAt > time) {
      deadlines.push(active.length ? blinkDueAt : Math.max(quietAt, blinkDueAt));
    }
    const future = deadlines.filter((deadline) => Number.isFinite(deadline));
    return future.length ? Math.max(time, Math.min(...future)) : null;
  }

  function frame(started: ActiveIdle[] = []): IdleFrame {
    const due = blinkDueAt !== null && blinkDueAt <= time;
    const deadline = nextAt();
    if (!active.length && deadline !== null && deadline > quietSince + IDLE_GAP_MS[1]) {
      issues.add("Resting repertoire cannot supply a legal idle within the maximum quiet gap.");
    }
    return {
      at: time, active: [...active], started, nextAt: deadline,
      diagnostics: {
        recent: [...recent], blinkDueAt,
        cooldowns: gestures.map((entry) => ({ id: entry.id, readyAt: gestureReady.get(entry.id) ?? time })),
        rejected: gestures.flatMap((entry) => {
          const reason = conflict(entry)
            ?? (due && !entry.blink ? "baseline blink due" : null)
            ?? (readyAt(entry) > time ? "cooldown or cadence deadline" : null);
          return reason ? [{ id: entry.id, reason }] : [];
        }),
        issues: [...issues],
      },
    };
  }

  return {
    advance(value: number): IdleFrame {
      tick(value);
      if (pausedAt !== null) return frame();
      expire();
      const eligible = candidates().filter((entry) => readyAt(entry) <= time);
      const selected = choose(eligible);
      if (!selected) return frame();
      const started = { gesture: selected, startedAt: time, endsAt: time + selected.durationMs, sequence: ++sequence };
      active.push(started);
      lastStart = time;
      gestureReady.set(selected.id, started.endsAt + selected.cooldownMs);
      selected.tracks.forEach((track) => channelReady.set(track.channel, started.endsAt + CHANNEL_COOLDOWN_MS));
      recent.push(selected.id);
      if (recent.length > 8) recent.shift();
      usedAt.set(selected.id, sequence);
      return frame([started]);
    },
    suspend(value: number): void {
      if (pausedAt !== null) return;
      tick(value);
      expire();
      for (const entry of active) {
        for (const track of entry.gesture.tracks) channelReady.set(track.channel, time + CHANNEL_COOLDOWN_MS);
      }
      active = [];
      pausedAt = time;
    },
    resume(value: number): IdleFrame {
      tick(value);
      if (pausedAt !== null) {
        const elapsed = time - pausedAt;
        gestureReady.forEach((deadline, id) => gestureReady.set(id, deadline + elapsed));
        channelReady.forEach((deadline, id) => channelReady.set(id, deadline + elapsed));
        if (blinkDueAt !== null) blinkDueAt += elapsed;
        pausedAt = null;
        quietSince = time;
        quietAt = time + between(IDLE_GAP_MS);
        lastStart = -Infinity;
      }
      return frame();
    },
    snapshot(value = time): IdleFrame {
      tick(value);
      return frame();
    },
  };
}
