import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  read,
  type ColdPosition,
  type Feedback,
  type Promotion,
  type Schema,
} from "../api";
import { clearExerciseLink, clearReviewSessionLink, rememberReviewSession } from "../navigation";
import { useAudioScope } from "../audio/AudioProvider";

/** Owns grading and queues. Focused practice never changes the SRS queue policy. */
export function useReviewSession({
  requested,
  requestedSession,
  focusSkill,
  fail,
}: {
  requested: string | null;
  requestedSession?: string | null;
  focusSkill: string | null;
  fail: (e: unknown) => void;
}) {
  const [position, setPosition] = useState<ColdPosition | null>(null);
  const [due, setDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackEventId, setFeedbackEventId] = useState<string | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [submittedMove, setSubmittedMove] = useState<string | null>(null);
  const [hadFailure, setHadFailure] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const practiceBatch = useRef<Schema["PracticeQueueItem"][] | null>(null);
  const practiced = useRef(new Set<string>());
  // The cold opener speaks once per review session, so a long queue does not
  // repeat the same ready line on every card; retried cards always speak.
  const coldOpened = useRef(false);
  const openFor = useRef<string | null>(null);
  const generation = useRef(0);
  const responseSequence = useRef(0);
  const audio = useAudioScope(`review:${requestedSession || requested || focusSkill || "queue"}`);
  const sound = useRef(audio);
  sound.current = audio;

  const refreshDue = useCallback(async (version: number) => {
    try {
      const count = await read(api.GET("/api/review/count"));
      if (version === generation.current) setDue(count.due);
    } catch {
      if (version === generation.current)
        fail(new Error("Could not refresh the due count. Your saved work is unchanged."));
    }
  }, [fail]);

  const load = useCallback(
    async (id?: string | null, previous?: string | null, resumeSession?: string | null) => {
      const version = ++generation.current;
      sound.current.cancel();
      setLoading(true);
      setBusy(false);
      setPosition(null);
      setFeedback(null);
      setFeedbackEventId(null);
      setOpenEventId(null);
      openFor.current = null;
      setSubmittedMove(null);
      setHadFailure(false);
      setGradingError(null);
      if (window.matchMedia("(max-width: 760px)").matches)
        window.scrollTo({ top: 0, behavior: "instant" });
      try {
        if (focusSkill && !practiceBatch.current) {
          const batch = await read(
            api.GET("/api/practice/queue", {
              params: { query: { skill_id: focusSkill } },
            }),
          );
          if (version !== generation.current) return;
          practiceBatch.current = batch;
        }
        const queue = focusSkill
          ? (practiceBatch.current || []).filter(
              (item) => !practiced.current.has(item.exercise_id),
            )
          : await read(api.GET("/api/review/queue", {
                params: { query: { last_id: previous || undefined } },
              }));
        if (version !== generation.current) return;
        if (focusSkill) setDue(queue.length);
        const next = id || queue[0]?.exercise_id;
        const result = resumeSession
          ? await read(api.GET("/api/review/sessions/{session_id}", {
              params: { path: { session_id: resumeSession } },
            }))
          : next
          ? await read(
              api.POST("/api/review/{exercise_id}/start", {
                params: {
                  path: { exercise_id: next },
                  query: { focus_skill_id: focusSkill || undefined },
                },
              }),
            )
          : null;
        if (version === generation.current) {
          setPosition(result);
          if (result?.opening) {
            // Pin the attempt, not only the exercise. Another tab can change
            // its study answers while this learner still needs saved feedback.
            rememberReviewSession(result.session_id);
            setFeedback(result.feedback ?? null);
            setHadFailure(result.failed);
          }
          // Restored attempts and cards with saved feedback stay Listen-only.
          if (result && !resumeSession && !result.feedback && (result.failed || !coldOpened.current)) {
            coldOpened.current = true;
            openFor.current = result.session_id;
          }
          if (!focusSkill) await refreshDue(version);
        }
      } catch (e) {
        if (version === generation.current) fail(e);
      } finally {
        if (version === generation.current) setLoading(false);
      }
    },
    [focusSkill, fail, refreshDue],
  );

  // Announce the opener only after the card has rendered, so the speech
  // hook sees a fresh event rather than state it hydrated with.
  useEffect(() => {
    if (!loading && position && openFor.current === position.session_id) {
      openFor.current = null;
      setOpenEventId(`open:${position.session_id}`);
    }
  }, [position, loading]);

  useEffect(() => {
    practiceBatch.current = null;
    practiced.current.clear();
    coldOpened.current = false;
    void load(requested, null, requestedSession);
    return () => {
      generation.current++;
    };
  }, [load, requested, requestedSession]);

  function recordCompletion(exerciseId: string, countsAsReview: boolean) {
    practiced.current.add(exerciseId);
    if (!position?.opening) clearExerciseLink();
    if (countsAsReview) setDone((value) => value + 1);
    if (focusSkill) setDue(value => Math.max(0, value - 1));
    setLast(exerciseId);
  }
  async function answer(from: string, to: string, promotion?: Promotion) {
    if (!position || busy || feedback?.completed) return;
    const version = generation.current;
    audio.cancel();
    setBusy(true);
    setGradingError(null);
    try {
      const result = await read(
        api.POST("/api/review/sessions/{session_id}/move", {
          params: { path: { session_id: position.session_id } },
          body: {
            from_square: from,
            to_square: to,
            promotion: promotion || null,
          },
        }),
      );
      if (version !== generation.current) return;
      const eventId = result.attempt_id || `response:${++responseSequence.current}`;
      const san = result.submitted_san || result.attempt_frame?.san;
      if (san) audio.move(san, `${eventId}:board`);
      else audio.play("move", `${eventId}:board`);
      if (result.grade !== "revealed") {
        audio.play(result.completed ? "correct" : "retry", `${eventId}:feedback`, { delayMs: 160 });
      }
      setFeedback(result);
      setFeedbackEventId(eventId);
      if (!result.completed) setHadFailure(true);
      setSubmittedMove(from + to + (promotion || ""));
      if (result.completed) recordCompletion(position.exercise_id, !result.non_scheduling_reason);
      // The exact count includes positions outside the bounded queue batch and
      // may change in another tab. Never infer it from this session's outcome.
      if (!focusSkill) await refreshDue(version);
    } catch (e) {
      if (version === generation.current) {
        setGradingError((e as Error).message);
        fail(e);
      }
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  async function show() {
    if (!position || busy || feedback?.completed) return;
    const version = generation.current;
    audio.cancel();
    setBusy(true);
    setGradingError(null);
    try {
      const result = await read(
        api.POST("/api/review/sessions/{session_id}/reveal", {
          params: { path: { session_id: position.session_id } },
        }),
      );
      if (version !== generation.current) return;
      const eventId = `reveal:${++responseSequence.current}`;
      const san = result.reveal_frame?.san || result.submitted_san;
      if (san) audio.move(san, `${eventId}:board`);
      else audio.play("move", `${eventId}:board`);
      setFeedback(result);
      setFeedbackEventId(eventId);
      recordCompletion(position.exercise_id, !result.non_scheduling_reason);
      if (!focusSkill) await refreshDue(version);
    } catch (e) {
      if (version === generation.current) {
        setGradingError((e as Error).message);
        fail(e);
      }
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return {
    position,
    due,
    loading,
    busy,
    feedback,
    feedbackEventId,
    openEventId,
    audio,
    submittedMove,
    hadFailure,
    gradingError,
    done,
    answer,
    show,
    next: () => {
      clearReviewSessionLink();
      return load(null, last);
    },
  };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;
