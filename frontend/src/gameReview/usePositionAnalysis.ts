import { useCallback, useEffect, useRef, useState } from "react";
import { api, read } from "../api";
import type { Analysis } from "./types";

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
  const cache = useRef(new Map<string, Analysis>());
  const requests = useRef(new Map<string, Promise<Analysis | undefined>>());
  const inFlight = useRef<Promise<Analysis | undefined> | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const [, setRevision] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    mounted.current = true;
    generation.current++;
    cache.current.clear();
    requests.current.clear();
    setFailure(null);
    setRevision((value) => value + 1);
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, [id, rating, epoch]);

  const request = useCallback(
    (ply: number, moves: string[]) => {
      const key = cacheKey(ply, moves, rating);
      if (cache.current.has(key)) return Promise.resolve(cache.current.get(key));
      const pending = requests.current.get(key);
      if (pending) return pending;
      const version = generation.current;
      const current = () => mounted.current && version === generation.current;
      const work = (inFlight.current || Promise.resolve())
        .then(async () => {
          if (!current()) return;
          try {
            const value = await read(
              api.POST("/api/games/{game_id}/analyze", {
                params: { path: { game_id: id } },
                body: { ply, moves },
              }),
            );
            if (!current()) return;
            cache.current.set(key, value);
            setRevision((value) => value + 1);
            setFailure((previous) => (previous?.key === key ? null : previous));
            return value;
          } catch (e) {
            if (current()) setFailure({ key, message: (e as Error).message });
          }
        })
        .finally(() => {
          if (requests.current.get(key) === work) requests.current.delete(key);
        });
      requests.current.set(key, work);
      inFlight.current = work;
      return work;
    },
    [id, rating],
  );

  useEffect(() => {
    if (!browse) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      if (inFlight.current) await inFlight.current;
      if (active) void request(root, path);
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // positionKey identifies root and the complete path, including repetitions.
  }, [request, positionKey, browse, retryCount, epoch]);

  return {
    request,
    get: (ply: number, moves: string[]) =>
      cache.current.get(cacheKey(ply, moves, rating)),
    error:
      failure?.key === cacheKey(root, path, rating) ? failure.message : null,
    retry: () => {
      setFailure(null);
      setRetryCount((value) => value + 1);
    },
  };
}
