import { createContext, useContext, type ReactNode } from "react";
import { api, read } from "../api";
import { useSavedPreferences, type SavedPreferences } from "../useSavedPreferences";
import type { CoachPreferences } from "./model";

const defaults: CoachPreferences = { coach_id: "classic", motion: "system" };
const load = (signal: AbortSignal) => read(api.GET("/api/preferences/coach", {signal}));
const write = (body: CoachPreferences) => read(api.PUT("/api/preferences/coach", {body}));
const CoachContext = createContext<SavedPreferences<CoachPreferences> | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const state = useSavedPreferences({defaults, load, write});
  return <CoachContext.Provider value={state}>{children}</CoachContext.Provider>;
}

export function useCoachPreferences() {
  const context = useContext(CoachContext);
  if (!context)
    throw new Error("CoachProvider must be inside the current account boundary.");
  return context;
}

export function useOptionalCoachPreferences() { return useContext(CoachContext); }
