import { useEffect, useRef } from "react";

/** The application's page-level keys. Element-level keys (tabs, graph points)
 * stop propagation, so they never also reach these. */
export type ShortcutKey = "ArrowLeft" | "ArrowRight" | "Home" | "End" | "Escape";
export type Shortcuts = Partial<Record<ShortcutKey, () => void>>;

type Layer = { current: Shortcuts };
const layers: Layer[] = [];

function keydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Modal choices and native popovers own Escape and focus navigation.
  if (document.querySelector(":modal, :popover-open")) return;
  if (event.target instanceof Element && event.target.closest("input,select,textarea,[contenteditable=true]")) return;
  // The most recently opened owner of a key handles it, so a panel opened over
  // the page (the practice continuation) takes the keys while it is open.
  for (let i = layers.length - 1; i >= 0; i--) {
    const run = layers[i].current[event.key as ShortcutKey];
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
  const layer = useRef<Layer>({ current: shortcuts });
  layer.current.current = shortcuts;
  useEffect(() => {
    if (!enabled) return;
    const own = layer.current;
    layers.push(own);
    if (layers.length === 1) window.addEventListener("keydown", keydown);
    return () => {
      layers.splice(layers.indexOf(own), 1);
      if (!layers.length) window.removeEventListener("keydown", keydown);
    };
  }, [enabled]);
}
