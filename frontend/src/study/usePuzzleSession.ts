import { useCallback, useEffect, useRef, useState } from "react";
import { api, read, type Promotion, type Schema } from "../api";
import { useInterfaceMotion } from "../MotionProvider";
import { COUNTER_REPLY_DELAY_MS } from "../reviewMotion";
import { puzzleRequestId } from "./puzzleApi";

export type PuzzleSession = Schema["PuzzleSessionView"];
type Frame = PuzzleSession["playback"][number];

/** The server commits the entire turn. Playback never advances the session. */
export function usePuzzleSession(id: string) {
  const [session, setSession] = useState<PuzzleSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [retryReady, setRetryReady] = useState(false);
  const [inspection, setInspection] = useState<Frame | null>(null);
  const [showStart, setShowStart] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const started = useRef(performance.now());
  const motion = useInterfaceMotion();
  const playing = motion === "natural" && frames.length > 0;
  const frame = playing ? frames[frameIndex] || null : inspection;
  const fen = playing && frameIndex < 0 ? frames[0].before_fen
    : showStart ? session?.completion?.solution[0]?.before_fen
    : frame?.after_fen || session?.fen;

  const load = useCallback(async () => {
    const version = ++generation.current;
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    locked.current = true;
    setLoading(true);
    setError("");
    setFrames([]);
    setInspection(null);
    setShowStart(false);
    try {
      const result = await read(api.GET("/api/puzzle-sessions/{session_id}", {
        params: { path: { session_id: id } }, signal: pending.signal,
      }));
      if (version !== generation.current) return;
      setSession(result);
      setRetryReady(false);
      started.current = performance.now();
    } catch (e) {
      if (version === generation.current) setError((e as Error).message);
    } finally {
      if (version === generation.current) {
        locked.current = false;
        setBusy(false);
        setLoading(false);
      }
    }
  }, [id]);
  useEffect(() => {
    void load();
    return () => { generation.current++; controller.current?.abort(); };
  }, [load]);

  useEffect(() => {
    if (!frames.length) return;
    if (motion === "still") {
      setFrames([]);
      return;
    }
    const timer = window.setTimeout(() => {
      if (frameIndex + 1 < frames.length) setFrameIndex(index => index + 1);
      else { setFrames([]); started.current = performance.now(); }
    }, COUNTER_REPLY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [frames, frameIndex, motion]);

  async function act(uci?: string) {
    if (!session || locked.current || playing || error || session.status !== "active") return;
    locked.current = true;
    setBusy(true);
    setError("");
    setInspection(null);
    setShowStart(false);
    const version = generation.current;
    const request = { request_id: puzzleRequestId(), revision: session.revision };
    try {
      const result = uci
        ? await read(api.POST("/api/puzzle-sessions/{session_id}/move", {
            params: { path: { session_id: id } },
            body: { ...request, uci, elapsed_ms: Math.min(86_400_000, Math.max(0, Math.round(performance.now() - started.current))) },
            signal: controller.current?.signal,
          }))
        : await read(api.POST("/api/puzzle-sessions/{session_id}/reveal", {
            params: { path: { session_id: id } }, body: request, signal: controller.current?.signal,
          }));
      if (version !== generation.current) return;
      setSession(result);
      setRetryReady(false);
      setFrameIndex(0);
      setFrames(result.playback);
      started.current = performance.now();
    } catch (e) {
      // A lost response may already be committed, or another tab may have moved.
      // Block another write until reload reconciles the server revision.
      if (version === generation.current) setError((e as Error).message);
    } finally {
      if (version === generation.current) { locked.current = false; setBusy(false); }
    }
  }
  const retrying = session?.feedback?.grade === "incorrect" && !retryReady;
  return {
    session, loading, busy, error, playing, frame, fen, retrying, motion,
    disabled: !session || loading || busy || playing || retrying || !!error || session.status !== "active",
    answer: (from: string, to: string, promotion?: Promotion) => act(from + to + (promotion || "")),
    reveal: () => act(),
    retry: () => { setRetryReady(true); started.current = performance.now(); },
    reload: load,
    inspect: (selected: Frame) => { if (!playing && !busy) { setShowStart(false); setInspection(selected); } },
    inspectStart: () => { if (!playing && !busy) { setInspection(null); setShowStart(true); } },
    replay: () => {
      if (!session?.completion || busy || playing) return;
      if (motion === "still") {
        setInspection(null);
        setShowStart(true);
        return;
      }
      setInspection(null);
      setShowStart(false);
      setFrameIndex(-1);
      setFrames(session.completion.solution);
    },
  };
}
