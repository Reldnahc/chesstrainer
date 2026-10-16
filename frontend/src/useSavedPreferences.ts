import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./api";
import { useAccount, useGuest } from "./accountContext";
import { useLatest } from "./useLatest";

/** What became of one save: written, replaced (by a later choice or a reload)
 * before it was written, or failed, with the reason in `error`. */
export type SaveResult = "saved" | "superseded" | "failed";

export type SavedPreferences<T, W extends Partial<T> = T> = {
  preferences: T;
  ready: boolean;
  saving: boolean;
  error: string;
  /** Whether the preferences shown before loading came from this device's cache. */
  cached: boolean;
  retry: () => void;
  save: (value: W) => Promise<SaveResult>;
};

/** Remembers the loaded preferences on this device for each account, so the
 * next visit starts from them while the saved ones load. `pick` keeps the valid
 * fields worth starting from out of what was stored. */
export type DeviceCache<T> = {
  name: string;
  pick: (stored: Partial<Record<keyof T, unknown>>) => Partial<T>;
  /** The device-wide key used before caches were kept per account, and how to read
   * its stored text. The first account (never a signed-out guest) to read its own
   * cache on this device starts from it when it has none, then the key is removed. */
  legacy?: { key: string; read: (stored: string) => Partial<Record<keyof T, unknown>> };
};

/** The one key scheme for device caches: `fieldwork.<name>:<account id or "local">`. */
export const deviceCacheKey = (name: string, accountId: string | null | undefined) =>
  `fieldwork.${name}:${accountId ?? "local"}`;

function readCache<T>(key: string, pick: DeviceCache<T>["pick"]): Partial<T> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return stored && typeof stored === "object"
      ? pick(stored as Partial<Record<keyof T, unknown>>)
      : {};
  } catch {
    return {};
  }
}

/** Moves a pre-account device key into the account's cache when that has nothing yet.
 * The account key is written before the old one is removed, so reading twice (as
 * StrictMode does) finds the same starting point. */
function migrateCache<T>(key: string, cache: DeviceCache<T>) {
  if (!cache.legacy) return;
  try {
    const old = localStorage.getItem(cache.legacy.key);
    if (old === null) return;
    const seeded = cache.pick(cache.legacy.read(old));
    if (!Object.keys(readCache(key, cache.pick)).length && Object.keys(seeded).length)
      localStorage.setItem(key, JSON.stringify(seeded));
    localStorage.removeItem(cache.legacy.key);
  } catch {
    /* storage unavailable */
  }
}

type Waiter<W> = { value: W; resolve: (result: SaveResult) => void };

/**
 * Loads an account's saved preferences and writes changes back. Writes run one
 * at a time: a save made while another is being written waits, merged with any
 * other waiting change, so each field's latest choice wins and none is dropped.
 * Mount inside AccountGate so pending responses cannot cross account changes.
 */
export function useSavedPreferences<T extends object, W extends Partial<T> = T>({
  defaults,
  load,
  write,
  deviceCache,
}: {
  defaults: T;
  load: (signal: AbortSignal) => Promise<Partial<T>>;
  write: (value: W) => Promise<Partial<T>>;
  deviceCache?: DeviceCache<T>;
}): SavedPreferences<T, W> {
  const account = useAccount();
  // A signed-out visitor of a shared game keeps choices for this page only.
  const guest = useGuest();
  const cacheKey = deviceCache ? deviceCacheKey(deviceCache.name, account?.id) : null;
  const [initial] = useState(() => {
    if (cacheKey && deviceCache && !guest) migrateCache(cacheKey, deviceCache);
    const remembered = cacheKey && deviceCache ? readCache(cacheKey, deviceCache.pick) : {};
    return {
      preferences: { ...defaults, ...remembered },
      cached: Object.keys(remembered).length > 0,
    };
  });
  const [preferences, setPreferences] = useState(initial.preferences);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  // The next write: every change saved while another write was in flight.
  const queued = useRef<{ value: W; waiters: Waiter<W>[] } | null>(null);
  const writing = useRef(false);
  const latest = useLatest({ write, guest });
  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a load starts here; the preferences are not ready until it answers
    setReady(false);
    setError("");
    // A reload replaces any change still waiting; a write in flight is ignored.
    queued.current?.waiters.forEach(waiter => waiter.resolve("superseded"));
    queued.current = null;
    setSaving(false);
    (guest ? Promise.resolve({}) : load(controller.signal))
      .then(value => {
        if (version === generation.current) {
          setPreferences({ ...defaults, ...value });
          setReady(true);
        }
      })
      .catch(error => {
        if (!controller.signal.aborted && version === generation.current)
          setError(errorMessage(error));
      });
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- bumping the latest generation is meant to invalidate the load and any write in flight
      generation.current++;
      controller.abort();
    };
  }, [revision, defaults, load, guest]);
  useEffect(() => {
    if (!ready || !cacheKey || guest) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(preferences));
    } catch {
      /* storage unavailable */
    }
  }, [ready, preferences, cacheKey, guest]);
  const drain = useCallback(async () => {
    writing.current = true;
    while (queued.current) {
      const { value, waiters } = queued.current;
      queued.current = null;
      const version = generation.current;
      let result: SaveResult;
      try {
        const saved: Partial<T> = latest.current.guest ? value : await latest.current.write(value);
        result = version === generation.current ? "saved" : "superseded";
        if (result === "saved") {
          setPreferences(current => ({ ...current, ...saved }));
          setError("");
        }
      } catch (error) {
        result = version === generation.current ? "failed" : "superseded";
        if (result === "failed") setError(errorMessage(error));
      }
      waiters.forEach(waiter => waiter.resolve(result));
    }
    writing.current = false;
    setSaving(false);
  }, [latest]);
  const save = useCallback(
    (value: W) =>
      new Promise<SaveResult>(resolve => {
        const waiting = queued.current;
        // A waiting change whose every field this one replaces is never written.
        const waiters = (waiting?.waiters ?? []).filter(waiter => {
          const replaced = Object.keys(waiter.value).every(field => field in value);
          if (replaced) waiter.resolve("superseded");
          return !replaced;
        });
        queued.current = {
          value: { ...waiting?.value, ...value },
          waiters: [...waiters, { value, resolve }],
        };
        setSaving(true);
        setError("");
        if (!writing.current) void drain();
      }),
    [drain],
  );
  return {
    preferences,
    ready,
    saving,
    error,
    cached: initial.cached,
    save,
    retry: () => setRevision(value => value + 1),
  };
}
