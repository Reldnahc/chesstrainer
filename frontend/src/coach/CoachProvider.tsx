import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, read } from "../api";
import type { CoachPreferences } from "./model";

const defaults: CoachPreferences = { coach_id: "classic", motion: "system" };
type Context = {
  preferences: CoachPreferences;
  ready: boolean;
  saving: boolean;
  error: string;
  retry: () => void;
  save: (value: CoachPreferences) => Promise<boolean>;
};
const CoachContext = createContext<Context | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
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
    read(api.GET("/api/preferences/coach", { signal: controller.signal }))
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
  }, [revision]);
  const save = useCallback(async (value: CoachPreferences) => {
    if (writing.current) return false;
    const version = generation.current;
    writing.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = await read(
        api.PUT("/api/preferences/coach", { body: value }),
      );
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
  }, []);
  return (
    <CoachContext.Provider
      value={{
        preferences,
        ready,
        saving,
        error,
        save,
        retry: () => setRevision((value) => value + 1),
      }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoachPreferences() {
  const context = useContext(CoachContext);
  if (!context)
    throw new Error(
      "CoachProvider must be inside the current account boundary.",
    );
  return context;
}
