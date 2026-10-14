import { useEffect } from "react";
import { useLatest } from "./useLatest";

/** The application's page-level keys (letters in lower case). Element-level
 * keys (tabs, graph points) stop propagation, so they never also reach these. */
export type ShortcutKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End" | "Escape" | "a" | "d" | "x";
export type Shortcuts = Partial<Record<ShortcutKey, () => void>>;

type Layer = { current: Shortcuts };
const layers: Layer[] = [];

function keydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Modal choices and native popovers own Escape and focus navigation. A leaving
  // copy of one (ghost.ts) is only a picture fading out, so it does not count.
  if (document.querySelector(":modal, :popover-open:not([data-ghost])")) return;
  if (event.target instanceof Element && event.target.closest("input,select,textarea,[contenteditable=true]")) return;
  // The most recently opened owner of a key handles it, so a panel opened over
  // the page (the practice continuation) takes the keys while it is open.
  const key = (event.key.length === 1 ? event.key.toLowerCase() : event.key) as ShortcutKey;
  for (let i = layers.length - 1; i >= 0; i--) {
    const run = layers[i].current[key];
    if (run) {
      event.preventDefault();
      run();
      return;
    }
  }
}

/** Binds page keyboard shortcuts while mounted and enabled. Pass the current
 * handlers each render; registration order (not render order) decides which
 * owner wins a key that more than one binds. */
export default function usePageShortcuts(shortcuts: Shortcuts, enabled = true) {
  const layer: Layer = useLatest(shortcuts);
  useEffect(() => {
    if (!enabled) return;
    layers.push(layer);
    if (layers.length === 1) window.addEventListener("keydown", keydown);
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      if (!layers.length) window.removeEventListener("keydown", keydown);
    };
  }, [enabled, layer]);
}
