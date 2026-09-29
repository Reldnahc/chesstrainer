import { useCallback, useEffect, useRef, useState } from "react";
import type { Schema } from "../api";
import { useInterfaceMotion } from "../MotionProvider";
import { COUNTER_REPLY_DELAY_MS } from "../reviewMotion";

type Frame = Schema["PuzzleFrame"];

/** Display committed server frames. Timers never advance a puzzle or lesson. */
export function useStudyPlayback(onFinish?: () => void, intervalMs = COUNTER_REPLY_DELAY_MS) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [index, setIndex] = useState(0);
  const [inspection, setInspection] = useState<{ fen: string; frame: Frame | null } | null>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
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
    const timer = window.setTimeout(() => {
      if (index + 1 < frames.length) setIndex(value => value + 1);
      else { setFrames([]); finish.current?.(); }
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [frames, index, motion, intervalMs]);
  const reset = useCallback(() => {
    setFrames([]);
    setInspection(null);
  }, []);
  const play = useCallback((next: Frame[], fromStart = false) => {
    setInspection(motion === "still" && fromStart && next.length ? { fen: next[0].before_fen, frame: null } : null);
    setIndex(fromStart ? -1 : 0);
    setFrames(next);
  }, [motion]);
  return {
    frame, fen, playing, motion, play, reset,
    inspect: (selected: Frame) => { if (!playing) setInspection({ fen: selected.after_fen, frame: selected }); },
    inspectStart: (first?: Frame) => { if (!playing && first) setInspection({ fen: first.before_fen, frame: null }); },
  };
}
