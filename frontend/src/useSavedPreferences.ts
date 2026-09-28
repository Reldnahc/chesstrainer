import { useCallback, useEffect, useRef, useState } from "react";

export type SavedPreferences<T> = {
  preferences: T;
  ready: boolean;
  saving: boolean;
  error: string;
  retry: () => void;
  save: (value: T) => Promise<boolean>;
};

/** Mount inside AccountGate so pending responses cannot cross account changes. */
export function useSavedPreferences<T extends object>({defaults, load, write}: {
  defaults: T;
  load: (signal: AbortSignal) => Promise<Partial<T>>;
  write: (value: T) => Promise<Partial<T>>;
}): SavedPreferences<T> {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const writing = useRef(false);
  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    setReady(false);
    setError("");
    load(controller.signal)
      .then((value) => {
        if (version === generation.current) {
          setPreferences({ ...defaults, ...value });
          setReady(true);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && version === generation.current)
          setError(error.message);
      });
    return () => {
      generation.current++;
      controller.abort();
    };
  }, [revision, defaults, load]);
  const save = useCallback(async (value: T) => {
    if (writing.current) return false;
    const version = generation.current;
    writing.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = await write(value);
      if (version !== generation.current) return false;
      setPreferences({ ...defaults, ...saved });
      return true;
    } catch (error) {
      if (version === generation.current) setError((error as Error).message);
      return false;
    } finally {
      writing.current = false;
      if (version === generation.current) setSaving(false);
    }
  }, [defaults, write]);
  return {preferences, ready, saving, error, save, retry: () => setRevision(value => value + 1)};
}
