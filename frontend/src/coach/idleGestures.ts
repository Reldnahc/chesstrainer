import type { CSSProperties } from "react";
import type { CoachDefinition, CoachExpression, CoachIdle } from "./model";
import { gesture, idleChannels, track, type IdleGesture } from "./idleModel";
import { rigChannels } from "./idleRig";

export const idleGestures: Record<CoachIdle, IdleGesture> = {
  blink: gesture("blink", "eyes", [track("eyes", "blink", 260)], { blink: true, intensity: "quiet", cooldownMs: 2400 }),
  "slow-blink": gesture("slow-blink", "eyes", [track("eyes", "slow-blink", 1100)], { blink: true, intensity: "quiet", cooldownMs: 3500 }),
  glance: gesture("glance", "attention", [track("gaze", "glance", 1150)], { intensity: "quiet" }),
  breathe: gesture("breathe", "body", [track("body", "breathe", 1200), track("throat", "throat", 1200)], { intensity: "quiet", cooldownMs: 500 }),
  nod: gesture("nod", "attention", [track("head", "nod", 1100)]),
  glasses: gesture("glasses", "detail", [track("glasses", "glasses", 1050)]),
  hair: gesture("hair", "detail", [track("hair", "hair", 1150)], { intensity: "quiet" }),
  ears: gesture("ears", "detail", [track("leftEar", "ears", 850), track("rightEar", "ears", 850, 120), track("whiskers", "whiskers", 1000)]),
  tail: gesture("tail", "detail", [track("tail", "tail", 1150)]),
  sigh: gesture("sigh", "body", [track("body", "sigh", 1200), track("eyes", "slow-blink", 1000), track("throat", "throat", 1200)], { blink: true, cooldownMs: 3800 }),
  twinkle: gesture("twinkle", "detail", [track("stars", "twinkle", 1100), track("glint", "glint", 1100)]),
  "head-tilt": gesture("head-tilt", "attention", [track("head", "tilt", 1200)]),
  "lean-in": gesture("lean-in", "body", [track("body", "lean", 1200)]),
  "posture-reset": gesture("posture-reset", "body", [track("body", "reset", 1200)], { cooldownMs: 500 }),
  "look-down": gesture("look-down", "attention", [track("head", "look-down", 1200), track("gaze", "gaze-down", 1200)]),
  scan: gesture("scan", "attention", [track("head", "scan", 1200), track("gaze", "gaze-scan", 1200), track("scanline", "screen-scan", 1200), track("lens", "lens", 1200)]),
};

export function configuredGestures(animation: CoachDefinition["animation"], expression: CoachExpression) {
  const ids = animation.idleGestures[expression] ?? animation.defaultIdle;
  const channels = rigChannels(animation.motionProfile?.id ?? "unknown", expression);
  return [...new Set(ids)].flatMap((id) => {
    if (!id) return [];
    const definition = idleGestures[id];
    const tracks = definition.tracks.filter((part) => channels.includes(part.channel));
    return tracks.length ? [{ ...definition, tracks,
      durationMs: Math.max(...tracks.map((part) => part.durationMs + (part.delayMs ?? 0))),
    }] : [];
  });
}

export function idleTrackStyle(active: readonly { gesture: IdleGesture }[]): CSSProperties {
  const property = (channel: string) => channel === "gaze" ? "--idle-gaze-track" : `--idle-${channel}`;
  const style: Record<string, string> = Object.fromEntries(idleChannels.map((channel) => [property(channel), "none"]));
  for (const { gesture: playing } of active) {
    for (const part of playing.tracks) {
      style[property(part.channel)] = `${part.keyframes} ${part.durationMs}ms ${part.delayMs ?? 0}ms both`;
    }
  }
  return style as CSSProperties;
}
