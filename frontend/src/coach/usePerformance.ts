import { useEffect, useRef, useState } from "react";
import {
  type CoachDefinition,
  type CoachMicro,
  type CoachMotion,
  type CoachReaction,
} from "./model";
import { IDLE_GAP_MS, nextIdle } from "./idle";
import { useReducedMotion } from "./useReducedMotion";

export function usePerformance({
  reaction,
  identity,
  motion,
  idleEnabled = true,
  replay = 0,
  previewIdle = "",
  animation,
  reactionsEnabled = true,
}: {
  reaction: CoachReaction;
  identity: string;
  motion: CoachMotion;
  idleEnabled?: boolean;
  replay?: number;
  previewIdle?: CoachMicro;
  animation: CoachDefinition["animation"];
  reactionsEnabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(!document.hidden);
  const [committed, setCommitted] = useState<CoachReaction | null>(null);
  const [phase, setPhase] = useState<"reaction" | "rest">("rest");
  const [micro, setMicro] = useState<CoachMicro>("");
  const [take, setTake] = useState(0);
  const played = useRef(0);
  const reduced = useReducedMotion();
  const effectiveMotion = reduced ? "still" : motion;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    const update = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    // A brief dwell suppresses scrubbing reactions; thinking needs a longer dwell
    // so a cached/fast answer doesn't flash a loading expression.
    const delay = reaction.state === "thinking" ? 420 : 110;
    const timer = window.setTimeout(() => {
      setCommitted(reaction);
      setTake((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [reaction.key, reaction.state, identity, replay]);

  const current =
    committed?.key === reaction.key && committed?.state === reaction.state;
  // Known feedback is readable immediately. Only the entrance waits for a dwell;
  // inserting a neutral face between two known moves creates visible flicker.
  const expression =
    reaction.state === "thinking" && !current ? "neutral" : reaction.state;
  useEffect(() => {
    let timer: number | undefined;
    let finish: number | undefined;
    const running = effectiveMotion !== "still" && visible && active && current;
    setMicro("");
    const fresh = current && played.current !== take;
    if (running) played.current = take;
    setPhase(
      running && fresh && reactionsEnabled && !previewIdle
        ? "reaction"
        : "rest",
    );
    if (!running) return;
    let last: CoachMicro = "";
    const scheduleIdle = () => {
      if (!idleEnabled) return;
      timer = window.setTimeout(
        () => {
          last = nextIdle(animation, expression, last);
          setMicro(last);
          finish = window.setTimeout(() => {
            setMicro("");
            scheduleIdle();
          }, 1200);
        },
        IDLE_GAP_MS[0] + Math.random() * (IDLE_GAP_MS[1] - IDLE_GAP_MS[0]),
      );
    };
    if (previewIdle && fresh) {
      setMicro(previewIdle);
      finish = window.setTimeout(() => {
        setMicro("");
        scheduleIdle();
      }, 1500);
    } else if (fresh && reactionsEnabled) {
      timer = window.setTimeout(() => {
        setPhase("rest");
        scheduleIdle();
      }, animation.reactionMs[expression] ?? animation.defaultReactionMs);
    } else scheduleIdle();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(finish);
    };
  }, [
    take,
    expression,
    current,
    effectiveMotion,
    visible,
    active,
    idleEnabled,
    previewIdle,
    animation,
    reactionsEnabled,
    identity,
  ]);

  return { ref, expression, phase, micro, take, motion: effectiveMotion };
}
