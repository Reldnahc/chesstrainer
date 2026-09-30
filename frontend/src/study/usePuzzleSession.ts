import { useCallback, useEffect, useRef, useState } from "react";
import { api, read, type Promotion, type Schema } from "../api";
import { useAudioScope } from "../audio/AudioProvider";
import { studyRequestId } from "./requestId";
import { useStudyPlayback } from "./useStudyPlayback";

export type PuzzleSession = Schema["PuzzleSessionView"];
type Frame = PuzzleSession["playback"][number];

/** The server commits the entire turn. Playback never advances the session. */
export function usePuzzleSession(id: string) {
  const [session, setSession] = useState<PuzzleSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryReady, setRetryReady] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const started = useRef(performance.now());
  const audio = useAudioScope(`puzzle:${id}`);
  const playback = useStudyPlayback(() => { started.current = performance.now(); }, undefined, audio, session?.fen);
  const { reset, playing } = playback;

  const load = useCallback(async () => {
    const version = ++generation.current;
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    locked.current = true;
    setLoading(true);
    setError("");
    reset();
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
  }, [id, reset]);
  useEffect(() => {
    void load();
    return () => { generation.current++; controller.current?.abort(); };
  }, [load]);

  async function act(uci?: string) {
    if (!session || locked.current || playing || error || session.status !== "active") return;
    locked.current = true;
    setBusy(true);
    setError("");
    reset();
    const version = generation.current;
    const request = { request_id: studyRequestId(), revision: session.revision };
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
      playback.play(result.playback);
      const eventId = `revision:${result.revision}`;
      if (uci && !result.playback.length) {
        if (result.feedback?.submitted_san) audio.move(result.feedback.submitted_san, `${eventId}:board`);
        else audio.play("move", `${eventId}:board`);
      }
      if (uci && result.status === "solved") {
        audio.play("complete", `${eventId}:feedback`, { delayMs: 160 });
      } else if (uci && result.feedback?.grade === "correct") {
        audio.play("correct", `${eventId}:feedback`, { delayMs: 160 });
      } else if (uci && result.feedback?.grade === "incorrect") {
        audio.play("retry", `${eventId}:feedback`, { delayMs: 160 });
      }
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
    session, loading, busy, error, playing, frame: playback.frame, fen: playback.fen || session?.fen, retrying, motion: playback.motion,
    disabled: !session || loading || busy || playing || retrying || !!error || session.status !== "active",
    answer: (from: string, to: string, promotion?: Promotion) => act(from + to + (promotion || "")),
    reveal: () => act(),
    retry: () => { audio.cancel(); setRetryReady(true); started.current = performance.now(); },
    reload: load,
    inspect: (selected: Frame) => { if (!busy) playback.inspect(selected); },
    inspectStart: () => { if (!busy) playback.inspectStart(session?.completion?.solution[0]); },
    replay: () => {
      if (!session?.completion || busy || playing) return;
      playback.play(session.completion.solution, true);
    },
  };
}
