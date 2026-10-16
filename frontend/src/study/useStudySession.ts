import { useEffect, useEffectEvent, useRef, useState } from "react";
import { errorMessage } from "../api";

/**
 * One saved study session (a lesson or a puzzle) and the commands sent to it.
 * Only the latest load or command may change it: loading again or leaving the
 * screen invalidates everything in flight. One command runs at a time, and a
 * failed command blocks the next until a reload reconciles the server revision,
 * because a lost response may already have been committed.
 */
export function useStudySession<S>(
  id: string,
  load: (signal: AbortSignal) => Promise<S>,
  events: {
    /** Runs as a load or a command starts (stop playback, clear narration). */
    starting?: (kind: "load" | "command") => void;
    /** Runs with a freshly loaded session. */
    loaded?: (session: S) => void;
  } = {},
) {
  const [session, setSession] = useState<S | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);

  async function reload() {
    const version = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    locked.current = true;
    setLoading(true);
    setError("");
    events.starting?.("load");
    try {
      const result = await load(controller.signal);
      if (version !== generation.current) return;
      setSession(result);
      events.loaded?.(result);
    } catch (e) {
      if (version === generation.current) setError(errorMessage(e));
    } finally {
      if (version === generation.current) {
        locked.current = false;
        setLoading(false);
        setBusy(false);
      }
    }
  }
  const open = useEffectEvent(() => void reload());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opening the session fetches it; reload marks it loading first
    open();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- bumping the latest generation is meant to invalidate every request in flight
      generation.current++;
      request.current?.abort();
    };
  }, [id]);

  /**
   * Sends one command. `send` gets the session's signal; `applied` runs with the
   * response only while it is still the latest; `failed` runs as the error is set.
   * Returns false when another command, a load or an error blocks it.
   */
  async function run(
    send: (signal: AbortSignal | undefined) => Promise<S>,
    applied: (result: S) => void,
    failed?: () => void,
  ): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    events.starting?.("command");
    const version = generation.current;
    try {
      const result = await send(request.current?.signal);
      if (version !== generation.current) return true;
      setSession(result);
      applied(result);
    } catch (e) {
      if (version === generation.current) {
        setError(errorMessage(e));
        failed?.();
      }
    } finally {
      if (version === generation.current) {
        locked.current = false;
        setBusy(false);
      }
    }
    return true;
  }

  return { session, loading, busy, error, reload, run };
}
