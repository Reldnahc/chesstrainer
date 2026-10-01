import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CoachDefinition,
  type CoachMicro,
  type CoachMotion,
  type CoachReaction,
} from "./model";
import { configuredGestures, idleTrackStyle } from "./idleGestures";
import { createIdleCoordinator, type IdleFrame } from "./idleCoordinator";
import { useReducedMotion } from "../useReducedMotion";
import { resolveMotion } from "../motion";
import { seededIdleRandom, type CoachPerformanceSnapshot } from "./performanceDiagnostics";

export function usePerformance({
  reaction,
  identity,
  motion,
  idleEnabled = true,
  replay = 0,
  previewIdle = "",
  animation,
  reactionsEnabled = true,
  idleSeed,
  idleReset = 0,
  onPerformance,
}: {
  reaction: CoachReaction;
  identity: string;
  motion: CoachMotion;
  idleEnabled?: boolean;
  replay?: number;
  previewIdle?: CoachMicro;
  animation: CoachDefinition["animation"];
  reactionsEnabled?: boolean;
  idleSeed?: number;
  idleReset?: number;
  onPerformance?: (snapshot: CoachPerformanceSnapshot) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(!document.hidden);
  const [committed, setCommitted] = useState<(CoachReaction & { identity: string }) | null>(null);
  const [phase, setPhase] = useState<"reaction" | "rest">("rest");
  const [frame, setFrame] = useState<{ owner: string; value: IdleFrame } | null>(null);
  const [take, setTake] = useState(0);
  const played = useRef(0);
  const diagnosticObserver = useRef(onPerformance);
  const observing = Boolean(onPerformance);
  useEffect(() => { diagnosticObserver.current = onPerformance; }, [onPerformance]);
  const reduced = useReducedMotion();
  const effectiveMotion = resolveMotion(motion, reduced);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // A busy frame can deliver several queued changes for this portrait.
        // Its latest entry describes whether it is currently visible.
        const entry = entries.at(-1);
        if (entry) setVisible(entry.isIntersecting);
      },
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
      setCommitted({ ...reaction, identity });
      setTake((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [reaction.key, reaction.state, identity, replay]);

  const current =
    committed?.key === reaction.key && committed?.state === reaction.state && committed?.identity === identity;
  // Known feedback is readable immediately. Only the entrance waits for a dwell;
  // inserting a neutral face between two known moves creates visible flicker.
  const expression =
    reaction.state === "thinking" && !current ? "neutral" : reaction.state;
  const gestures = useMemo(() => configuredGestures(animation, expression), [animation, expression]);
  const coordinator = useMemo(() => createIdleCoordinator(gestures, {
    now: performance.now(),
    random: idleSeed === undefined ? undefined : seededIdleRandom(idleSeed),
  }), [gestures, identity, idleSeed, idleReset]);
  const owner = `${identity}:${reaction.key}:${reaction.state}:${take}:${idleSeed ?? "random"}:${idleReset}`;
  const idlePreview = gestures.find((entry) => entry.id === previewIdle);
  useEffect(() => {
    let timer: number | undefined;
    const running = effectiveMotion !== "still" && visible && active && current;
    setFrame(null);
    coordinator.suspend(performance.now());
    const fresh = current && played.current !== take;
    if (running) played.current = take;
    setPhase(
      running && fresh && reactionsEnabled && !idlePreview
        ? "reaction"
        : "rest",
    );
    if (!running) return;
    const publish = (value: IdleFrame) => {
      setFrame({ owner, value });
      if (value.nextAt !== null) {
        timer = window.setTimeout(() => publish(coordinator.advance(performance.now())), Math.max(1, value.nextAt - performance.now()));
      }
    };
    const scheduleIdle = () => {
      if (idleEnabled) publish(coordinator.resume(performance.now()));
    };
    if (idlePreview && fresh) {
      const gesture = idlePreview;
      const startedAt = performance.now();
      const preview = { gesture, startedAt, endsAt: startedAt + gesture.durationMs, sequence: take };
      setFrame({ owner, value: { ...coordinator.snapshot(startedAt), active: [preview], started: [preview], nextAt: null } });
      timer = window.setTimeout(() => {
        setFrame(null);
        scheduleIdle();
      }, gesture.durationMs);
    } else if (fresh && reactionsEnabled) {
      timer = window.setTimeout(() => {
        setPhase("rest");
        scheduleIdle();
      }, animation.reactionMs[expression] ?? animation.defaultReactionMs);
    } else scheduleIdle();
    return () => {
      window.clearTimeout(timer);
      coordinator.suspend(performance.now());
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
    owner,
    coordinator,
    gestures,
    idlePreview,
  ]);

  const tracks = current && visible && active && effectiveMotion !== "still" && frame?.owner === owner ? frame.value.active : [];
  const animated = visible && active && effectiveMotion !== "still";
  // The face is already meaningful during the dwell. Only a fresh entrance may
  // hold its authored eye squeeze; paused/seen entrances settle without replay.
  const face: "entrance" | "settled" = animated && reactionsEnabled && !idlePreview
    && (!current || played.current !== take || phase === "reaction") ? "entrance" : "settled";
  useEffect(() => {
    if (!observing) return;
    const value = frame?.owner === owner ? frame.value : null;
    const paused = !active ? "hidden" : !visible ? "offscreen"
      : effectiveMotion === "still" ? "still" : !current ? "pending"
        : phase === "reaction" ? "reaction"
          : !idleEnabled && !value?.active.length ? "disabled" : null;
    const observed = paused ? coordinator.snapshot() : value ?? coordinator.snapshot();
    diagnosticObserver.current?.({
      at: observed.at, identity, expression, face, motion: effectiveMotion,
      phase: current && animated ? phase : "rest", paused,
      active: current && animated ? value?.active ?? [] : [],
      nextAt: current && animated ? value?.nextAt ?? null : null,
      diagnostics: observed.diagnostics,
    });
  }, [observing, active, visible, effectiveMotion, current, phase, idleEnabled,
    frame, owner, identity, expression, face, animated, coordinator]);
  return {
    ref, expression, face, animated, phase: current && animated ? phase : "rest", micro: tracks[0]?.gesture.id ?? "", take,
    motion: effectiveMotion, idles: tracks.map((track) => track.gesture.id).join(" "),
    idleStyle: idleTrackStyle(tracks), diagnostics: frame?.owner === owner ? frame.value.diagnostics : null,
  };
}
