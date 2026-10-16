import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { api, read } from "../api";
import type { Analysis } from "./types";
import { useAnalysisRequests } from "./useAnalysisRequests";

const cacheKey = (root: number, path: string[], rating: number | undefined) =>
  `${root}:${path.join(",")}@${rating}`;

/** Serializes played moves; only browsing is debounced. Cache keys include history. */
export function usePositionAnalysis({
  id,
  rating,
  epoch,
  root,
  path,
  positionKey,
  browse,
}: {
  id: string;
  /** The game's rating, unknown until the game loads; nothing is requested before then. */
  rating: number | undefined;
  epoch: number;
  root: number;
  path: string[];
  positionKey: string;
  browse: boolean;
}) {
  const requests = useAnalysisRequests<Analysis>(`${id}@${rating}#${epoch}`);
  const [retryCount, setRetryCount] = useState(0);
  const { request: send, settled } = requests;
  const request = useCallback(
    (ply: number, moves: string[]) =>
      send(cacheKey(ply, moves, rating), () =>
        read(
          api.POST("/api/games/{game_id}/analyze", {
            params: { path: { game_id: id } },
            body: { ply, moves },
          }),
        ),
      ),
    [send, id, rating],
  );

  // Read when the effect runs, so the debounced request keeps the position it was for.
  const position = useEffectEvent(() => ({ root, path }));
  useEffect(() => {
    if (!browse) return;
    let active = true;
    const { root, path } = position();
    // settled() never rejects; the request reports its own failure.
    const timer = window.setTimeout(
      () =>
        void settled().then(() => {
          if (active) void request(root, path);
        }),
      350,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // positionKey identifies root and the complete path, including repetitions.
  }, [request, settled, positionKey, browse, retryCount, epoch]);

  const current = cacheKey(root, path, rating);
  return {
    request,
    get: (ply: number, moves: string[]) => requests.get(cacheKey(ply, moves, rating)),
    error: requests.failure(current),
    retry: () => {
      requests.clearFailure(current);
      setRetryCount(value => value + 1);
    },
  };
}
