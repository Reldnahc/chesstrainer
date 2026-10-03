import { useLayoutEffect, useRef, type RefObject } from "react";
import type { SpeechPlayback } from "../audio/model";
import { speechMouthAt, speechMouthPoses, type SpeechMouthPose, type SpeechMouthShape, type SpeechMouthTrack } from "./speechMouth";

const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const mouthParts = Object.keys(speechMouthPoses.rest) as (keyof SpeechMouthPose)[];
/** A finished line eases closed with this time constant before the authored mouth returns. */
const RELEASE_MS = 40;
const SETTLED = .02;

type MouthState = {
  identity?: string;
  pose: SpeechMouthPose;
  openness: number;
  roundness: number;
};

const restingState = (identity?: string): MouthState =>
  ({ identity, pose: { ...speechMouthPoses.rest }, openness: 0, roundness: .5 });

/** Only the speaking portrait samples the audio clock; SVG descendants use CSS variables.
    The mouth state outlives a playback handle so the end of a line can ease closed. */
export function useSpeechPerformance(
  ref: RefObject<HTMLDivElement | null>, playback: SpeechPlayback | undefined,
  enabled: boolean, identity: string, track?: SpeechMouthTrack, previewShape?: SpeechMouthShape,
) {
  const state = useRef<MouthState>(restingState());

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    let previousTime: number | undefined;
    const reset = () => {
      node.dataset.speaking = "false";
      delete node.dataset.articulation;
      delete node.dataset.mouthShape;
      delete node.dataset.speechPreview;
      for (const part of mouthParts) node.style.removeProperty(`--speech-${part}`);
      state.current = restingState(identity);
    };
    const step = (time: number) => {
      const dt = previousTime === undefined ? 16 : Math.min(64, Math.max(0, time - previousTime));
      previousTime = time;
      return dt;
    };
    /** Ease every control toward rest; returns true once the closed mouth can hand back to the artwork. */
    const release = (dt: number) => {
      if (node.dataset.speaking !== "true") return true;
      const mouth = state.current;
      const blend = 1 - Math.exp(-dt / RELEASE_MS);
      if (node.dataset.articulation === "aligned") {
        for (const part of mouthParts) {
          mouth.pose[part] += (speechMouthPoses.rest[part] - mouth.pose[part]) * blend;
          node.style.setProperty(`--speech-${part}`, bounded(mouth.pose[part]).toFixed(3));
        }
        if (node.dataset.mouthShape !== "rest") node.dataset.mouthShape = "rest";
      } else {
        mouth.openness -= mouth.openness * blend;
        node.style.setProperty("--speech-open", mouth.openness.toFixed(3));
        node.style.setProperty("--speech-jaw", mouth.openness.toFixed(3));
      }
      const open = node.dataset.articulation === "aligned" ? Math.max(mouth.pose.open, mouth.pose.jaw) : mouth.openness;
      if (open >= SETTLED) return false;
      reset();
      return true;
    };

    // A different coach or direction never inherits another portrait's mouth.
    if (state.current.identity !== identity) reset();
    // Explicit studio inspection holds a pose without scheduling motion or audio.
    if (previewShape) {
      reset();
      node.dataset.speaking = "true";
      node.dataset.speechPreview = "true";
      node.dataset.articulation = "aligned";
      node.dataset.mouthShape = previewShape;
      for (const part of mouthParts) {
        node.style.setProperty(`--speech-${part}`, String(speechMouthPoses[previewShape][part]));
      }
      return reset;
    }
    if (!enabled) {
      reset();
      return;
    }
    if (!playback) {
      // The owner clears a finished handle at once; finish closing the mouth here.
      const closing = (time: number) => {
        if (!release(step(time))) frame = requestAnimationFrame(closing);
      };
      if (node.dataset.speaking === "true") frame = requestAnimationFrame(closing);
      return () => cancelAnimationFrame(frame);
    }
    const tick = (time: number) => {
      const dt = step(time);
      const activity = playback.read();
      const mouth = state.current;
      if (!activity) release(dt);
      else {
        if (node.dataset.speaking !== "true") node.dataset.speaking = "true";
        if (track) {
          const shape = speechMouthAt(track, activity.elapsedSeconds);
          const target = speechMouthPoses[shape];
          if (node.dataset.articulation !== "aligned") node.dataset.articulation = "aligned";
          if (node.dataset.mouthShape !== shape) node.dataset.mouthShape = shape;
          // Quick closures make P/B/M readable; short easing avoids hard swaps.
          for (const part of mouthParts) {
            const duration = part === 'open' && target.open === 0 ? 18 : 30;
            mouth.pose[part] += (target[part] - mouth.pose[part]) * (1 - Math.exp(-dt / duration));
            const value = part === 'open' && mouth.pose[part] < .025 ? 0 : bounded(mouth.pose[part]);
            node.style.setProperty(`--speech-${part}`, value.toFixed(3));
          }
        } else {
          const target = bounded(activity.energy);
          mouth.openness += (target - mouth.openness) * (1 - Math.exp(-dt / (target > mouth.openness ? 25 : 45)));
          mouth.roundness += (1 - bounded(activity.brightness) - mouth.roundness) * (1 - Math.exp(-dt / 65));
          const open = mouth.openness < .025 ? 0 : mouth.openness;
          node.style.setProperty("--speech-open", open.toFixed(3));
          node.style.setProperty("--speech-round", mouth.roundness.toFixed(3));
          node.style.setProperty("--speech-jaw", open.toFixed(3));
        }
      }
      // A suspended audio context can resume at the same sample. The owner clears
      // terminal handles; visibility/Still/unmount cancel this loop independently.
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, playback, enabled, identity, track, previewShape]);

  // Unmounting ends any closing tail with the portrait.
  useLayoutEffect(() => {
    const node = ref.current;
    return () => {
      if (!node) return;
      node.dataset.speaking = "false";
      delete node.dataset.articulation;
      delete node.dataset.mouthShape;
      delete node.dataset.speechPreview;
      for (const part of mouthParts) node.style.removeProperty(`--speech-${part}`);
      state.current = restingState();
    };
  }, [ref]);
}
