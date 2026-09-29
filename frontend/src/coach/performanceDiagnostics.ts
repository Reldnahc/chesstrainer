import type { IdleFrame } from "./idleCoordinator";
import type { CoachExpression, CoachMotion } from "./model";

/** Optional observation of the production lifecycle; the studio owns its UI. */
export type CoachPerformanceSnapshot = {
  at: number;
  identity: string;
  expression: CoachExpression;
  phase: "reaction" | "rest";
  face: "entrance" | "settled";
  motion: CoachMotion;
  paused: "offscreen" | "hidden" | "still" | "pending" | "reaction" | "disabled" | null;
  active: IdleFrame["active"];
  nextAt: number | null;
  diagnostics: IdleFrame["diagnostics"] | null;
};

export function seededIdleRandom(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
