import { gesture, track, type IdleGesture } from "./idleModel";

export type SharedIdle = "double-blink" | "glance-right" | "look-up"
  | "nod-twice" | "tilt-right" | "weight-shift";

export const sharedIdleGestures: Record<SharedIdle, IdleGesture> = {
  "double-blink": gesture("double-blink", "eyes", [track("eyes", "double-blink", 640)], {
    blink: true, intensity: "quiet", cooldownMs: 4200, weight: 0.7,
  }),
  "glance-right": gesture("glance-right", "attention", [track("gaze", "glance-right", 1150)], {
    intensity: "quiet", cooldownMs: 2100,
  }),
  "look-up": gesture("look-up", "attention", [
    track("head", "look-up", 1300), track("gaze", "gaze-up", 1100, 100),
  ], { cooldownMs: 3300, weight: 0.8 }),
  "nod-twice": gesture("nod-twice", "attention", [track("head", "nod-twice", 1350)], {
    cooldownMs: 4500, weight: 0.7,
  }),
  "tilt-right": gesture("tilt-right", "attention", [
    track("head", "tilt-right", 1400), track("gaze", "gaze-consider", 1050, 100),
  ], { cooldownMs: 2400 }),
  "weight-shift": gesture("weight-shift", "body", [track("body", "weight-shift", 1450)], {
    intensity: "quiet", cooldownMs: 1700,
  }),
};
