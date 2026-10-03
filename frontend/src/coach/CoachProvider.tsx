import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { api, read } from "../api";
import { useSavedPreferences, type SavedPreferences } from "../useSavedPreferences";
import type { CoachPreferences } from "./model";

type CoachChange = Partial<CoachPreferences>;
type CoachField = keyof CoachPreferences;
type CoachState = SavedPreferences<CoachPreferences, CoachChange> & {
  /** Choices still being written, shown by their own control until the save settles. */
  pending: CoachChange;
  failed: CoachField | null;
  saveField: <K extends CoachField>(field: K, value: CoachPreferences[K]) => Promise<boolean>;
};

const defaults: CoachPreferences = { coach_id: "classic", motion: "system" };
const load = (signal: AbortSignal) => read(api.GET("/api/preferences/coach", {signal}));
// Coach and coach motion share one saved record but are separate controls,
// so each change writes only its own field.
const write = (body: CoachChange) => read(api.PATCH("/api/preferences/coach", {body}));
const CoachContext = createContext<CoachState | null>(null);

function without(change: CoachChange, field: CoachField): CoachChange {
  const rest = {...change};
  delete rest[field];
  return rest;
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const state = useSavedPreferences({defaults, load, write});
  const {save, retry} = state;
  const [pending, setPending] = useState<CoachChange>({});
  const [failed, setFailed] = useState<CoachField | null>(null);
  const queue = useRef(Promise.resolve(true));
  const latest = useRef<Partial<Record<CoachField, number>>>({});
  const saveField = useCallback(<K extends CoachField>(field: K, value: CoachPreferences[K]) => {
    const token = (latest.current[field] ?? 0) + 1;
    latest.current[field] = token;
    setPending(current => ({...current, [field]: value}));
    setFailed(null);
    // The shared hook allows one write at a time; queue instead of dropping a change.
    const result = queue.current.then(() => save({[field]: value}));
    queue.current = result;
    return result.then(ok => {
      if (!ok) setFailed(field);
      if (latest.current[field] === token) setPending(current => without(current, field));
      return ok;
    });
  }, [save]);
  const value = {...state, pending, failed, saveField, retry: () => { setFailed(null); retry(); }};
  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoachPreferences() {
  const context = useContext(CoachContext);
  if (!context)
    throw new Error("CoachProvider must be inside the current account boundary.");
  return context;
}

/** One coach preference control with its own pending value, saving state and error. */
export function useCoachPreference<K extends CoachField>(field: K) {
  const {preferences, ready, error, pending, failed, saveField, retry} = useCoachPreferences();
  return {
    value: (pending[field] ?? preferences[field]) as CoachPreferences[K],
    ready,
    saving: field in pending,
    error: failed === null || failed === field ? error : "",
    save: (value: CoachPreferences[K]) => saveField(field, value),
    retry,
  };
}

export function useOptionalCoachPreferences() { return useContext(CoachContext); }
