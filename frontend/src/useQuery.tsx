import { useCallback, useEffect, useEffectEvent, useRef, useState, type DependencyList, type ReactNode } from "react";
import { errorMessage } from "./api";
import Button from "./Button";
import { LoadingState, UnavailableState } from "./LoadState";

export type Query<T> = {
  /** The last loaded value; kept while a retry or a dependency change reloads. */
  data: T | undefined;
  /** Why the latest load failed, or null. */
  error: string | null;
  pending: boolean;
  /** Loads again. */
  retry: () => void;
  /** Replaces the loaded value after a command changed it on the server. */
  setData: (update: T | ((current: T | undefined) => T)) => void;
};

/**
 * One request's lifecycle: it loads when the screen mounts and whenever `deps`
 * change, aborts when the screen leaves or a newer load starts, and only the
 * latest load may change the result. Each screen keeps its own request; only
 * the lifecycle is shared (as useSavedPreferences does for preferences).
 */
export function useQuery<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList = []): Query<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const run = useEffectEvent(load);
  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    setError(null);
    run(controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setData(() => value);
        setPending(false);
      },
      (e) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(e));
        setPending(false);
      },
    );
    return () => controller.abort();
    // The caller's deps decide when the request is a different one.
  }, [attempt, ...deps]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, error, pending, retry, setData: setData as Query<T>["setData"] };
}

/**
 * A query's content: loading while nothing has arrived, unavailable with "Try
 * again" when the load failed, and the children only once the data is here, so a
 * failed or pending load never reads as an empty one.
 */
export function QueryResult<T>({ query, label, presentation, heading, children }: {
  query: Query<T>;
  /** What is loading, in the reader's words ("your games"). */
  label: string;
  presentation?: "compact" | "panel";
  heading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.error)
    return <UnavailableState presentation={presentation} heading={heading}
      actions={<Button variant="secondary" onClick={query.retry}>Try again</Button>}>
      Couldn’t load {label}.
    </UnavailableState>;
  if (query.data === undefined) return <LoadingState presentation={presentation} heading={heading}>Loading {label}…</LoadingState>;
  return children(query.data);
}

/**
 * One command at a time: `busy` names the command running (a row's id, or true),
 * `error` holds its failure for the page's banner, and a command still running
 * when the screen leaves is aborted and changes nothing. `then` runs only when
 * the command finished for a screen that is still there (to navigate or store).
 */
export function useCommand<K = true>() {
  const [busy, setBusy] = useState<K | null>(null);
  const [error, setError] = useState("");
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);
  const run = useCallback(async <T,>(key: K, action: (signal: AbortSignal) => Promise<T>,
    then?: (result: T) => void): Promise<T | undefined> => {
    if (running.current) return undefined;
    const controller = new AbortController();
    running.current = controller;
    setBusy(() => key);
    setError("");
    try {
      const result = await action(controller.signal);
      if (!controller.signal.aborted) then?.(result);
      return controller.signal.aborted ? undefined : result;
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
      return undefined;
    } finally {
      if (!controller.signal.aborted) {
        running.current = null;
        setBusy(null);
      }
    }
  }, []);
  return { busy, error, setError, run, dismiss: useCallback(() => setError(""), []) };
}
