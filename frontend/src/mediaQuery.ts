import { useSyncExternalStore } from "react";

/** The application's phone breakpoint, matching the CSS max-width: 760px queries. */
export const PHONE_QUERY = "(max-width: 760px)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type Store = { subscribe: (listener: () => void) => () => void; snapshot: () => boolean };
const stores = new Map<string, Store>();

/*
 * One store per query, created once, so React never re-subscribes on render.
 * Reading the live MediaQueryList during animation renders can consume a pending
 * Chromium media change before its event arrives, so every consumer of a query
 * reads the same event-driven snapshot instead and they all change together.
 */
function store(query: string, fallback: boolean): Store {
  const existing = stores.get(query);
  if (existing) return existing;
  const media = typeof window === "undefined" ? null : window.matchMedia(query);
  let matches = media?.matches ?? fallback;
  const listeners = new Set<() => void>();
  const publish = (next: boolean) => {
    if (next === matches) return;
    matches = next;
    for (const listener of [...listeners]) listener();
  };
  const change = (event: MediaQueryListEvent) => publish(event.matches);
  const created: Store = {
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        media?.addEventListener("change", change);
        // Catch changes while no consumer was mounted.
        publish(media?.matches ?? fallback);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) media?.removeEventListener("change", change);
      };
    },
    snapshot: () => matches,
  };
  stores.set(query, created);
  return created;
}

/** Whether a media query matches; updates when it changes. `fallback` is the
 * value without a window (and while server rendering). */
export function useMediaQuery(query: string, fallback = false) {
  const { subscribe, snapshot } = store(query, fallback);
  return useSyncExternalStore(subscribe, snapshot, () => fallback);
}
