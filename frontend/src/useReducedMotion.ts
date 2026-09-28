import { useSyncExternalStore } from "react";

const media =
  typeof window === "undefined"
    ? null
    : window.matchMedia("(prefers-reduced-motion: reduce)");
let reduced = media?.matches ?? true;
const listeners = new Set<() => void>();

function publish(next: boolean) {
  if (next === reduced) return;
  reduced = next;
  for (const listener of [...listeners]) listener();
}

const change = (event: MediaQueryListEvent) => publish(event.matches);
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    media?.addEventListener("change", change);
    // Catch changes while no motion consumer was mounted.
    publish(media?.matches ?? true);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) media?.removeEventListener("change", change);
  };
};

// Reading the live MediaQueryList during animation renders can consume a pending
// Chromium media change before its event arrives. All consumers instead read the
// same event-driven snapshot, so portraits and preference controls change together.
const snapshot = () => reduced;
const serverSnapshot = () => true;
export const useReducedMotion = () =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
