import { useCallback, useEffect, useRef, useState } from "react";
import { api, post, type ColdPosition, type Feedback } from "../api";
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
  const [done, setDone] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const practiceBatch = useRef<{ exercise_id: string }[] | null>(null);
  const practiced = useRef(new Set<string>());
  const generation = useRef(0);

  const load = useCallback(
    async (id?: string | null, previous?: string | null) => {
      const version = ++generation.current;
      setLoading(true);
      setFeedback(null);
      setSubmittedMove(null);
      if (window.matchMedia("(max-width: 760px)").matches)
        window.scrollTo({ top: 0, behavior: "instant" });
      try {
        if (focusSkill && !practiceBatch.current) {
          const batch = await api<{ exercise_id: string }[]>(
            `/practice/queue?skill_id=${encodeURIComponent(focusSkill)}`,
          );
          if (version !== generation.current) return;
          practiceBatch.current = batch;
        }
        const queue = focusSkill
          ? (practiceBatch.current || []).filter(
              (item) => !practiced.current.has(item.exercise_id),
            )
          : await api<{ exercise_id: string }[]>(
              `/review/queue${previous ? `?last_id=${previous}` : ""}`,
            );
        if (version !== generation.current) return;
        setDue(queue.length);
        const next = id || queue[0]?.exercise_id;
        const result = next
          ? await post<ColdPosition>(
              `/review/${next}/start${focusSkill ? `?focus_skill_id=${encodeURIComponent(focusSkill)}` : ""}`,
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
  async function answer(from: string, to: string, promotion?: string) {
    if (!position || busy || feedback?.completed) return;
    const version = generation.current;
    setBusy(true);
    try {
      const result = await post<Feedback>(
        `/review/sessions/${position.session_id}/move`,
        {
          from_square: from,
          to_square: to,
          promotion: promotion || null,
        },
      );
      if (version !== generation.current) return;
      setFeedback(result);
      setSubmittedMove(from + to + (promotion || ""));
      if (result.completed) recordCompletion(position.exercise_id);
    } catch (e) {
      if (version === generation.current) fail(e);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  async function show() {
    if (!position || busy || feedback?.completed) return;
    const version = generation.current;
    setBusy(true);
    try {
      const result = await post<Feedback>(
        `/review/sessions/${position.session_id}/reveal`,
      );
      if (version !== generation.current) return;
      setFeedback(result);
      recordCompletion(position.exercise_id);
    } catch (e) {
      if (version === generation.current) fail(e);
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
    done,
    answer,
    show,
    next: () => load(null, last),
  };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;
