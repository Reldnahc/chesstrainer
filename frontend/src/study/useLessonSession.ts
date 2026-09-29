import { useCallback, useEffect, useRef, useState } from "react";
import { api, read, type Promotion, type Schema } from "../api";
import { studyRequestId } from "./requestId";
import { useStudyPlayback } from "./useStudyPlayback";

export type LessonSession = Schema["LessonSessionView"];
export type LessonAction = Schema["LessonCommand"]["action"];

export function useLessonSession(id: string) {
  const [session, setSession] = useState<LessonSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const playback = useStudyPlayback();
  const { reset } = playback;
  const load = useCallback(async () => {
    const version = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    locked.current = true;
    setLoading(true);
    setError("");
    reset();
    try {
      const result = await read(api.GET("/api/study/lesson-sessions/{session_id}", {
        params: { path: { session_id: id } }, signal: controller.signal,
      }));
      if (generation.current === version) setSession(result);
    } catch (e) { if (generation.current === version) setError((e as Error).message); }
    finally {
      if (generation.current === version) { locked.current = false; setLoading(false); setBusy(false); }
    }
  }, [id, reset]);
  useEffect(() => {
    void load();
    return () => { generation.current++; request.current?.abort(); };
  }, [load]);
  async function command(action: LessonAction, extra?: { uci?: string; ply?: number }) {
    if (!session || locked.current || playback.playing || error || !session.actions.includes(action)) return;
    locked.current = true;
    setBusy(true);
    const version = generation.current;
    reset();
    try {
      const result = await read(api.POST("/api/study/lesson-sessions/{session_id}/command", {
        params: { path: { session_id: id } }, signal: request.current?.signal,
        body: { action, ...extra, revision: session.revision, request_id: studyRequestId() },
      }));
      if (generation.current !== version) return;
      setSession(result);
      playback.play(result.playback);
    } catch (e) {
      // A command may have committed despite a lost response. Reconcile first.
      if (generation.current === version) setError((e as Error).message);
    } finally {
      if (generation.current === version) { locked.current = false; setBusy(false); }
    }
  }
  return {
    session, loading, busy, error, command, reload: load, playback,
    disabled: busy || playback.playing || !!error,
    answer: (from: string, to: string, promotion?: Promotion) => command("move", { uci: from + to + (promotion || "") }),
  };
}
