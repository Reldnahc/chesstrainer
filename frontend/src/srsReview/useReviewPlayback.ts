import { useCallback, useEffect, useRef, useState } from "react";
import type { ExplanationFrame, Feedback } from "../api";
import { COUNTER_REPLY_DELAY_MS } from "../reviewMotion";

/** Presentation-only playback: never submits a move or records another recall. */
export function useReviewPlayback(feedback: Feedback | null) {
  const [explaining, setExplaining] = useState(false);
  const [mistakeCue, setMistakeCue] = useState(false);
  const [explanationFrame, setExplanationFrame] =
    useState<ExplanationFrame | null>(null);
  const [explanationMinHeight, setExplanationMinHeight] = useState(0);
  const [preview, setPreview] = useState<"attempt" | "reply" | null>(null);
  const explanationOpener = useRef<HTMLButtonElement | null>(null);
  const practicePanel = useRef<HTMLDivElement | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);
  const focusFrame = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(previewTimer.current);
    setMistakeCue(!!feedback && !feedback.completed);
    if (!feedback) {
      setExplaining(false);
      setExplanationFrame(null);
    }
    if (feedback?.counter_reply && !feedback.completed) {
      setPreview("attempt");
      previewTimer.current = window.setTimeout(
        () => setPreview("reply"),
        COUNTER_REPLY_DELAY_MS,
      );
    } else setPreview(null);
    return () => window.clearTimeout(previewTimer.current);
  }, [feedback]);
  useEffect(
    () => () => {
      if (focusFrame.current) window.cancelAnimationFrame(focusFrame.current);
    },
    [],
  );

  function openExplanation() {
    window.clearTimeout(previewTimer.current);
    // Retain height so opening playback on a scrolled phone doesn't jump upward.
    setExplanationMinHeight(
      practicePanel.current?.getBoundingClientRect().height || 0,
    );
    setExplaining(true);
  }
  const closeExplanation = useCallback(() => {
    setExplaining(false);
    setExplanationFrame(null);
    setMistakeCue(false);
    if (!feedback?.completed) {
      window.clearTimeout(previewTimer.current);
      setPreview(null);
    }
    focusFrame.current = window.requestAnimationFrame(() =>
      explanationOpener.current?.focus({ preventScroll: true }),
    );
  }, [feedback?.completed]);
  function retry() {
    setMistakeCue(false);
    window.clearTimeout(previewTimer.current);
    setPreview(null);
  }

  return {
    explaining,
    mistakeCue,
    explanationFrame,
    setExplanationFrame,
    explanationMinHeight,
    preview,
    explanationOpener,
    practicePanel,
    openExplanation,
    closeExplanation,
    retry,
    beginAttempt: () => setMistakeCue(false),
    previewFrame:
      preview === "attempt"
        ? feedback?.attempt_frame
        : preview === "reply"
          ? feedback?.counter_reply
          : undefined,
  };
}

export type ReviewPlayback = ReturnType<typeof useReviewPlayback>;
