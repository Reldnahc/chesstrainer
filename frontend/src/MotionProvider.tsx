import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { api, read } from "./api";
import { resolveMotion, type MotionPreference } from "./motion";
import { useReducedMotion } from "./useReducedMotion";
import { useSavedPreferences, type SavedPreferences } from "./useSavedPreferences";

type Preferences = {motion: MotionPreference};
type Context = SavedPreferences<Preferences> & {motion: "natural" | "still"};
const defaults: Preferences = {motion: "system"};
const load = (signal: AbortSignal) => read(api.GET("/api/preferences/motion", {signal}));
const write = (body: Preferences) => read(api.PUT("/api/preferences/motion", {body}));
const MotionContext = createContext<Context | null>(null);

export function MotionProvider({children}: {children: ReactNode}) {
  const state = useSavedPreferences({defaults, load, write});
  const deviceReduced = useReducedMotion();
  const motion = state.ready ? resolveMotion(state.preferences.motion, deviceReduced) : "still";
  useLayoutEffect(() => {
    document.documentElement.dataset.interfaceMotion = motion;
    return () => { delete document.documentElement.dataset.interfaceMotion; };
  }, [motion]);
  return <MotionContext.Provider value={{...state, motion}}>{children}</MotionContext.Provider>;
}

export function useMotionPreferences() {
  const context = useContext(MotionContext);
  if (!context) throw new Error("MotionProvider must be inside the current account boundary.");
  return context;
}

export function useInterfaceMotion() {
  const context = useContext(MotionContext);
  const deviceReduced = useReducedMotion();
  return context?.motion ?? resolveMotion("system", deviceReduced);
}
