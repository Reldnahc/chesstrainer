import { useCallback, useEffect, useRef, useState } from "react";
import { api, read, type Promotion, type Schema } from "../api";
import { useAudioScope } from "../audio/AudioProvider";
import { studyRequestId } from "./requestId";
import { useStudyPlayback } from "./useStudyPlayback";
import { lessonRecording } from "../audio/speech/practiceSelection";
import { withSessionTake } from "../audio/speech/meaningPools";

export type LessonSession = Schema["LessonSessionView"];
export type LessonAction = Schema["LessonCommand"]["action"];
/** A fresh lesson command response and the one generic clip it may play. */
export type LessonSpeech = { eventId: string; recordingId: string | null };

const LESSON_MOVE_INTERVAL_MS = 1200;

export function useLessonSession(id: string) {
  const [session, setSession] = useState<LessonSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [speech, setSpeech] = useState<LessonSpeech | null>(null);
  const speechEvents = useRef(0);
  // How often each clip has played this session, so its takes take turns.
  const plays = useRef(new Map<string, number>());
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const audio = useAudioScope(`lesson:${id}`);
  const playback = useStudyPlayback(undefined, LESSON_MOVE_INTERVAL_MS, audio, session?.fen);
  const { reset } = playback;
  const load = useCallback(async () => {
    const version = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    locked.current = true;
    setLoading(true);
    setError("");
    setSpeech(null);
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
    const navigatingGame = !!session?.game && (action === "game_seek" || action === "close_game");
    if (!session || locked.current || (playback.playing && !navigatingGame) || error || !session.actions.includes(action)) return;
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
      const clip = lessonRecording({ action, before: session, after: result });
      const played = clip ? plays.current.get(clip) ?? 0 : 0;
      if (clip) plays.current.set(clip, played + 1);
      setSpeech({ eventId: `lesson:${++speechEvents.current}:${action}`, recordingId: withSessionTake(clip, id, played) });
      playback.play(result.playback);
      const eventId = `revision:${result.revision}`;
      if (!result.playback.length && (action === "move" || result.fen !== session.fen)) {
        // Rewinds and source-game jumps are navigation, not the move at the
        // destination. Incorrect lessons have no submitted SAN in the response.
        audio.play("move", `${eventId}:board`);
      }
      if (session.status !== "completed" && result.status === "completed" && action !== "show_move") {
        audio.play("complete", `${eventId}:feedback`, { delayMs: 160 });
      } else if (action === "move" && result.feedback?.kind === "correct") {
        audio.play("correct", `${eventId}:feedback`, { delayMs: 160 });
      } else if (action === "move" && result.feedback?.kind === "incorrect") {
        audio.play("retry", `${eventId}:feedback`, { delayMs: 160 });
      }
    } catch (e) {
      // A command may have committed despite a lost response. Reconcile first.
      if (generation.current === version) {
        setError((e as Error).message);
        setSpeech({ eventId: `lesson:${++speechEvents.current}:error`, recordingId: "lesson-error" });
      }
    } finally {
      if (generation.current === version) { locked.current = false; setBusy(false); }
    }
  }
  return {
    session, loading, busy, error, command, reload: load, playback, speech,
    disabled: busy || playback.playing || !!error,
    gameNavigationDisabled: busy || !!error,
    answer: (from: string, to: string, promotion?: Promotion) => command("move", { uci: from + to + (promotion || "") }),
  };
}
