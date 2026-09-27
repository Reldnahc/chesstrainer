import { useCallback, useEffect, useRef, useState } from "react";
import { api, post } from "../api";
import type { Game, ReviewProgress } from "./types";

/** Owns the original game and its persisted review job, never variation state. */
export function useGameReviewSession(id: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewStarting, setReviewStarting] = useState(true);
  const [error, setError] = useState("");
  const [analysisEpoch, setAnalysisEpoch] = useState(0);
  const mounted = useRef(false);
  const openedReview = useRef(false);
  const loadVersion = useRef(0);
  const receivedPly = useRef(0);
  const running =
    !!game?.job && ["queued", "running"].includes(game.job.status);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const data = await api<Game>(`/games/${encodeURIComponent(id)}`);
    if (mounted.current && version === loadVersion.current) {
      receivedPly.current = data.frames.reduce(
        (last, frame, index) => (frame.report ? index : last),
        0,
      );
      setGame(data);
    }
  }, [id]);

  useEffect(() => {
    mounted.current = true;
    void load().catch((e) => {
      if (mounted.current) setError(e.message);
    });
    return () => {
      mounted.current = false;
      loadVersion.current++;
    };
  }, [load]);

  const start = useCallback(async () => {
    setBusy(true);
    setReviewStarting(true);
    setError("");
    try {
      await post(`/games/${encodeURIComponent(id)}/review`, {});
      if (!mounted.current) return;
      setAnalysisEpoch((value) => value + 1);
      await load();
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        setReviewStarting(false);
      }
    }
  }, [id, load]);

  async function cancel() {
    if (!game?.job || busy) return;
    setBusy(true);
    try {
      await post(`/jobs/${game.job.id}/cancel`);
      if (mounted.current) await load();
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!game || openedReview.current) return;
    openedReview.current = true;
    if (!game.job || ["failed", "cancelled"].includes(game.job.status))
      void start();
    else setReviewStarting(false);
    // Only opening triggers auto-start. A pause/failure while open must stick.
  }, [game, start]);

  useEffect(() => {
    if (game) document.title = `${game.white} vs ${game.black} · Fieldwork`;
  }, [game?.white, game?.black]);

  useEffect(() => {
    if (!running) return;
    let active = true;
    let timer: number | undefined;
    const update = async () => {
      const version = loadVersion.current;
      try {
        const progress = await api<ReviewProgress>(
          `/games/${encodeURIComponent(id)}/review?after=${receivedPly.current}`,
        );
        if (!active || version !== loadVersion.current) return;
        // Advance only over reports received, never a newer progress counter.
        for (const move of progress.moves)
          receivedPly.current = Math.max(receivedPly.current, move.ply);
        const reports = new Map(
          progress.moves.map((move) => [move.ply, move.report]),
        );
        setGame((current) =>
          current
            ? {
                ...current,
                job: progress.job,
                accuracy: progress.accuracy,
                frames: current.frames.map((frame, index) =>
                  reports.has(index)
                    ? { ...frame, report: reports.get(index)! }
                    : frame,
                ),
              }
            : current,
        );
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) timer = window.setTimeout(update, 750);
      }
    };
    void update();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [id, running]);

  return {
    game,
    busy,
    reviewStarting,
    running,
    error,
    setError,
    dismissError: () => setError(""),
    start,
    cancel,
    analysisEpoch,
  };
}
