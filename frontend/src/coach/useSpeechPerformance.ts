import { useLayoutEffect, type RefObject } from "react";
import type { SpeechPlayback } from "../audio/model";
import { speechMouthAt, speechMouthPoses, type SpeechMouthPose, type SpeechMouthShape, type SpeechMouthTrack } from "./speechMouth";

const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const mouthParts = Object.keys(speechMouthPoses.rest) as (keyof SpeechMouthPose)[];

/** Only the speaking portrait samples the audio clock; SVG descendants use CSS variables. */
export function useSpeechPerformance(
  ref: RefObject<HTMLDivElement | null>, playback: SpeechPlayback | undefined,
  enabled: boolean, identity: string, track?: SpeechMouthTrack, previewShape?: SpeechMouthShape,
) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    let previousTime: number | undefined;
    let openness = 0;
    let roundness = .5;
    let pose = { ...speechMouthPoses.rest };
    const reset = () => {
      node.dataset.speaking = "false";
      delete node.dataset.articulation;
      delete node.dataset.mouthShape;
      delete node.dataset.speechPreview;
      for (const part of mouthParts) node.style.removeProperty(`--speech-${part}`);
      openness = 0;
      roundness = .5;
      pose = { ...speechMouthPoses.rest };
      previousTime = undefined;
    };
    reset();
    // Explicit studio inspection holds a pose without scheduling motion or audio.
    if (previewShape) {
      node.dataset.speaking = "true";
      node.dataset.speechPreview = "true";
      node.dataset.articulation = "aligned";
      node.dataset.mouthShape = previewShape;
      for (const part of mouthParts) {
        node.style.setProperty(`--speech-${part}`, String(speechMouthPoses[previewShape][part]));
      }
      return reset;
    }
    if (!enabled || !playback) return reset;
    const tick = (time: number) => {
      const activity = playback.read();
      if (!activity) reset();
      else {
        const dt = previousTime === undefined ? 16 : Math.min(64, Math.max(0, time - previousTime));
        previousTime = time;
        if (node.dataset.speaking !== "true") node.dataset.speaking = "true";
        if (track) {
          const shape = speechMouthAt(track, activity.elapsedSeconds);
          const target = speechMouthPoses[shape];
          if (node.dataset.articulation !== "aligned") node.dataset.articulation = "aligned";
          if (node.dataset.mouthShape !== shape) node.dataset.mouthShape = shape;
          // Quick closures make P/B/M readable; short easing avoids hard swaps.
          for (const part of mouthParts) {
            const duration = part === 'open' && target.open === 0 ? 18 : 30;
            pose[part] += (target[part] - pose[part]) * (1 - Math.exp(-dt / duration));
            const value = part === 'open' && pose[part] < .025 ? 0 : bounded(pose[part]);
            node.style.setProperty(`--speech-${part}`, value.toFixed(3));
          }
        } else {
          const target = bounded(activity.energy);
          openness += (target - openness) * (1 - Math.exp(-dt / (target > openness ? 25 : 45)));
          roundness += (1 - bounded(activity.brightness) - roundness) * (1 - Math.exp(-dt / 65));
          const open = openness < .025 ? 0 : openness;
          node.style.setProperty("--speech-open", open.toFixed(3));
          node.style.setProperty("--speech-round", roundness.toFixed(3));
          node.style.setProperty("--speech-jaw", open.toFixed(3));
        }
      }
      // A suspended audio context can resume at the same sample. The owner clears
      // terminal handles; visibility/Still/unmount cancel this loop independently.
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); reset(); };
  }, [ref, playback, enabled, identity, track, previewShape]);
}
