import { useRef, useState } from "react";
import { api, read, type Promotion, type Schema } from "../api";
import { useAudioScope } from "../audio/AudioProvider";
import { FEEDBACK_CUE_DELAY_MS } from "../audio/model";
import { studyRequestId } from "./requestId";
import { useStudyPlayback } from "./useStudyPlayback";
import { useStudySession } from "./useStudySession";

export type PuzzleSession = Schema["PuzzleSessionView"];
type Frame = PuzzleSession["playback"][number];

/** The server commits the entire turn. Playback never advances the session. */
export function usePuzzleSession(id: string) {
  const [retryReady, setRetryReady] = useState(false);
  const [feedbackEventId, setFeedbackEventId] = useState<string | null>(null);
  // Set when the puzzle loads, before any move can be timed.
  const started = useRef(0);
  const audio = useAudioScope(`puzzle:${id}`);
  const study = useStudySession<PuzzleSession>(id, (signal) => read(api.GET("/api/puzzle-sessions/{session_id}", {
    params: { path: { session_id: id } }, signal,
  })), {
    starting: () => {
      setFeedbackEventId(null);
      reset();
    },
    loaded: (result) => {
      setRetryReady(false);
      // Opening an untouched puzzle is a fresh narration event; a puzzle
      // restored after moves, feedback or a retry stays silent.
      if (result.status === "active" && !result.failed && !result.feedback && !result.history.length)
        setFeedbackEventId(`open:${id}:${result.revision}`);
      started.current = performance.now();
    },
  });
  const { session, loading, busy, error, run } = study;
  const playback = useStudyPlayback(() => { started.current = performance.now(); }, undefined, audio, session?.fen);
  const { reset, playing } = playback;

  async function act(uci?: string) {
    if (!session || playing || error || session.status !== "active") return;
    const request = { request_id: studyRequestId(), revision: session.revision };
    // A lost response may already be committed, or another tab may have moved:
    // the error blocks another write until reload reconciles the server revision.
    await run((signal) => uci
      ? read(api.POST("/api/puzzle-sessions/{session_id}/move", {
          params: { path: { session_id: id } },
          body: { ...request, uci, elapsed_ms: Math.min(86_400_000, Math.max(0, Math.round(performance.now() - started.current))) },
          signal,
        }))
      : read(api.POST("/api/puzzle-sessions/{session_id}/reveal", {
          params: { path: { session_id: id } }, body: request, signal,
        })), (result) => {
      setFeedbackEventId(`response:${request.request_id}`);
      setRetryReady(false);
      playback.play(result.playback);
      const eventId = `revision:${result.revision}`;
      if (uci && !result.playback.length) {
        audio.moveOr(result.feedback?.submitted_san, `${eventId}:board`);
      }
      if (uci && result.status === "solved") {
        audio.play("complete", `${eventId}:feedback`, { delayMs: FEEDBACK_CUE_DELAY_MS });
      } else if (uci && result.feedback?.grade === "correct") {
        audio.play("correct", `${eventId}:feedback`, { delayMs: FEEDBACK_CUE_DELAY_MS });
      } else if (uci && result.feedback?.grade === "incorrect") {
        audio.play("retry", `${eventId}:feedback`, { delayMs: FEEDBACK_CUE_DELAY_MS });
      }
      started.current = performance.now();
    });
  }
  const retrying = session?.feedback?.grade === "incorrect" && !retryReady;
  return {
    session, loading, busy, error, playing, feedbackEventId, frame: playback.frame, fen: playback.fen || session?.fen, retrying, motion: playback.motion,
    disabled: !session || loading || busy || playing || retrying || !!error || session.status !== "active",
    answer: (from: string, to: string, promotion?: Promotion) => act(from + to + (promotion || "")),
    reveal: () => act(),
    retry: () => { audio.cancel(); setFeedbackEventId(null); setRetryReady(true); started.current = performance.now(); },
    reload: study.reload,
    inspect: (selected: Frame) => { if (!busy) { setFeedbackEventId(null); playback.inspect(selected); } },
    inspectStart: () => { if (!busy) { setFeedbackEventId(null); playback.inspectStart(session?.completion?.solution[0]); } },
    replay: () => {
      if (!session?.completion || busy || playing) return;
      setFeedbackEventId(null);
      playback.play(session.completion.solution, true);
    },
  };
}
