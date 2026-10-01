import { useLayoutEffect, type RefObject } from "react";
import type { SpeechPlayback } from "../audio/model";

const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Only the speaking portrait samples the audio clock; SVG descendants use CSS variables. */
export function useSpeechPerformance(
  ref: RefObject<HTMLDivElement | null>, playback: SpeechPlayback | undefined,
  enabled: boolean, identity: string,
) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    let previousTime: number | undefined;
    let openness = 0;
    let roundness = .5;
    const reset = () => {
      node.dataset.speaking = "false";
      node.style.removeProperty("--speech-open");
      node.style.removeProperty("--speech-round");
      node.style.removeProperty("--speech-jaw");
      openness = 0;
      roundness = .5;
      previousTime = undefined;
    };
    reset();
    if (!enabled || !playback) return reset;
    const tick = (time: number) => {
      const activity = playback.read();
      if (!activity) reset();
      else {
        const dt = previousTime === undefined ? 16 : Math.min(64, Math.max(0, time - previousTime));
        previousTime = time;
        const target = bounded(activity.energy);
        openness += (target - openness) * (1 - Math.exp(-dt / (target > openness ? 25 : 45)));
        roundness += (1 - bounded(activity.brightness) - roundness) * (1 - Math.exp(-dt / 65));
        const open = openness < .025 ? 0 : openness;
        if (node.dataset.speaking !== "true") node.dataset.speaking = "true";
        node.style.setProperty("--speech-open", open.toFixed(3));
        node.style.setProperty("--speech-round", roundness.toFixed(3));
        node.style.setProperty("--speech-jaw", open.toFixed(3));
      }
      // A suspended audio context can resume at the same sample. The owner clears
      // terminal handles; visibility/Still/unmount cancel this loop independently.
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); reset(); };
  }, [ref, playback, enabled, identity]);
}
