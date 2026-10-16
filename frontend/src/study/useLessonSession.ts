import { useRef, useState } from "react";
import { api, read, type Promotion, type Schema } from "../api";
import { useAudioScope } from "../audio/AudioProvider";
import { FEEDBACK_CUE_DELAY_MS } from "../audio/model";
import { studyRequestId } from "./requestId";
import { useStudyPlayback } from "./useStudyPlayback";
import { useStudySession } from "./useStudySession";
import { lessonRecording } from "../audio/speech/practiceSelection";
import { withSessionTake } from "../audio/speech/meaningPools";

export type LessonSession = Schema["LessonSessionView"];
export type LessonAction = Schema["LessonCommand"]["action"];
/** A fresh lesson command response and the one generic clip it may play. */
export type LessonSpeech = { eventId: string; recordingId: string | null };

const LESSON_MOVE_INTERVAL_MS = 1200;

export function useLessonSession(id: string) {
  const [speech, setSpeech] = useState<LessonSpeech | null>(null);
  // A demonstration goes straight on to the next step; its own step stays on
  // screen while its moves play.
  const [playingStep, setPlayingStep] = useState<LessonSession["step"] | null>(null);
  const speechEvents = useRef(0);
  // How often each clip has played this session, so its takes take turns.
  const plays = useRef(new Map<string, number>());
  const audio = useAudioScope(`lesson:${id}`);
  const study = useStudySession<LessonSession>(id, (signal) => read(api.GET("/api/study/lesson-sessions/{session_id}", {
    params: { path: { session_id: id } }, signal,
  })), {
    starting: (kind) => {
      if (kind === "load") setSpeech(null);
      reset();
    },
  });
  const { session, loading, busy, error, run } = study;
  const playback = useStudyPlayback(undefined, LESSON_MOVE_INTERVAL_MS, audio, session?.fen);
  const { reset } = playback;
  async function command(action: LessonAction, extra?: { uci?: string; ply?: number }) {
    const navigatingGame = !!session?.game && (action === "game_seek" || action === "close_game");
    if (!session || (playback.playing && !navigatingGame) || error || !session.actions.includes(action)) return;
    await run((signal) => read(api.POST("/api/study/lesson-sessions/{session_id}/command", {
      params: { path: { session_id: id } }, signal,
      body: { action, ...extra, revision: session.revision, request_id: studyRequestId() },
    })), (result) => {
      setPlayingStep(action === "continue" && session.step.kind === "demonstration" && result.step.id !== session.step.id
        && result.playback.length ? session.step : null);
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
        audio.play("complete", `${eventId}:feedback`, { delayMs: FEEDBACK_CUE_DELAY_MS });
      } else if (action === "move" && result.feedback?.kind === "correct") {
        audio.play("correct", `${eventId}:feedback`, { delayMs: FEEDBACK_CUE_DELAY_MS });
      } else if (action === "move" && result.feedback?.kind === "incorrect") {
        audio.play("retry", `${eventId}:feedback`, { delayMs: FEEDBACK_CUE_DELAY_MS });
      }
    // A command may have committed despite a lost response; reload reconciles it.
    }, () => setSpeech({ eventId: `lesson:${++speechEvents.current}:error`, recordingId: "lesson-error" }));
  }
  return {
    session, loading, busy, error, command, reload: study.reload, playback, speech,
    playingStep: playback.playing ? playingStep : null,
    disabled: busy || playback.playing || !!error,
    gameNavigationDisabled: busy || !!error,
    answer: (from: string, to: string, promotion?: Promotion) => command("move", { uci: from + to + (promotion || "") }),
  };
}
