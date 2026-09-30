import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, read } from "../api";
import { useAccount } from "../AccountGate";
import { useSavedPreferences, type SavedPreferences } from "../useSavedPreferences";
import { AudioEngine } from "./engine";
import { cueForMove, defaultAudioPreferences, type AudioPreferences, type SoundCue, type SoundRequest } from "./model";

const load = (signal: AbortSignal) => read(api.GET("/api/preferences/audio", {signal}));
const write = (body: AudioPreferences) => read(api.PUT("/api/preferences/audio", {body}));
type Controls = {
  play: (request: SoundRequest) => void;
  cancel: (scope: string) => void;
  unlock: () => Promise<void>;
};
type PreferencesContext = SavedPreferences<AudioPreferences> & {
  muted: boolean;
  setMuted: (muted: boolean) => void;
};
const AudioContext = createContext<Controls | null>(null);
const PreferencesContext = createContext<PreferencesContext | null>(null);

function readMute(key: string) {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
}

/** Account preferences and browser activation are separate from sound policy. */
export function AudioProvider({children}: {children: ReactNode}) {
  const account = useAccount();
  const muteKey = `fieldwork.audio.muted:${account?.id ?? "local"}`;
  const state = useSavedPreferences({defaults: defaultAudioPreferences, load, write});
  const [muted, setMute] = useState(() => readMute(muteKey));
  const engine = useRef<AudioEngine | null>(null);
  const current = useRef({state, muted});
  current.current = {state, muted};
  const controls = useMemo<Controls>(() => ({
    play: request => engine.current?.play(request),
    cancel: scope => engine.current?.cancel(scope),
    unlock: async () => { await engine.current?.unlock(); },
  }), []);

  useEffect(() => {
    // Construct inside the effect: StrictMode's discarded render cannot retain
    // document listeners or a second audio context.
    const instance = new AudioEngine();
    engine.current = instance;
    instance.setPreferences(current.current.state.preferences);
    instance.setMuted(current.current.muted);
    instance.setReady(current.current.state.ready);
    const unlock = (event: Event) => {
      if (event.isTrusted) void instance.unlock();
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      instance.dispose();
      if (engine.current === instance) engine.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    engine.current?.setPreferences(state.preferences);
    engine.current?.setMuted(muted);
    engine.current?.setReady(state.ready);
  }, [state.preferences, state.ready, muted]);
  useEffect(() => {
    setMute(readMute(muteKey));
    const changed = (event: StorageEvent) => {
      if (event.key === muteKey || event.key === null) setMute(readMute(muteKey));
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [muteKey]);
  const setMuted = useCallback((value: boolean) => {
    engine.current?.setMuted(value);
    setMute(value);
    try { localStorage.setItem(muteKey, String(value)); } catch { /* This tab still honors mute when storage is unavailable. */ }
  }, [muteKey]);

  return <PreferencesContext.Provider value={{...state, muted, setMuted}}>
    <AudioContext.Provider value={controls}>{children}</AudioContext.Provider>
  </PreferencesContext.Provider>;
}

export function useAudioPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("AudioProvider must be inside the current account boundary.");
  return context;
}

export function useOptionalAudioPreferences() { return useContext(PreferencesContext); }

/** An explicit action owns its sounds. Mounting or hydrating a board is silent. */
export function useAudioScope(key: string) {
  const controls = useContext(AudioContext);
  const id = useId();
  const scope = `${id}:${key}`;
  const live = useRef<string | null>(null);
  useLayoutEffect(() => {
    live.current = scope;
    return () => {
      live.current = null;
      controls?.cancel(scope);
    };
  }, [controls, scope]);
  return useMemo(() => ({
    play(cue: SoundCue, eventId: string, options?: {delayMs?: number}) {
      if (live.current !== scope) return;
      controls?.play({cue, eventId, scope, ...options});
    },
    move(san: string | null | undefined, eventId: string, options?: {delayMs?: number}) {
      const cue = cueForMove(san);
      if (cue && live.current === scope) controls?.play({cue, eventId, scope, ...options});
    },
    cancel: () => controls?.cancel(scope),
    unlock: async () => { await controls?.unlock(); },
  }), [controls, scope]);
}
