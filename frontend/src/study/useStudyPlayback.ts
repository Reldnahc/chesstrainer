import { useCallback, useEffect, useRef, useState } from "react";
import type { Schema } from "../api";
import type { useAudioScope } from "../audio/AudioProvider";
import { useInterfaceMotion } from "../MotionProvider";
import { COUNTER_REPLY_DELAY_MS } from "../reviewMotion";

type Frame = Schema["PuzzleFrame"];

/** Display committed server frames. Timers never advance a puzzle or lesson. */
export function useStudyPlayback(
  onFinish?: () => void,
  intervalMs = COUNTER_REPLY_DELAY_MS,
  audio?: ReturnType<typeof useAudioScope>,
  settledFen?: string,
) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [index, setIndex] = useState(0);
  const [inspection, setInspection] = useState<{ fen: string; frame: Frame | null } | null>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const sound = useRef(audio);
  sound.current = audio;
  const playbackId = useRef(0);
  const motion = useInterfaceMotion();
  const playing = motion === "natural" && frames.length > 0;
  const frame = playing ? frames[index] || null : inspection?.frame || null;
  const fen = playing ? index < 0 ? frames[0].before_fen : frame?.after_fen : inspection?.fen;
  useEffect(() => {
    if (!frames.length) return;
    if (motion === "still") {
      setFrames([]);
      finish.current?.();
      return;
    }
    const run = playbackId.current;
    const timer = window.setTimeout(() => {
      if (index + 1 < frames.length) {
        sound.current?.move(frames[index + 1].san, `playback:${run}:${index + 1}`);
        setIndex(value => value + 1);
      }
      else { setFrames([]); finish.current?.(); }
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [frames, index, motion, intervalMs]);
  const reset = useCallback(() => {
    sound.current?.cancel();
    playbackId.current++;
    setFrames([]);
    setInspection(null);
  }, []);
  const play = useCallback((next: Frame[], fromStart = false) => {
    sound.current?.cancel();
    const run = ++playbackId.current;
    // Still motion collapses a committed continuation into its final position.
    // Play only that visible move; the hidden intermediate frames stay silent.
    if (!fromStart && next.length) {
      const firstVisible = motion === "still" ? next.length - 1 : 0;
      sound.current?.move(next[firstVisible].san, `playback:${run}:${firstVisible}`);
    }
    setInspection(motion === "still" && fromStart && next.length ? { fen: next[0].before_fen, frame: null } : null);
    setIndex(fromStart ? -1 : 0);
    setFrames(next);
  }, [motion]);
  return {
    frame, fen, playing, motion, play, reset,
    inspect: (selected: Frame) => {
      if (playing) return;
      sound.current?.cancel();
      const displayedFen = inspection?.fen || settledFen;
      if (selected.after_fen !== displayedFen) {
        const eventId = `inspect:${++playbackId.current}`;
        if (selected.before_fen === displayedFen) sound.current?.move(selected.san, eventId);
        else sound.current?.play("move", eventId);
      }
      setInspection({ fen: selected.after_fen, frame: selected });
    },
    inspectStart: (first?: Frame) => {
      if (playing || !first) return;
      sound.current?.cancel();
      if (first.before_fen !== (inspection?.fen || settledFen)) sound.current?.play("move", `inspect:${++playbackId.current}`);
      setInspection({ fen: first.before_fen, frame: null });
    },
  };
}
