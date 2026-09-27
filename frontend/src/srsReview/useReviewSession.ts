import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  read,
  type ColdPosition,
  type Feedback,
  type Promotion,
  type Schema,
} from "../api";
import { clearExerciseLink } from "../navigation";

/** Owns grading and queues. Focused practice never changes the SRS queue policy. */
export function useReviewSession({
  requested,
  focusSkill,
  fail,
}: {
  requested: string | null;
  focusSkill: string | null;
  fail: (e: unknown) => void;
}) {
  const [position, setPosition] = useState<ColdPosition | null>(null);
  const [due, setDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submittedMove, setSubmittedMove] = useState<string | null>(null);
  const [hadFailure, setHadFailure] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const practiceBatch = useRef<Schema["PracticeQueueItem"][] | null>(null);
  const practiced = useRef(new Set<string>());
  const generation = useRef(0);

  const load = useCallback(
    async (id?: string | null, previous?: string | null) => {
      const version = ++generation.current;
      setLoading(true);
      setFeedback(null);
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
          : await read(
              api.GET("/api/review/queue", {
                params: { query: { last_id: previous || undefined } },
              }),
            );
        if (version !== generation.current) return;
        setDue(queue.length);
        const next = id || queue[0]?.exercise_id;
        const result = next
          ? await read(
              api.POST("/api/review/{exercise_id}/start", {
                params: {
                  path: { exercise_id: next },
                  query: { focus_skill_id: focusSkill || undefined },
                },
              }),
            )
          : null;
        if (version === generation.current) setPosition(result);
      } catch (e) {
        if (version === generation.current) fail(e);
      } finally {
        if (version === generation.current) setLoading(false);
      }
    },
    [focusSkill, fail],
  );

  useEffect(() => {
    practiceBatch.current = null;
    practiced.current.clear();
    void load(requested);
    return () => {
      generation.current++;
    };
  }, [load, requested]);

  function recordCompletion(exerciseId: string) {
    practiced.current.add(exerciseId);
    clearExerciseLink();
    setDone((value) => value + 1);
    setLast(exerciseId);
  }
  async function answer(from: string, to: string, promotion?: Promotion) {
    if (!position || busy || feedback?.completed) return;
    const version = generation.current;
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
      setFeedback(result);
      if (!result.completed) setHadFailure(true);
      setSubmittedMove(from + to + (promotion || ""));
      if (result.completed) recordCompletion(position.exercise_id);
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
    setBusy(true);
    setGradingError(null);
    try {
      const result = await read(
        api.POST("/api/review/sessions/{session_id}/reveal", {
          params: { path: { session_id: position.session_id } },
        }),
      );
      if (version !== generation.current) return;
      setFeedback(result);
      recordCompletion(position.exercise_id);
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
    submittedMove,
    hadFailure,
    gradingError,
    done,
    answer,
    show,
    next: () => load(null, last),
  };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;
