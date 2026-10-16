import { useCallback, useEffect, useRef } from "react";
import { useLatest } from "./useLatest";

export type PollingOptions = {
  intervalMs: number;
  /** Polling runs only while this is true; turning it on runs a pass at once. */
  enabled?: boolean;
  /** Hidden tabs skip their passes and run one as soon as they are shown again. */
  pauseWhenHidden?: boolean;
  /** After a failed pass the wait doubles, up to eight intervals, until a pass succeeds. */
  backoffOnError?: boolean;
};

const MAX_BACKOFF = 8;

/**
 * Repeats `task` while enabled, one pass at a time. A pass that throws counts as
 * failed (the task reports its own error); the screen leaving aborts the signal
 * and stops the loop, and that aborted pass is not a failure. `run()` asks for a fresh pass now: it waits for any pass
 * already in flight, so an explicit refresh after a change is never answered by
 * a response that started before it.
 */
export function usePolling(
  task: (signal: AbortSignal) => Promise<unknown>,
  { intervalMs, enabled = true, pauseWhenHidden = true, backoffOnError = true }: PollingOptions,
) {
  const latest = useLatest(task);
  const lifetime = useRef<AbortController | null>(null);
  const flight = useRef<Promise<void> | null>(null);
  const failures = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
      // An aborted pass answers nothing; a remount (StrictMode's in development) starts afresh.
      flight.current = null;
    };
  }, []);

  const pass = useCallback((): Promise<void> => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return Promise.resolve();
    const current: Promise<void> = latest
      .current(signal)
      .then(
        () => {
          failures.current = 0;
        },
        // Leaving the screen aborts a pass; that is not the server failing.
        () => {
          if (!signal.aborted) failures.current += 1;
        },
      )
      .finally(() => {
        if (flight.current === current) flight.current = null;
      });
    flight.current = current;
    return current;
  }, [latest]);

  const run = useCallback(async () => {
    while (flight.current) await flight.current;
    await pass();
  }, [pass]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let ticking = false;
    let timer: number | undefined;
    const delay = () =>
      intervalMs * (backoffOnError ? Math.min(MAX_BACKOFF, 2 ** failures.current) : 1);
    const tick = async () => {
      window.clearTimeout(timer);
      if (stopped || ticking || (pauseWhenHidden && document.hidden)) return;
      ticking = true;
      try {
        await (flight.current ?? pass());
      } finally {
        ticking = false;
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), delay());
    };
    const visibility = () => {
      if (!document.hidden) void tick();
    };
    if (pauseWhenHidden) document.addEventListener("visibilitychange", visibility);
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, intervalMs, pauseWhenHidden, backoffOnError, pass]);

  return { run };
}
