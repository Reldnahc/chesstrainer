// Shared by the script-driven animations (disclosures, loader hand-offs), which
// the CSS Still policy in interface-motion.css cannot stop by itself.

import { REDUCED_MOTION_QUERY } from "./mediaQuery";
import { resolveMotion, type MotionPreference } from "./motion";

/** MotionProvider's resolved choice, or the device setting before it is known. */
export function motionAllowed() {
  const choice = document.documentElement.dataset.interfaceMotion as MotionPreference | undefined;
  return resolveMotion(choice ?? "system", window.matchMedia(REDUCED_MOTION_QUERY).matches) === "natural";
}

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A --motion-* token in milliseconds; the build may rewrite 250ms as .25s. */
export function duration(name: string) {
  const time = token(name), value = parseFloat(time) || 0;
  return time.endsWith("ms") ? value : time.endsWith("s") ? value * 1000 : value;
}

export function easing(name: string) {
  return token(name) || "ease-in-out";
}
