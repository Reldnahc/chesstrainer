import { useCallback, useEffect, useState } from "react";
import { api, read } from "../api";
import type { Analysis } from "./types";
import { useAnalysisRequests } from "./useAnalysisRequests";

const cacheKey = (root: number, path: string[], rating: number) =>
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
  rating: number;
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
        read(api.POST("/api/games/{game_id}/analyze", { params: { path: { game_id: id } }, body: { ply, moves } }))),
    [send, id, rating],
  );

  useEffect(() => {
    if (!browse) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      await settled();
      if (active) void request(root, path);
    }, 350);
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
      setRetryCount((value) => value + 1);
    },
  };
}
