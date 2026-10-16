import { useCallback, useEffect, useEffectEvent, useRef, useState, type DependencyList, type ReactNode } from "react";
import { errorMessage } from "./api";
import Banner from "./Banner";
import Button from "./Button";
import { LoadingState, UnavailableState } from "./LoadState";
import Reveal from "./Reveal";
import { usePolling, type PollingOptions } from "./usePolling";

export type Query<T> = {
  /** The last loaded value; kept while a retry or a dependency change reloads. */
  data: T | undefined;
  /** Why the latest load failed, or null. */
  error: string | null;
  pending: boolean;
  /** Loads again. */
  retry: () => void;
  /** Clears a failed refresh's message; the loaded value stays. */
  dismiss: () => void;
  /** Replaces the loaded value after a command changed it on the server. */
  setData: (update: T | ((current: T | undefined) => T)) => void;
};

/**
 * One request's lifecycle: it loads when the screen mounts and whenever `deps`
 * change, aborts when the screen leaves or a newer load starts, and only the
 * latest load may change the result. Each screen keeps its own request; only
 * the lifecycle is shared (as useSavedPreferences does for preferences).
 * `enabled: false` holds a request the screen does not need yet (a tab not opened).
 */
export function useQuery<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList = [],
  { enabled = true }: { enabled?: boolean } = {}): Query<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const run = useEffectEvent(load);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a load starts here; the query is pending until it answers
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the hook's API takes the caller's dependency list, and load is read through an effect event
  }, [attempt, enabled, ...deps]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const dismiss = useCallback(() => setError(null), []);
  return { data, error, pending, retry, dismiss, setData: setData as Query<T>["setData"] };
}

/**
 * A request that repeats on a schedule (usePolling), in the same shape as
 * useQuery so QueryResult renders it: pending until its first answer, then the
 * latest value. Repeat reads are silent; a failed one sets `error` (the refresh
 * banner), and once that message is dismissed further failures stay quiet until
 * a read succeeds again. `refresh()` asks for a fresh read after any in flight.
 */
export function usePolledQuery<T>(load: (signal: AbortSignal) => Promise<T>,
  options: PollingOptions): Query<T> & { refresh: () => Promise<void> } {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const quiet = useRef(false);
  const polling = usePolling(async (signal) => {
    try {
      const value = await load(signal);
      if (signal.aborted) return;
      quiet.current = false;
      setData(() => value);
      setError(null);
    } catch (e) {
      if (signal.aborted) throw e;
      if (!quiet.current) setError(errorMessage(e));
      throw e;
    } finally {
      if (!signal.aborted) setPending(false);
    }
  }, options);
  const refresh = polling.run;
  // Try again after a failed first read shows the loader again; a refresh banner's
  // Try again keeps the loaded content in place while it reads.
  const retry = useCallback(() => {
    quiet.current = false;
    setError(null);
    setPending(value => value || data === undefined);
    void refresh();
  }, [refresh, data]);
  const dismiss = useCallback(() => {
    quiet.current = true;
    setError(null);
  }, []);
  return { data, error, pending, retry, dismiss, refresh, setData: setData as Query<T>["setData"] };
}

/**
 * A query's content: loading while nothing has arrived, unavailable with "Try
 * again" when the first load failed, and the children only once the data is here,
 * so a failed or pending load never reads as an empty one.
 */
export function QueryResult<T>({ query, label, presentation, heading, children }: {
  query: Query<T>;
  /** What is loading, in the reader's words ("your games"). */
  label: string;
  presentation?: "compact" | "panel";
  heading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const retry = <Button variant="secondary" onClick={query.retry}>Try again</Button>;
  if (query.data === undefined)
    return query.error
      ? <UnavailableState presentation={presentation} heading={heading} actions={retry}>Couldn’t load {label}.</UnavailableState>
      : <LoadingState presentation={presentation} heading={heading}>Loading {label}…</LoadingState>;
  // A refresh that fails keeps what already loaded and says so.
  return <>
    <QueryError query={query} label={label} />
    {children(query.data)}
  </>;
}

/**
 * A request's failure as the page's error banner, for a screen that shows its
 * other content anyway (a refresh behind loaded data, or a side request such as
 * Play's measured level): "Couldn’t load {label}." or, once something loaded,
 * "Couldn’t refresh {label}.", with Try again.
 */
export function QueryError<T>({ query, label }: { query: Query<T>; label: string }) {
  if (!query.error) return null;
  return <Banner tone="error" action={<Button size="compact" variant="secondary" onClick={query.retry}>Try again</Button>} onDismiss={query.dismiss}>
    {query.data === undefined ? "Couldn’t load" : "Couldn’t refresh"} {label}.
  </Banner>;
}

/**
 * The loading line for a request whose filters or page changed while its last
 * result stays on screen: it shows the shared compact LoadingState only during
 * that reload. Give the kept content `className="reloadable"` and
 * `data-reloading={reloading(query)}` so it dims until the new result arrives.
 */
export function QueryReloading<T>({ query, label, className }: {
  query: Query<T>;
  /** What is loading, in the reader's words, as for QueryResult. */
  label: string;
  className?: string;
}) {
  return <Reveal className={className}>{reloading(query) && <LoadingState>Loading {label}…</LoadingState>}</Reveal>;
}

/** True while a query that already has a result loads a new one. */
export function reloading<T>(query: Query<T>): true | undefined {
  return query.pending && query.data !== undefined ? true : undefined;
}

/**
 * One command at a time: `busy` names the command running (a row's id, or true),
 * `error` holds its failure for the page's banner, and a command still running
 * when the screen leaves is aborted and changes nothing. `then` runs only when
 * the command finished for a screen that is still there (to navigate or store).
 */
/** A useCommand's state and actions. */
export type Command<K = true> = ReturnType<typeof useCommand<K>>;

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
  // Errors from work outside run (a poll, a child's command) report here too.
  const fail = useCallback((e: unknown) => setError(errorMessage(e)), []);
  return { busy, error, setError, fail, run, dismiss: useCallback(() => setError(""), []) };
}

/**
 * The page's error banner for a command's failure: the one way a screen shows an
 * error that is not a failed load (QueryResult shows those). Any source with an
 * `error` and a `dismiss` uses it: useCommand, useSessionStart or a session hook.
 */
export function CommandError({ command, action }: {
  /** Without `dismiss` the banner stays until its source clears it (a reply asked for again). */
  command: { error: string; dismiss?: () => void };
  /** One recovery command shown before the close button. */
  action?: ReactNode;
}) {
  return command.error ? <Banner tone="error" action={action} onDismiss={command.dismiss}>{command.error}</Banner> : null;
}
