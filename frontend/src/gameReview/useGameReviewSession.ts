import { useCallback, useEffect, useRef, useState } from "react";
import { usePageTitle } from "../PageTitle";
import { errorMessage, api, read } from "../api";
import { usePolling } from "../usePolling";
import type { Game } from "./types";

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
  const receivedRevision = useRef<number | undefined>(undefined);
  const running =
    !!game?.job && ["queued", "running"].includes(game.job.status);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const data = await read(
      api.GET("/api/games/{game_id}", { params: { path: { game_id: id } } }),
    );
    if (mounted.current && version === loadVersion.current) {
      receivedPly.current = data.frames.reduce(
        (last, frame, index) => (frame.report ? index : last),
        0,
      );
      if (data.job && ["queued", "running"].includes(data.job.status))
        receivedPly.current = Math.min(receivedPly.current, data.job.completed);
      receivedRevision.current = data.review_revision;
      setGame(data);
    }
  }, [id]);

  useEffect(() => {
    mounted.current = true;
    void load().catch((e) => {
      if (mounted.current) setError(errorMessage(e));
    });
    return () => {
      mounted.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- bumping the live generation invalidates any load still in flight
      loadVersion.current++;
    };
  }, [load]);

  const start = useCallback(async () => {
    setBusy(true);
    setReviewStarting(true);
    setError("");
    try {
      const started = await read(
        api.POST("/api/games/{game_id}/review", {
          params: { path: { game_id: id } },
          body: { refine: false },
        }),
      );
      if (!mounted.current) return;
      // A review that is already complete and unchanged keeps its loaded frames and cache.
      if (started.status === "completed") return;
      setAnalysisEpoch((value) => value + 1);
      await load();
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
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
      await read(
        api.POST("/api/jobs/{job_id}/cancel", {
          params: { path: { job_id: game.job.id } },
        }),
      );
      if (mounted.current) await load();
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!game || openedReview.current) return;
    openedReview.current = true;
    // Someone else's shared game is read as it is; only its owner starts reviews.
    if (game.read_only) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- part of the one-time opening decision, which also starts requests
      setReviewStarting(false);
      return;
    }
    if (!game.job || ["failed", "cancelled", "completed"].includes(game.job.status))
      void start();
    else {
      setReviewStarting(false);
      // Opening a queued game moves its review to the front of the background queue.
      if (game.job.status === "queued")
        void api
          .POST("/api/games/{game_id}/review", {
            params: { path: { game_id: id } },
            body: { refine: false },
          })
          .catch(() => undefined);
    }
    // Only opening triggers auto-start. A pause/failure while open must stick.
  }, [game, id, start]);

  usePageTitle(game ? `${game.white} vs ${game.black}` : null);

  // Progress follows the shared polling rules: one pass at a time, paused in hidden tabs,
  // and backing off while the server is unreachable.
  usePolling(async (signal) => {
    const version = loadVersion.current;
    try {
      const progress = await read(
        api.GET("/api/games/{game_id}/review", {
          params: {
            path: { game_id: id },
            query: receivedRevision.current === undefined
              ? { after: receivedPly.current }
              : { after_revision: receivedRevision.current },
          },
          signal,
        }),
      );
      if (signal.aborted || version !== loadVersion.current) return;
      // Advance only over reports received, never a newer progress counter.
      for (const move of progress.moves)
        receivedPly.current = Math.max(receivedPly.current, move.ply);
      // The server cursor includes exactly the updates in this response, including earlier plies.
      if (progress.revision !== undefined) receivedRevision.current = progress.revision;
      const reports = new Map(
        progress.moves.map((move) => [move.ply, move.report]),
      );
      setGame((current) =>
        current
          ? {
              ...current,
              job: progress.job,
              accuracy: progress.accuracy,
              review_revision: progress.revision,
              context: progress.context ?? current.context,
              history: progress.history ?? current.history,
              frames: current.frames.map((frame, index) =>
                reports.has(index)
                  ? { ...frame, report: reports.get(index)! }
                  : frame,
              ),
            }
          : current,
      );
    } catch (e) {
      if (!signal.aborted) setError(errorMessage(e));
      throw e;
    }
  }, { intervalMs: 750, enabled: running });

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
