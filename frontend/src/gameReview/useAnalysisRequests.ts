import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "../api";

/**
 * The request core shared by game review and Play: analysis requests run one at
 * a time in the order asked, a key already known or in flight is never sent
 * twice, and a failure belongs to its own key until that key succeeds or is
 * retried. Everything known is dropped when `scope` changes, and requests still
 * queued for an earlier scope, or for an unmounted owner, are never sent.
 */
export function useAnalysisRequests<V>(scope: string) {
  const cache = useRef(new Map<string, V>());
  const requests = useRef(new Map<string, Promise<V | undefined>>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const mounted = useRef(false);
  const [revision, setRevision] = useState(0);
  const [failures, setFailures] = useState<ReadonlyMap<string, string>>(new Map());
  const changed = useCallback(() => setRevision((value) => value + 1), []);
  const clearFailure = useCallback((key: string) => setFailures((current) => {
    if (!current.has(key)) return current;
    const next = new Map(current);
    next.delete(key);
    return next;
  }), []);

  // Retires every queued request; keys still wanted are asked for again.
  const retire = useCallback(() => {
    generation.current++;
    requests.current.clear();
  }, []);

  useEffect(() => {
    mounted.current = true;
    retire();
    cache.current.clear();
    setFailures(new Map());
    changed();
    return () => {
      mounted.current = false;
      retire();
    };
  }, [scope, retire, changed]);

  const request = useCallback((key: string, load: () => Promise<V>): Promise<V | undefined> => {
    if (cache.current.has(key)) return Promise.resolve(cache.current.get(key));
    const pending = requests.current.get(key);
    if (pending) return pending;
    const version = generation.current;
    const current = () => mounted.current && version === generation.current;
    const work: Promise<V | undefined> = queue.current.then(async () => {
      if (!current()) return undefined;
      try {
        const value = await load();
        if (!current()) return undefined;
        cache.current.set(key, value);
        clearFailure(key);
        changed();
        return value;
      } catch (e) {
        if (current()) setFailures((failed) => new Map(failed).set(key, errorMessage(e)));
        return undefined;
      }
    }).finally(() => {
      if (requests.current.get(key) === work) requests.current.delete(key);
    });
    requests.current.set(key, work);
    queue.current = work;
    return work;
  }, [changed, clearFailure]);

  /** Resolves once every request asked for so far has finished. */
  const settled = useCallback(() => queue.current.then(() => undefined, () => undefined), []);
  const get = useCallback((key: string) => cache.current.get(key), []);
  const has = useCallback((key: string) => cache.current.has(key), []);
  /** Results the page already holds (a saved report) are known without a request. */
  const seed = useCallback((entries: Iterable<readonly [string, V]>) => {
    let added = false;
    for (const [key, value] of entries) {
      if (cache.current.has(key)) continue;
      cache.current.set(key, value);
      // A result that arrives another way settles a request for that key that failed.
      clearFailure(key);
      added = true;
    }
    if (added) changed();
  }, [changed, clearFailure]);
  /** Forgets results whose key no longer applies, retiring queued requests. */
  const discard = useCallback((keep: (key: string) => boolean) => {
    retire();
    for (const key of [...cache.current.keys()]) if (!keep(key)) cache.current.delete(key);
    setFailures((current) => new Map([...current].filter(([key]) => keep(key))));
    changed();
  }, [retire, changed]);

  // Every function but `failure` keeps its identity, so effects can depend on them;
  // `revision` changes whenever a result is added or dropped.
  return useMemo(() => ({
    request, settled, get, has, seed, discard, clearFailure, revision,
    failure: (key: string) => failures.get(key) ?? null,
  }), [request, settled, get, has, seed, discard, clearFailure, revision, failures]);
}
